const playerNumbers = ['kills','deaths','assists','gold_per_min','xp_per_min','net_worth','level',
  'hero_damage','hero_healing','support_gold_spent','tower_damage','last_hits','denies','obs_placed','sen_placed',
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
export function extractMatch(raw) {
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
export function enrich(old,next) {
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
