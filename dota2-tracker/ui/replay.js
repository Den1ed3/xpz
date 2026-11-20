// The replay exporter serialises Steam64 IDs as JSON numbers. Preserve their
// decimal spelling before JavaScript can round them above Number.MAX_SAFE_INTEGER.
export function readMatchFile(text) {
  const data = JSON.parse(text.replace(/("steamAccountId"\s*:\s*)(\d{16,})(?=\s*[,}])/g, '$1"$2"'))
  const match = data.match ?? data
  if (match.match_id) return match
  if (!Array.isArray(match.players) || typeof match.didRadiantWin !== 'boolean') {
    throw new Error('Choose an OpenDota match JSON or a JSON export from dota-replay-parser.')
  }
  const nextSlot = [0, 128]
  const players = match.players.filter(p => p.heroId > 0).map(p => {
    if (typeof p.isRadiant !== 'boolean') throw new Error('The replay is missing team assignments.')
    const steam = BigInt(p.steamAccountId || 0)
    const account = steam >= 76561197960265728n ? steam - 76561197960265728n : steam
    const fields = {
      account_id: account > 0n && account < 4294967295n ? Number(account) : null,
      player_slot: nextSlot[p.isRadiant ? 0 : 1]++, hero_id: p.heroId,
      kills:p.kills, deaths:p.deaths, assists:p.assists, net_worth:p.networth,
      gold_per_min:p.goldPerMinute, xp_per_min:p.experiencePerMinute,
      last_hits:p.numLastHits, denies:p.numDenies, level:p.level, hero_damage:p.heroDamage,
      hero_healing:p.heroHealing, tower_damage:p.towerDamage,
      purchase_log:p.stats?.itemPurchases?.map(item=>({
        time:Math.floor(item.time), key:(item.itemName || '').replace(/^item_/, '') || 'item_'+item.itemId, item_id:item.itemId
      })),
      skill_build:p.stats?.skillBuild?.map(s=>({time:Math.floor(s.time), key:s.abilityName, hero_level:s.heroLevel})),
      inventory_snapshots:inventoryChanges(p.stats?.inventory),
      gold_t:p.stats?.goldPerMinute, xp_t:p.stats?.experiencePerMinute
    }
    for(let i=0;i<6;i++) fields['item_'+i]=p['item'+i+'Id']??0
    return fields
  })
  return {match_id:match.id, start_time:match.startDateTime||match.hornDateTime, duration:match.durationSeconds,
    position_track:match.positionTrack?.filter((r,i,a)=>i===0||Math.floor(r.t/5)>Math.floor(a[i-1].t/5)),
    radiant_win:match.didRadiantWin, lobby_type:match.lobbyType, game_mode:match.gameMode,
    radiant_gold_adv:match.radiantNetworthLeads, radiant_xp_adv:match.radiantExperienceLeads, players}
}

function inventoryChanges(events){
 if(!Array.isArray(events))return;
 const slots=Array(6).fill(0), snapshots=[];
 for(const e of events){
   if(!Number.isInteger(e.s)||e.s<0||e.s>5||!Number.isFinite(e.t))continue;
   const key=e.item?.replace(/^item_/,'')||0;
   if(slots[e.s]===key && snapshots.length)continue;
   slots[e.s]=key;
   const time=Math.floor(e.t);
   if(snapshots.at(-1)?.time===time)snapshots.at(-1).items=slots.slice();
   else snapshots.push({time,items:slots.slice()});
 }
 return snapshots;
}
