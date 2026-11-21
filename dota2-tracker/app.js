import {readTournament, publishMatch} from './github-store.js';
import {summary,graph,matchView,playersView,bindPlayerBoard,heroTable} from './stats.js';
import {heroName,heroPortrait,heroShowcase,hydrateHeroes,switchHeroShowcase} from './heroes.js';
import {mountExplorer} from './explorer.js';
import {mountPlayback} from './playback.js';
import {sampleMatches} from './sample.js';
import {readMatchFile} from './replay.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => Number.isFinite(n) ? Math.round(n).toLocaleString() : '—';
const time = s => Number.isFinite(s) ? Math.floor(s/60)+':'+String(s%60).padStart(2,'0') : '—';
const date = s => s ? new Date(s*1000).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : 'Date unavailable';
const section = (title,link='',label='View all') => '<div class="sectionhead"><h2>'+title+'</h2>'+(link?'<a href="#'+link+'">'+label+'</a>':'')+'</div>';
const label = m => String(m.match_id);
const result = m => m.radiant_win===true?'Radiant victory':m.radiant_win===false?'Dire victory':'Result unavailable';
let live=[],loadError='';
let capabilities={}, expanded=null, disposeReplay=null;
const currentMatches=()=>live.length?live:sampleMatches;
const getMatch=id=>currentMatches().find(m=>String(m.match_id)===id);
const hasTrack=m=>Array.isArray(m.position_track)&&m.position_track.length>0;

function recent(matches,expandable=false) {
 const headers=['Match ID','Result','Score','Duration','Winning lineup','Played'];
 if(expandable) headers.push('Replay');
 const rows=matches.map(m=>{
   const id=esc(m.match_id);
   const link='<a class="id" href="#match/'+id+'">'+esc(label(m))+'</a>';
   const expand=expandable?'<button class="row-toggle" type="button" data-expand="'+id+'" aria-expanded="false" aria-controls="details-'+id+'" aria-label="Show lineups for match '+id+'"><span aria-hidden="true">▸</span></button>':'';
   const watch=expandable?(hasTrack(m)?'<td><a class="watch-link" href="#replay/'+id+'">Watch replay</a></td>':'<td><span class="meta" title="Import a replay with recorded hero positions to enable playback">No position data</span></td>'):'';
   const lineup=m.players.filter(p=>(p.player_slot<128)===m.radiant_win).map(p=>'<img src="'+heroPortrait(p.hero_id)+'" alt="'+esc(heroName(p.hero_id))+'" title="'+esc(heroName(p.hero_id))+'">').join('');
   return '<tr'+(expandable?' data-match-row="'+id+'"':'')+'><td>'+expand+link+'</td><td><span class="chip '+(m.radiant_win?'':'dire')+'">'+result(m)+'</span></td>'+
     '<td><b class="r">'+num(m.radiant_score)+'</b> : <b class="d">'+num(m.dire_score)+'</b></td><td>'+time(m.duration)+'</td><td><div class="thumbs">'+lineup+'</div></td>'+
     '<td class="meta">'+date(m.start_time)+'</td>'+watch+'</tr>'+
     (expandable?'<tr hidden class="match-drop" id="details-'+id+'"><td colspan="'+headers.length+'"><div data-explorer></div></td></tr>':'');
 }).join('');
 return '<div class="panel scroll"><table class="recent"><thead><tr>'+headers.map(v=>'<th scope="col">'+v+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function closeRow(){
 if(!expanded)return;
 expanded.dispose?.();
 expanded.row.hidden=true;
 expanded.host.replaceChildren();
 expanded.toggle.setAttribute('aria-expanded','false');
 expanded=null;
}
$('#app').addEventListener('click',event=>{
 const row=event.target.closest('[data-match-row]');
 if(!row || event.target.closest('a'))return;
 const toggle=row.querySelector('[data-expand]');
 const detail=document.getElementById(toggle.getAttribute('aria-controls'));
 const wasOpen=!detail.hidden;
 closeRow();
 if(wasOpen)return;
 const match=getMatch(row.dataset.matchRow);
 if(!match)return;
 detail.hidden=false;
 toggle.setAttribute('aria-expanded','true');
 const host=detail.querySelector('[data-explorer]');
 expanded={row:detail,host,toggle,dispose:mountExplorer(host,match)};
});
let selectedHeroId;
let spotlightHeroes=[];
function spotlightParts(heroes,active) {
 const rank=heroes.indexOf(active)+1;
 const winRate=hero=>hero.winRate==null?'—':num(hero.winRate)+'%';
 const alternatives=heroes.map((hero,index)=>{
   if(hero.id===active.id)return '';
   return '<button type="button" class="secondaryhero" data-select-hero="'+Number(hero.id)+'" aria-label="Feature '+esc(hero.name)+', rank '+(index+1)+'">'+
     '<span class="pos">0'+(index+1)+'</span><img src="'+heroPortrait(hero.id)+'" alt=""><span><b>'+esc(hero.name)+'</b><small>'+
     hero.games+' picks · '+winRate(hero)+' win rate</small></span></button>';
 }).join('');
 const details='<div class="pos">0'+rank+' / '+(rank===1?'Most picked':'Pick rank')+'</div>'+
   '<h3 tabindex="-1">'+esc(active.name)+'</h3><p>'+active.games+' picks · '+winRate(active)+' win rate</p>'+
   '<div class="meta">'+num(active.gpm)+' avg GPM · '+num(active.xpm)+' avg XPM</div>';
 return {details,alternatives};
}
function spotlight(heroes) {
 const active=heroes.find(hero=>hero.id===selectedHeroId) || heroes[0];
 const {details,alternatives}=spotlightParts(heroes,active);
 return '<article class="herocard"><div data-hero-details>'+details+'</div>'+heroShowcase(active.id)+'</article><div data-hero-choices>'+alternatives+'</div>';
}
$('#app').addEventListener('click',async event=>{
 const choice=event.target.closest('[data-select-hero]');
 if(!choice)return;
 const active=spotlightHeroes.find(hero=>hero.id===Number(choice.dataset.selectHero));
 const stage=choice.closest('#spotlight');
 if(!active || !stage)return;
 const committed=await switchHeroShowcase(stage.querySelector('[data-showcase]'),active.id);
 if(!committed || !stage.isConnected)return;
 selectedHeroId=active.id;
 const {details,alternatives}=spotlightParts(spotlightHeroes,active);
 stage.querySelector('[data-hero-details]').innerHTML=details;
 stage.querySelector('[data-hero-choices]').innerHTML=alternatives;
 stage.querySelector('h3').focus({preventScroll:true});
});
function overview(s) {
 const m=s.featuredMatch,p=s.featuredPlayer,hs=s.heroes.slice(0,4),top=hs[0];
 spotlightHeroes=hs;
 if(!m)return '';
 const features='<div class="features"><article class="feature"><div class="kicker"><i></i>Featured match</div><h2 class="headline">'+result(m)+'</h2><div class="score"><span class="r">'+num(m.radiant_score)+'</span> : <span class="d">'+num(m.dire_score)+'</span></div><div class="meta">'+esc(label(m))+' &nbsp;·&nbsp; '+time(m.duration)+' &nbsp;·&nbsp; '+date(m.start_time)+'</div><a class="textlink" href="#match/'+encodeURIComponent(m.match_id)+'">View match report</a></article>'+(p?'<a class="spot" href="#player/'+p.id+'" style="--portrait:url('+heroPortrait(p.heroId)+')"><div class="kicker">★ Featured player</div><h2 class="pname">'+esc(p.name)+'</h2><div class="meta">'+esc(heroName(p.heroId))+' · Most played hero</div><div class="spotstats">'+[['KDA',p.kda?.toFixed(2)??'—'],['Win rate',num(p.winRate)+'%'],['MVPs',p.mvps]].map(([k,v])=>'<div><strong>'+v+'</strong><span class="cap">'+k+'</span></div>').join('')+'</div></a>':'<div class="panel empty">Player profiles appear when a match includes public account IDs.</div>')+'</div>';
 const heroes=top ? section('Hero spotlight','matches','All hero stats')+
   '<div class="heroesgrid" id="spotlight">'+spotlight(hs)+'</div>' : '';

 return features+section('Recent matches','matches','View all matches')+recent(s.matches.slice(0,4))+heroes+section('Featured match advantage')+graph(m);
}
function render(){
 closeRow();
 disposeReplay?.();disposeReplay=null;
 const matches=live.length?live:sampleMatches,s=summary(matches);
 const [page='overview',id]=location.hash.slice(1).split('/');
 const area=page==='replay'||page.startsWith('match')?'matches':page.startsWith('player')?'players':'overview';
 const heading=page==='replay'?'Tactical replay':page==='match'?'Match report':page==='player'?'Player profile':area==='matches'?'Recent matches':area==='players'?'Player statistics':'Tournament overview';
 document.title=heading+' · XPZ Dota 2 Tracker';
 const top='<div class="pagehead"><div><div class="eyebrow">Dota 2 &nbsp;/&nbsp; XPZ in-house tracker</div><h1>'+heading+'</h1></div><span class="badge">'+(live.length?'Tournament':'Demo league')+' · '+s.matches.length+' matches</span></div>';
 let content;
 if(page==='match'){
   // Keep links shared from the first demo review usable.
   const matchId=!live.length && /^demo-[123]$/.test(id) ? String(99000000000+Number(id.slice(-1))) : id;
   const match=getMatch(matchId);
   const reportNav=match?'<p class="replay-nav"><a href="#matches/'+match.match_id+'">Explore lineups and builds</a>'+
     (hasTrack(match)?' · <a href="#replay/'+match.match_id+'">Watch replay</a>':'')+'</p>':'';
   content=reportNav+matchView(match);
 }
 else if(page==='replay')content='<p class="replay-nav"><a href="#matches">Recent matches</a> · <a href="#match/'+esc(encodeURIComponent(id))+'">Match report</a></p><div id="playback"></div>';
 else if(area==='matches')content=recent(s.matches,true)+heroTable(matches);
 else if(area==='players')content=playersView(matches,id);
 else content=overview(s);
 $('#app').innerHTML=top+(loadError?'<p class="notice">'+esc(loadError)+'</p>':'')+content;
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash==='#'+area));
 if(page==='matches' && /^\d+$/.test(id||''))$('#app').querySelector('[data-expand="'+id+'"]')?.click();
 if(page==='replay'){
   const match=getMatch(id);
   if(match)disposeReplay=mountPlayback($('#playback'),match);
   else $('#playback').textContent='This match is unavailable.';
 }
 if(area==='players' && !id)bindPlayerBoard($('#app'),matches);
 hydrateHeroes();
}
async function refresh(){
 try{const data={matches:await readTournament()};if(!Array.isArray(data.matches))throw Error();live=data.matches;capabilities=data.capabilities||{};loadError='';}
 catch{loadError='Could not load the tournament. '+(live.length?'Showing the last loaded matches.':'Showing the demo league.');}
 render();
}
$('#openimport').onclick=()=>{
 if(!importing)$('#message').textContent='';
 $('#parse-location').textContent=capabilities.nativeReplayUpload?'The server processes the replay and saves the match.':'Your browser reads the replay. GitHub saves the match stats and publishes the update.';
 $('#dialog').showModal();
};
let importing=false;
async function importMatch(work){
 if(importing)return;
 importing=true;
 const controls=[$('#matchid'),$('#lookup button'),$('#upload')];
 controls.forEach(el=>el.disabled=true);
 const status=message=>{$('#message').textContent=message};
 status('Importing match…');
 try{
   const token=$('#gh-token').value.trim();
   if(!token)throw Error('Enter your organizer GitHub token first.');
   const response=await work(status);
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Import failed. Please try again.');
   live=result.matches;loadError='';render();
   location.hash='match/'+result.match.match_id;
   $('#gh-token').value='';
   $('#dialog').close();
 }catch(error){status(error.message||'The replay could not be read.');}
 finally{importing=false;controls.forEach(el=>el.disabled=false);}
}
const saveMatch=async body=>Response.json(await publishMatch(body,$('#gh-token').value.trim()));
$('#lookup').onsubmit=e=>{e.preventDefault();importMatch(()=>saveMatch({id:$('#matchid').value.trim()}))};
$('#upload').onchange=async event=>{
 const input=event.target,file=input.files[0];
 if(!file)return;
 await importMatch(async status=>{
   if(/\.dem$/i.test(file.name)){
     status('Opening replay…');
     const {parseDem}=await import('./dem.js');
     const match=await parseDem(file,status);
     status('Saving match…');
     return saveMatch({match});
   }
   if(!/\.json$/i.test(file.name))throw Error('Choose a completed .dem or .json file. A .partial replay is still downloading.');
   if(file.size>160*1024*1024)throw Error('Choose a JSON file smaller than 160 MB.');
   return saveMatch({match:readMatchFile(await file.text())});
 });
 input.value='';
};
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});
refresh();
