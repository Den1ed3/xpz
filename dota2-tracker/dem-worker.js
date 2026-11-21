import './dem-vendor/deadem-dota2-5.0.0.js';
import {heroIDs,itemIDs} from './dem-catalog.js';
const {Parser,ParserConfiguration,DemoPacketType,MessagePacketType,InterceptorStage}=globalThis.deadem.dota2;
const pad=i=>String(i).padStart(4,'0');
const field=(entity,key)=>entity?.getField(key);
const readEntity=(demo,handle)=>Number.isInteger(handle)?demo.getEntityByHandle(handle):null;
const safeName=(demo,entity)=>{
 if(!entity)return '';
 const idx=field(entity,'m_pEntity.m_nameStringTableIndex');
 return Number.isInteger(idx)?demo.stringTableContainer.getByName('EntityNames')?.getEntryById(idx)?.key||'':'';
};
function changed(rows,entry,key){
 if(JSON.stringify(rows.at(-1)?.[key])!==JSON.stringify(entry[key]))rows.push(entry);
}
export async function extractReplay(file,report=()=>{}){
 const parser=new Parser(new ParserConfiguration({messagePacketTypes:[MessagePacketType.SVC_PACKET_ENTITIES,MessagePacketType.DOTA_UM_COMBAT_LOG_DATA_HLTV]})),demo=parser.getDemo();
 const roster=new Map(),track=[],gold=[],xp=[];
 // Combat-log PURCHASE entries identify the buyer and item by string-table index.
 const purchases=new Map();
 let gameStart;
 parser.registerPostInterceptor(InterceptorStage.MESSAGE_PACKET,(_,message)=>{
   if(message.type!==MessagePacketType.DOTA_UM_COMBAT_LOG_DATA_HLTV)return;
   const entry=message.data;
   if(entry.type!==11 || !Number.isFinite(entry.timestamp))return;
   const names=demo.stringTableContainer.getByName('CombatLogNames');
   const buyer=names?.getEntryById(entry.targetName)?.key;
   const item=names?.getEntryById(entry.value)?.key;
   if(!buyer?.startsWith('npc_dota_hero_') || !item?.startsWith('item_'))return;
   if(!purchases.has(buyer))purchases.set(buyer,[]);
   purchases.get(buyer).push({key:item.slice(5),time:entry.timestamp});
 });
 let info,startTick=0,lastTick=-1e6,lastTime=-1,endTime=0,lastMinute=-1;
 parser.registerPostInterceptor(InterceptorStage.DEMO_PACKET,packet=>{
   if(packet.is(DemoPacketType.DEM_FILE_HEADER))startTick=packet.data.serverStartTick||0;
   if(packet.is(DemoPacketType.DEM_FILE_INFO))info=packet.data;
 });
 parser.registerPostInterceptor(InterceptorStage.ENTITY_PACKET,packet=>{
   if(packet.tick-lastTick<30)return;
   lastTick=packet.tick;
   const rules=demo.getEntitiesByClassName('CDOTAGamerulesProxy')[0];
   const rule=k=>field(rules,'m_pGameRules.'+k);
   const start=rule('m_flGameStartTime');if(!(start>0))return;gameStart=start;
   const end=rule('m_flGameEndTime');if(end>start)endTime=Math.round(end-start);
   const tick=rule('m_bGamePaused')?rule('m_nPauseStartTick'):packet.tick+startTick;
   const time=Math.floor((tick-(rule('m_nTotalPausedTicks')||0))*(demo.server?.tickInterval||1/30)-start);
   if(time<0 || time<=lastTime || endTime&&time>endTime+2)return;
   const sample=lastTime<0 || time-lastTime>=3 || endTime>0;
   if(!sample)return;
   lastTime=time;
   const resource=demo.getEntitiesByClassName('CDOTA_PlayerResource')[0];
   const coords=Array(20).fill(-1);
   const minute=Math.floor(time/60), net=[], earnedXP=[];
   for(const ctrl of demo.getEntitiesByClassName('CDOTAPlayerController')){
     const side=field(ctrl,'m_iTeamNum'),pid=field(ctrl,'m_nPlayerID');
     if(![2,3].includes(side)||!Number.isInteger(pid)||pid<0||pid>63)continue;
     const score=k=>field(resource,'m_vecPlayerTeamData.'+pad(pid)+'.'+k);
     const slot=score('m_iTeamSlot'),heroID=score('m_nSelectedHeroID');if(!(heroID>0)||!(slot>=0&&slot<=4))continue;
     const idx=slot+(side===3?5:0),player_slot=slot+(side===3?128:0);
     let p=roster.get(idx);
     if(!p){p={hero_id:heroID,player_slot,inventory_snapshots:[],skill_snapshots:[]};roster.set(idx,p)}
     const team=demo.getEntitiesByClassName(side===2?'CDOTA_DataRadiant':'CDOTA_DataDire')[0];
     const stat=k=>field(team,'m_vecDataTeam.'+pad(slot)+'.'+k);
     const values={kills:score('m_iKills'),deaths:score('m_iDeaths'),assists:score('m_iAssists'),level:score('m_iLevel'),last_hits:stat('m_iLastHitCount'),denies:stat('m_iDenyCount'),total_gold:stat('m_iTotalEarnedGold'),total_xp:stat('m_iTotalEarnedXP'),net_worth:stat('m_iNetWorth'),hero_damage:stat('m_flHeroDamage'),tower_damage:stat('m_flTowerDamage'),hero_healing:stat('m_fHealing')};
     for(const [k,v] of Object.entries(values))if(Number.isFinite(v))p[k]=Math.round(v);
     net[idx]=p.net_worth;earnedXP[idx]=p.total_xp;
     const hero=readEntity(demo,score('m_hSelectedHero'))||readEntity(demo,field(ctrl,'m_hAssignedHero'));
     if(!hero)continue;
     const cell=k=>field(hero,'CBodyComponent.m_skeletonInstance.m_vecOrigin.m_cell'+k)??field(hero,'CBodyComponent.m_cell'+k);
     if(field(hero,'m_lifeState')===0 && Number.isFinite(cell('X')) && Number.isFinite(cell('Y'))){coords[2*idx]=cell('X');coords[2*idx+1]=cell('Y')}
     const items=Array.from({length:6},(_,i)=>{
       const handle=field(hero,'m_Inventory.m_hItems.'+pad(i));
       if(handle===16777215)return 0;
       const item=readEntity(demo,handle);if(!item)return null;
       const key=safeName(demo,item).replace(/^item_/,'');
       return itemIDs[key]??(key||null);
     });
     changed(p.inventory_snapshots,{time,items},'items');
     const skills=[];
     for(let i=0;i<32;i++){
       const a=readEntity(demo,field(hero,'m_vecAbilities.'+pad(i))),level=field(a,'m_iLevel');
       if(!(level>0))continue;
       const key=safeName(demo,a)||a.class.name.replace(/^CDOTA_Ability_/,'').toLowerCase();
       if(/^[a-z0-9_]+$/i.test(key))skills.push({key,level});
     }
     if(skills.length)changed(p.skill_snapshots,{time,skills},'skills');
   }
   if(track.length===0||time-track.at(-1).t>=5)track.push({t:time,p:coords});
   if(minute>lastMinute&&roster.size===10){
     const advantage=vals=>vals.length===10&&Array.from(vals).every(Number.isFinite)?vals.reduce((a,v,i)=>a+(i<5?v:-v),0):null;
     gold[minute]=advantage(net);xp[minute]=advantage(earnedXP);lastMinute=minute;
   }
 });
 let read=0,progress=-1;
 const stream=file.stream().pipeThrough(new TransformStream({transform(chunk,controller){
   controller.enqueue(chunk);read+=chunk.byteLength;
   const pct=Math.min(99,Math.floor(100*read/file.size));
   if(pct>progress){report('Reading replay · '+pct+'%');progress=pct}
 }}));
 await parser.parse(stream);
 const meta=info?.gameInfo?.dota;
 if(!meta || ![2,3].includes(meta.gameWinner)||!(endTime>0)|| !roster.size)throw Error('The replay is incomplete or its format is unsupported.');
 const players=[];
 for(const p of roster.values()){
   const sameTeam=meta.playerInfo.filter(h=>h.gameTeam===(p.player_slot<128?2:3));
   const who=sameTeam.find(h=>heroIDs[h.heroName?.replace(/^npc_dota_hero_/,'')]===p.hero_id);
   if(who){
     const log=purchases.get(who.heroName);
     if(log && meta.playerInfo.filter(h=>h.heroName===who.heroName).length===1){
       p.purchase_log=log.map(e=>({key:e.key,time:Math.floor(e.time-gameStart)}));
     }
     p.personaname=who.playerName;
     const steam=BigInt(who.steamid||0)-76561197960265728n;
     if(steam>0n&&steam<4294967295n)p.account_id=Number(steam);
   }
   if(Number.isFinite(p.total_gold))p.gold_per_min=Math.floor(p.total_gold*60/endTime);
   if(Number.isFinite(p.total_xp))p.xp_per_min=Math.floor(p.total_xp*60/endTime);
   p.inventory_snapshots.at(-1)?.items.forEach((v,i)=>{if(Number.isInteger(v))p['item_'+i]=v});
   players.push(p);
 }
 return {match_id:Number(meta.matchId),radiant_win:meta.gameWinner===2,duration:endTime,start_time:meta.endTime?Math.floor(meta.endTime-endTime):undefined,game_mode:meta.gameMode,players,position_track:track,
   radiant_gold_adv:gold,radiant_xp_adv:xp};
}
if(typeof WorkerGlobalScope!=='undefined' && self instanceof WorkerGlobalScope){
 self.onmessage=async({data:file})=>{
   try{self.postMessage({match:await extractReplay(file,progress=>self.postMessage({progress}))})}
   catch(e){self.postMessage({error:'Replay import failed. '+(e.message||'Check the replay is fully downloaded.')})}
 };
}
