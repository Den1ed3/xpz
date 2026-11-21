import {extractMatch, enrich} from './match-schema.js';
const api='https://api.github.com';
const repo=api+'/repos/Den1ed3/xpz';
const file=repo+'/contents/dota2-tracker/matches.bin';
async function decode(bytes){
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
}
export async function readTournament(){
  const r=await fetch(new URL('./matches.bin',import.meta.url),{cache:'no-cache'});
  if(!r.ok)throw Error('Could not load tournament data.');
  return decode(await r.arrayBuffer());
}
function asBase64(bytes){
  let data='';
  for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(data);
}
export async function publishMatch(body,token){
  async function request(url,opts={}){
    const r=await fetch(url,{...opts,cache:'no-store',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',...opts.headers}});
    if(r.status===409 || r.status===422)throw Error('The repository changed or rejected this update. Retry the import.');
    if(!r.ok)throw Error('GitHub could not authorize or complete the import ('+r.status+'). Check the token, its repository and Contents permission.');
    return r.json();
  }
  const user=await request(api+'/user');
  if(user.id!==88418391)throw Error('Only the XPZ organizer can publish matches.');
  let raw=body.match;
  if(!raw){
    if(!/^[1-9]\d{0,14}$/.test(body.id))throw Error('Enter a numeric match ID.');
    const r=await fetch('https://api.opendota.com/api/matches/'+body.id);
    if(!r.ok)throw Error('OpenDota could not return this match. Choose its .dem replay instead.');
    raw=await r.json();
    if(String(raw.match_id)!==body.id)throw Error('The lookup returned a different match.');
  }
  const match=extractMatch(raw);
  const current=await request(file+'?ref=main');
  const blob=current.content?current:await request(repo+'/git/blobs/'+current.sha);
  const matches=await decode(Uint8Array.from(atob(blob.content),c=>c.charCodeAt(0)));
  const index=matches.findIndex(m=>m.match_id===match.match_id);
  if(index>=0)matches[index]=enrich(matches[index],match);
  else matches.unshift(match);
  const zipped=await new Response(new Blob([JSON.stringify(matches)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  await request(file,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({branch:'main',sha:current.sha,message:'Import XPZ match '+match.match_id,content:asBase64(new Uint8Array(zipped))})});
  return {match,matches};
}
