// Shared tournament records live in D1. The deployed site controls who can reach this API.
const openDota = 'https://api.opendota.com/api'
const profileTTL = 6 * 3600
const maxBody = 6 * 1024 * 1024
const playerNumbers = ['kills','deaths','assists','gold_per_min','xp_per_min','net_worth','level',
  'hero_damage','hero_healing','tower_damage','last_hits','denies','obs_placed','sen_placed',
  'purchase_ward_observer','purchase_ward_sentry','total_gold','stuns','item_0','item_1','item_2',
  'item_3','item_4','item_5','item_neutral','backpack_0','backpack_1','backpack_2']
class InputError extends Error {
  constructor(status,message) { super(message); this.status=status }
}
const isInteger = (value,min,max) => Number.isSafeInteger(value) && value>=min && value<=max
const isMatchID = id => /^(?:[1-9]\d{0,14})$/.test(String(id))
const isKey = key => typeof key==='string' && /^[a-zA-Z0-9_]{1,120}$/.test(key)
const cleanName = value => typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,100) : ''
function copySeries(value, limit=1500) {
  if (Array.isArray(value) && value.length<=limit && value.every(n=>isInteger(n,-100000000,100000000))) return value
}
function extractPlayer(p) {
  if (!p || !isInteger(p.hero_id,1,10000) || !isInteger(p.player_slot,0,255)) {
    throw new InputError(422,'Each player needs a hero ID and a player slot.')
  }
  if (!['kills','deaths','assists'].every(field=>isInteger(p[field],0,100000))) {
    throw new InputError(422,'Each player needs kills, deaths and assists from the final scoreboard.')
  }
  const row={hero_id:p.hero_id,player_slot:p.player_slot,account_id:isInteger(p.account_id,1,4294967294)?p.account_id:null}
  for(const key of playerNumbers) if(Number.isFinite(p[key]) && p[key]>=0 && p[key]<=1e9) row[key]=p[key]
  row.personaname=cleanName(p.personaname)||cleanName(p.persona_name)||cleanName(p.name)||null
  for(const key of ['gold_t','xp_t','times']) row[key]=copySeries(p[key])
  row.ability_upgrades_arr=copySeries(p.ability_upgrades_arr ?? (Array.isArray(p.ability_upgrades) ? p.ability_upgrades.map(x=>x?.ability) : undefined),128)
  if(Array.isArray(p.purchase_log)) row.purchase_log=p.purchase_log.slice(0,1200)
    .filter(item=>item && isKey(item.key) && isInteger(item.time,-3600,1000000))
    .map(item=>({key:item.key,time:item.time,item_id:isInteger(item.item_id,1,100000)?item.item_id:undefined}))
  if(Array.isArray(p.skill_build)) row.skill_build=p.skill_build.slice(0,128)
    .filter(item=>item && isKey(item.key) && isInteger(item.time,-3600,1000000))
    .map(item=>({key:item.key,time:item.time,hero_level:isInteger(item.hero_level,1,100)?item.hero_level:undefined}))
  const timestamp=v=>isInteger(v?.time,-3600,604800);
  const item=v=>v===null||isInteger(v,0,100000)||isKey(v);
  if(Array.isArray(p.inventory_snapshots))row.inventory_snapshots=p.inventory_snapshots.filter(v=>timestamp(v)&&Array.isArray(v.items)&&v.items.length===6&&v.items.every(item)).slice(0,12000).map(v=>({time:v.time,items:v.items}));
  if(Array.isArray(p.skill_snapshots))row.skill_snapshots=p.skill_snapshots.filter(v=>timestamp(v)&&Array.isArray(v.skills)).slice(0,4000).map(v=>({time:v.time,skills:v.skills.filter(k=>isKey(k?.key)&&isInteger(k.level,1,100)).slice(0,32).map(k=>({key:k.key,level:k.level}))}));
  return row
}
function extractMatch(raw) {
  if (!raw || !isMatchID(raw.match_id) || typeof raw.radiant_win!=='boolean' || !isInteger(raw.duration,1,604800)) {
    throw new InputError(422,'The file needs a match ID, final winner and duration in seconds.')
  }
  if (!Array.isArray(raw.players) || raw.players.length<2 || raw.players.length>24) {
    throw new InputError(422,'A match needs a final scoreboard with players from both teams.')
  }
  const players=raw.players.map(extractPlayer)
  if (new Set(players.map(p=>p.player_slot)).size!==players.length || !players.some(p=>p.player_slot<128) || !players.some(p=>p.player_slot>=128)) {
    throw new InputError(422,'The scoreboard must include distinct slots on both teams.')
  }
  const match={match_id:Number(raw.match_id),radiant_win:raw.radiant_win,duration:raw.duration,players}
  for(const k of ['start_time','game_mode','lobby_type','radiant_score','dire_score','version'])
    if(isInteger(raw[k],0,4294967295)) match[k]=raw[k]
  for(const [team,rad] of [['radiant_score',true],['dire_score',false]]) {
    if(match[team]===undefined) match[team]=players.filter(p=>(p.player_slot<128)===rad).reduce((a,p)=>a+p.kills,0)
  }
  for(const key of ['radiant_gold_adv','radiant_xp_adv']) match[key]=copySeries(raw[key])
  if(Array.isArray(raw.position_track))match.position_track=raw.position_track.filter(r=>isInteger(r?.t,0,604800)&&Array.isArray(r.p)&&r.p.length===20&&r.p.every(n=>Number.isInteger(n)&&n>=-1&&n<=512)).slice(0,18000).map(r=>({t:r.t,p:r.p}));
  return JSON.parse(JSON.stringify(match))
}
async function fetchOpenDota(path,env) {
  const url=new URL(openDota+path)
  if(env.OPENDOTA_API_KEY) url.searchParams.set('api_key',env.OPENDOTA_API_KEY)
  let res
  try { res=await fetch(url,{signal:AbortSignal.timeout(6500),headers:{Accept:'application/json'}}) }
  catch { throw new InputError(503,'OpenDota could not be reached. Retry shortly or import a parsed match JSON.') }
  if(res.status===404) throw new InputError(404,'OpenDota has no record for this match ID. For a private lobby, import its parsed replay JSON.')
  if(res.status===429) throw new InputError(429,'OpenDota is rate-limiting requests. Retry later or import the match JSON.')
  if(!res.ok) throw new InputError(502,'OpenDota could not return that record. Try again later.')
  try { return await res.json() } catch { throw new InputError(502,'OpenDota returned an unreadable response.') }
}
async function steamResponse(path,params,key) {
  const url=new URL('https://api.steampowered.com/'+path)
  url.search=new URLSearchParams({...params,key}).toString()
  const result=await fetch(url,{signal:AbortSignal.timeout(5000)})
  if(!result.ok) throw new Error('Steam lookup unavailable.')
  return result.json()
}
async function fetchMatch(id,env) {
  try {
    return await fetchOpenDota('/matches/'+id,env)
  } catch(original) {
    if(!env.STEAM_WEB_API_KEY) throw original
    try {
      const data=await steamResponse('IDOTA2Match_570/GetMatchDetails/v1/',{match_id:id,include_persona_names:'true'},env.STEAM_WEB_API_KEY)
      if(String(data?.result?.match_id)===String(id) && Array.isArray(data.result.players)) return data.result
    } catch { /* Either provider can be unavailable for a private match. */ }
    throw original
  }
}
async function steamNames(ids,env) {
  const names=new Map()
  if(!env.STEAM_WEB_API_KEY || !ids.length) return names
  const base=76561197960265728n
  try {
    const data=await steamResponse('ISteamUser/GetPlayerSummaries/v2/',{
      steamids:ids.map(id=>(BigInt(id)+base).toString()).join(',')
    },env.STEAM_WEB_API_KEY)
    for(const p of data.response?.players??[]) {
      const id=Number(BigInt(p.steamid)-base)
      if(ids.includes(id)) names.set(id,cleanName(p.personaname))
    }
  } catch { /* Fall back to cached OpenDota profiles. */ }
  return names
}
async function listMatches(env) {
  const [records,profileRows]=await env.DB.batch([
    env.DB.prepare('SELECT payload FROM matches ORDER BY started DESC, id DESC'),
    env.DB.prepare('SELECT id,name,checked FROM profiles')
  ])
  const matches=records.results.map(row=>JSON.parse(row.payload))
  const profiles=new Map(profileRows.results.map(p=>[String(p.id),p]))
  const ids=new Set(matches.flatMap(m=>m.players.map(p=>p.account_id).filter(Boolean)))
  const now=Math.floor(Date.now()/1000)
  const due=[...ids].filter(id=>(profiles.get(String(id))?.checked??0)<now-profileTTL)
    .sort((a,b)=>(profiles.get(String(a))?.checked??0)-(profiles.get(String(b))?.checked??0)).slice(0,6)
  const liveNames=await steamNames(due,env)
  const updates=await Promise.all(due.map(async id=>{
    let name=liveNames.get(id)||null
    try { if(!name) name=cleanName((await fetchOpenDota('/players/'+id,env)).profile?.personaname)||null } catch { /* Keep last known IGN during an outage. */ }
    const prior=profiles.get(String(id))
    profiles.set(String(id),{name:name||prior?.name})
    // Failed lookups retry after 20 minutes; successful profiles refresh in six hours.
    const checked=name?now:now-profileTTL+1200
    return env.DB.prepare('INSERT INTO profiles(id,name,checked) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=COALESCE(excluded.name,profiles.name), checked=excluded.checked')
      .bind(String(id),name,checked)
  }))
  if(updates.length) await env.DB.batch(updates)
  for(const match of matches) for(const p of match.players) {
    const current=profiles.get(String(p.account_id))?.name
    if(current) p.personaname=current
  }
  return matches
}
// Enrich earlier summary-only imports without replacing a previously captured timeline.
function enrich(old,next) {
  if(old.radiant_win!==next.radiant_win || Math.abs(old.duration-next.duration)>3 ||
      old.players.length!==next.players.length) throw new InputError(409,'This ID already belongs to a different scoreboard.')
  function merge(a,b) {
    const out={...a}
    for(const [key,value] of Object.entries(b))
      if(out[key]==null || (Array.isArray(value) && value.length>(out[key]?.length||0))) out[key]=value
    return out
  }
  const out=merge(old,next)
  out.players=old.players.map(p=>{
    const n=next.players.find(v=>v.player_slot===p.player_slot && v.hero_id===p.hero_id)
    if(!n || (p.account_id && n.account_id && p.account_id!==n.account_id)) throw new InputError(409,'This ID already belongs to a different lineup.')
    return merge(p,n)
  })
  return out
}
async function storeMatch(env, match) {
  const id=String(match.match_id)
  for(let attempt=0;attempt<3;attempt++) {
    const current=await env.DB.prepare('SELECT payload FROM matches WHERE id=?').bind(id).first()
    const result=current?enrich(JSON.parse(current.payload),match):match
    const payload=JSON.stringify(result)
    if(payload===current?.payload) return result
    if(payload.length>1250000) throw new InputError(413,'This match exceeds the tournament record size.')
    const started=result.start_time||0
    const change=current
      ? await env.DB.prepare('UPDATE matches SET started=?,payload=? WHERE id=? AND payload=?').bind(started,payload,id,current.payload).run()
      : await env.DB.prepare('INSERT INTO matches(id,started,payload) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,started,payload).run()
    if(change.meta.changes) return result
  }
  throw new InputError(409,'Another import is updating this match. Please retry.')
}
async function readBody(request) {
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new InputError(415,'Send an application/json request.')
  if(Number(request.headers.get('Content-Length'))>maxBody) throw new InputError(413,'Choose a smaller parsed match JSON file.')
  const reader=request.body?.getReader()
  if(!reader) throw new InputError(400,'A match ID or match JSON is required.')
  const decoder=new TextDecoder()
  let bytes=0, text=''
  for(;;) {
    const {done,value}=await reader.read()
    if(done) break
    bytes+=value.length
    if(bytes>maxBody) { await reader.cancel(); throw new InputError(413,'Choose a smaller parsed match JSON file.') }
    text+=decoder.decode(value,{stream:true})
  }
  try { return JSON.parse(text+decoder.decode()) } catch { throw new InputError(400,'The request contains invalid JSON.') }
}
const respond=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function api(request,env) {
  try {
    const url=new URL(request.url)
    if(url.pathname!=='/api/matches') return respond({error:'Unknown endpoint.'},404)
    if(!env.DB) throw new InputError(503,'Tournament storage is unavailable.')
    if(request.method==='GET') return respond({matches:await listMatches(env)})
    if(request.method!=='POST') return respond({error:'Use GET or POST.'},405)
    const origin=request.headers.get('Origin')
    if(origin && origin!==url.origin) throw new InputError(403,'Open the tracker to import a match.')
    const body=await readBody(request)
    let raw=body?.match
    if(!raw) {
      if(!isMatchID(body?.id)) throw new InputError(400,'Enter a numeric Dota 2 match ID.')
      raw=await fetchMatch(body.id,env)
      if(String(raw?.match_id)!==String(body.id)) throw new InputError(502,'OpenDota did not return the requested match.')
    }
    return respond({match:await storeMatch(env,extractMatch(raw))})
  } catch(error) {
    return respond({error:error instanceof InputError?error.message:'Tournament storage could not complete this request. Please retry.'},error instanceof InputError?error.status:503)
  }
}
