import * as heroArt from './heroes.js';
import { ability, item, itemKey } from './stats.js';

const finite = Number.isFinite;
const escape = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const clock = seconds => (seconds<0?'−':'')+Math.floor(Math.abs(seconds)/60)+':'+String(Math.floor(Math.abs(seconds)%60)).padStart(2,'0');
const num = n => finite(n)?Math.round(n).toLocaleString():'—';
const list = v => Array.isArray(v)?v:[];
const ign = p => p.personaname || p.persona_name || p.name || (p.account_id && p.account_id!==4294967295 ? 'Player '+p.account_id : 'Anonymous');
const events = xs => list(xs).filter(e=>e && finite(e.time)).slice().sort((a,b)=>a.time-b.time);
const lastAt = (xs,t) => {let lo=0,hi=xs.length;while(lo<hi){const mid=(lo+hi)>>>1;if(xs[mid].time<=t)lo=mid+1;else hi=mid;}return lo-1;};
function prepare(p) {
  return {
    inventories:events(p.inventory_snapshots).filter(e=>Array.isArray(e.items)),
    skills:events(p.skill_build).filter(e=>e.key!=null),
    levels:events(p.skill_snapshots).filter(e=>Array.isArray(e.skills)),
    buys:events(p.purchase_log).filter(e=>e.key!=null || e.item_id!=null)
  };
}
// A purchase is evidence of a transaction. Only observed slots establish inventory.
export function playerStateAt(p,t,prepared=prepare(p)) {
  const inv=prepared.inventories[lastAt(prepared.inventories,t)] ?? null;
  const snap=prepared.levels[lastAt(prepared.levels,t)] ?? null;
  const skillEvents=prepared.skills.slice(0,lastAt(prepared.skills,t)+1);
  const levels=new Map();
  if(snap) for(const s of snap.skills) {
    if(s && s.key!=null && finite(s.level) && s.level>0) levels.set(String(s.key),s.level);
  }
  for(const e of skillEvents) {
    if(snap && e.time<=snap.time)continue;
    const k=String(e.key);
    levels.set(k,finite(e.level)?e.level:(levels.get(k)||0)+1);
  }
  return {inventory:inv,levels:[...levels],skillEvents,hasTimedSkills:!!(prepared.skills.length||prepared.levels.length),
    purchases:prepared.buys.slice(0,lastAt(prepared.buys,t)+1),hasPurchases:!!prepared.buys.length};
}
function lineup(side,roster) {
  const members=roster.map((p,i)=>({p,i})).filter(({p})=>(p.player_slot<128)===side);
  const name=side?'Radiant':'Dire';
  return '<section class="ex-team '+(side?'ex-r':'ex-d')+'" aria-label="'+name+' lineup"><h3>'+name+'</h3><div class="ex-roster">'+members.map(({p,i})=>'<button type="button" data-player="'+i+'" aria-pressed="false" title="'+escape(ign(p)+' · '+heroArt.heroName(p.hero_id))+'"><img src="'+escape(heroArt.heroPortrait(p.hero_id))+'" alt=""><span><b>'+escape(heroArt.heroName(p.hero_id))+'</b><small>'+escape(ign(p))+'</small></span></button>').join('')+'</div></section>';
}
function icon(key) {
  const slug=itemKey(key);
  if(!/^[a-z0-9_]+$/.test(slug))return '';
  return '<img class="ex-item-icon" loading="lazy" alt="" src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/'+slug+'.png">';
}
function itemSlots(items) {
  return '<div class="ex-slots">'+Array.from({length:6},(_,i)=>{
    const key=items[i],empty=key===0||key==='0'||key==='';
    return '<span class="ex-slot'+(empty?' empty':'')+'">'+(key?icon(key):'')+'<span>'+escape(key==null?'Unknown':empty?'Empty':item(key))+'</span></span>';
  }).join('')+'</div>';
}
function observed(p,state,t,prepared) {
  let inv;
  if(state.inventory) inv='<small class="ex-caption">Latest snapshot at '+clock(state.inventory.time)+'</small>'+itemSlots(state.inventory.items);
  else inv='<p class="ex-note">'+(prepared.inventories.length?'First inventory snapshot at '+clock(prepared.inventories[0].time)+'.':'Inventory snapshots unavailable.')+'</p>';
  const skills=state.levels.length?'<ul class="ex-skills">'+state.levels.map(([k,v])=>'<li>'+escape(ability(k))+' <b>Lv '+num(v)+'</b></li>').join('')+'</ul>':
    '<p class="ex-note">'+(state.hasTimedSkills?'No skill levels recorded yet.':'Skill upgrade times unavailable.')+'</p>';
  let purchases;
  if(state.purchases.length) purchases='<ol class="ex-buys">'+state.purchases.slice(-6).reverse().map(e=>'<li><time>'+clock(e.time)+'</time>'+icon(e.key??e.item_id)+escape(item(e.key??e.item_id))+'</li>').join('')+'</ol>';
  else purchases='<p class="ex-note">'+(state.hasPurchases?'No purchases recorded yet.':'Purchase times unavailable.')+'</p>';
  return '<section><h4>Inventory</h4>'+inv+'</section><section><h4>Skill levels</h4>'+skills+'</section><section><h4>Recent purchases</h4>'+purchases+'</section>';
}
function endBuild(p) {
  const inv=Array.from({length:6},(_,i)=>p['item_'+i]);
  const ordered=list(p.ability_upgrades_arr).length?p.ability_upgrades_arr:list(p.skill_build).length?p.skill_build.map(s=>s.key):list(p.ability_upgrades).map(s=>s.ability);
  return '<details class="ex-end"><summary>Final inventory and full skill order</summary><div><h4>Final inventory</h4>'+(inv.some(v=>v!=null)?itemSlots(inv):'<p class="ex-note">Final inventory unavailable.</p>')+'<h4>Recorded skill order</h4>'+(ordered.length?'<ol class="ex-order">'+ordered.map(k=>'<li>'+escape(ability(k))+'</li>').join('')+'</ol>':'<p class="ex-note">Skill order unavailable.</p>')+'</div></details>';
}
function lead(values,t,kind){
  const v=t<0?null:list(values)[Math.floor(t/60)];
  return finite(v)?(v===0?'Even '+kind:(v>0?'Radiant':'Dire')+' +'+num(Math.abs(v))+' '+kind):null;
}
export function mountExplorer(container,match) {
  const roster=list(match?.players).slice().sort((a,b)=>a.player_slot-b.player_slot);
  if(!roster.length){container.innerHTML='<p class="ex-note">No lineup is available.</p>';return ()=>{};}
  const prepared=roster.map(prepare);
  const starts=prepared.flatMap(p=>[p.inventories[0],p.skills[0],p.buys[0],p.levels[0]]).filter(Boolean).map(e=>e.time);
  const min=Math.floor(Math.min(0,...starts));
  const ends=prepared.flatMap(p=>[p.inventories,p.skills,p.buys,p.levels].map(xs=>xs.at(-1)?.time).filter(finite));
  const end=finite(match.duration)?Math.max(0,Math.floor(match.duration)):Math.max(0,...ends);
  let index=0,t=0,speed=30,interval=null,lastTick=0,elapsed=0,frameKey='';
  container.innerHTML='<div class="ex-shell" aria-label="Match replay explorer"><div class="ex-title"><div><small>Match #'+escape(match.match_id)+'</small><h2>Replay explorer</h2></div></div><div class="ex-lineups">'+lineup(true,roster)+lineup(false,roster)+'</div><div class="ex-content"><div class="ex-feature"><div class="ex-person"></div><div class="ex-stage"></div><div class="ex-endstats"></div></div><div class="ex-panel"><div class="ex-transport"><div class="ex-clock"><span>Match clock</span><b data-clock>0:00</b><small> / '+clock(end)+'</small></div><div class="ex-controlrow"><button type="button" data-play>Play</button><input aria-label="Match time" data-scrub type="range" min="'+min+'" max="'+end+'" step="1" value="0"><select aria-label="Playback speed" data-rate>'+[1,10,30,60].map(s=>'<option value="'+s+'"'+(s===speed?' selected':'')+'>'+s+'×</option>').join('')+'</select></div><div class="ex-lead"></div></div><div class="ex-observed"></div><div class="ex-final"></div></div></div></div>';
  const $=selector=>container.querySelector(selector);
  const play=$('[data-play]'),scrub=$('[data-scrub]'),rate=$('[data-rate]');
  function stop(){
    if(interval!==null) clearInterval(interval);
    interval=null;play.textContent=t>=end&&end>0?'Replay':'Play';
    play.setAttribute('aria-label',play.textContent+' match timeline');
  }
  function paint(force=false) {
    scrub.value=String(t);scrub.setAttribute('aria-valuetext',clock(t));$('[data-clock]').textContent=clock(t);
    const leadText=[lead(match.radiant_gold_adv,t,'gold'),lead(match.radiant_xp_adv,t,'XP')].filter(Boolean).join(' · ');
    $('.ex-lead').textContent=leadText;$('.ex-lead').hidden=!leadText;
    const data=prepared[index],key=[index,...[data.inventories,data.skills,data.buys,data.levels].map(xs=>lastAt(xs,t))].join('/');
    if(force||key!==frameKey){
      frameKey=key;
      $('.ex-observed').innerHTML=observed(roster[index],playerStateAt(roster[index],t,data),t,data);
    }
    if(t>=end&&interval!==null)stop();
    if(interval===null)stop();
  }
  function select(i) {
    if(!roster[i])return;
    index=i;const p=roster[i],rad=p.player_slot<128;
    for(const btn of container.querySelectorAll('[data-player]'))btn.setAttribute('aria-pressed',String(Number(btn.dataset.player)===i));
    $('.ex-person').innerHTML='<small class="'+(rad?'r':'d')+'">'+(rad?'Radiant':'Dire')+'</small><h3>'+escape(heroArt.heroName(p.hero_id))+'</h3><b>'+escape(ign(p))+'</b>';
    const stage=$('.ex-stage'), mounted=stage.querySelector('[data-showcase]');
    if(mounted && heroArt.heroShowcase(p.hero_id) && typeof heroArt.switchHeroShowcase==='function')heroArt.switchHeroShowcase(mounted,p.hero_id);
    else {stage.innerHTML=heroArt.heroShowcase(p.hero_id);heroArt.hydrateHeroes(stage);}
    $('.ex-endstats').innerHTML='<small>Final match stats</small><div>'+[['K / D / A',[p.kills,p.deaths,p.assists].map(num).join(' / ')],['GPM',num(p.gold_per_min)],['XPM',num(p.xp_per_min)]].map(([k,v])=>'<span><b>'+v+'</b>'+k+'</span>').join('')+'</div>';
    $('.ex-final').innerHTML=endBuild(p);
    paint(true);
  }
  function handleClick(event) {
    const choice=event.target.closest('[data-player]');
    if(choice&&container.contains(choice)){const next=Number(choice.dataset.player);if(next!==index)select(next);return;}
    if(event.target!==play)return;
    if(interval!==null){stop();return;}
    if(t>=end)t=min;
    lastTick=performance.now();elapsed=0;play.textContent='Pause';play.setAttribute('aria-label','Pause match timeline');
    interval=setInterval(()=>{
      if(!container.isConnected){stop();return;}
      const now=performance.now();elapsed+=(now-lastTick)/1000*speed;lastTick=now;
      const step=Math.floor(elapsed);if(!step)return;
      elapsed-=step;t=Math.min(end,t+step);paint();
    },125);
    paint();
  }
  function seek(){t=Number(scrub.value);lastTick=performance.now();elapsed=0;paint(true);}
  function changeRate(){speed=Number(rate.value);elapsed=0;lastTick=performance.now();}
  function imageError(e){if(e.target.matches?.('.ex-item-icon'))e.target.hidden=true;}
  container.addEventListener('click',handleClick);container.addEventListener('error',imageError,true);
  scrub.addEventListener('input',seek);rate.addEventListener('change',changeRate);
  play.disabled=end<=min;scrub.disabled=end<=min;
  select(0);
  return ()=>{stop();container.removeEventListener('click',handleClick);container.removeEventListener('error',imageError,true);scrub.removeEventListener('input',seek);rate.removeEventListener('change',changeRate);for(const media of container.querySelectorAll('video,model-viewer'))media.pause?.();container.replaceChildren();};
}
