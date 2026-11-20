// Illustrative tournament only. The account IDs and match IDs are local demo identifiers.
const names = ['Afterglow', 'Ironbark', 'Echo', 'Mochi', 'Moonbeam', 'Rook', 'Kestrel', 'Lantern', 'Zephyr', 'Atlas', 'River', 'Wisp', 'Orbit', 'Solstice'];
const abilities = {
  2: [5009,5008,5007,5010], 5: [5127,5126,5128,5129], 6: [5019,343,5632,5022],
  8: [5028,5029,5027,5030], 13: [5069,5071,5072,5073], 18: [5095,5094,5096,5097],
  26: [5044,5045,5046,5047], 27: [5078,5080,5079,5081], 29: [5120,5119,5118,5121],
  31: [5134,5136,7325,5137], 35: [5154,5155,5156,5157], 44: [5190,5191,5192,5193],
  74: [5370,5371,5372], 86: [5450,5448,5451,5452], 97: [5519,5518,5520,5521]
};
const items = {
  1:'blink',16:'branches',29:'boots',36:'magic_wand',37:'ghost',44:'tango',48:'travel_boots',
  50:'phase_boots',63:'power_treads',98:'orchid',100:'cyclone',102:'force_staff',108:'ultimate_scepter',
  112:'assault',114:'heart',116:'black_king_bar',119:'shivas_guard',127:'blade_mail',139:'butterfly',
  141:'greater_crit',145:'bfury',147:'manta',156:'satanic',158:'mjollnir',180:'arcane_boots',
  214:'tranquil_boots',231:'guardian_greaves',232:'aether_lens',235:'octarine_core',242:'crimson_guard',
  254:'glimmer_cape',263:'hurricane_pike',273:'kaya_and_sange'
};
const inventories = {
  mid:[48,1,100,273,235,108], carry:[63,145,147,116,139,156], ranged:[63,263,147,139,141,116],
  support:[180,36,254,102,232,37], frontline:[50,1,127,116,112,114]
};
const role = {2:'frontline',5:'support',6:'ranged',8:'carry',13:'mid',18:'carry',26:'support',
  27:'support',29:'frontline',31:'support',35:'ranged',44:'carry',74:'mid',86:'support',97:'frontline'};

function teamMember([name, hero, kills, deaths, assists, gpm, xpm], slot, duration) {
  const position = role[hero];
  const inventory = inventories[position].slice(0, gpm > 650 ? 6 : gpm > 490 ? 5 : 4);
  const ability = abilities[hero];
  const order = hero === 74 ? [0,1,0,1,0,1,0,1,0,2,1,2] : [0,1,0,2,0,3,0,1,1,1,2,3,2,2];
  const minutes = duration / 60;
  const purchase_log = [{time:-35,key:'tango'},{time:-34,key:'branches'},{time:155,key:'boots'}];
  inventory.forEach((id,i) => purchase_log.push({
    time: Math.round((duration - 80) * (i + 1) / (inventory.length + 0.4)), key:items[id]
  }));
  // These authored snapshots illustrate slot changes independently of the purchase log.
  const slots = [44,16,0,0,0,0];
  const inventory_snapshots = [{time:0, items:[...slots]}];
  slots[0] = 0; inventory_snapshots.push({time:125,items:[...slots]});
  slots[0] = 29; inventory_snapshots.push({time:165,items:[...slots]});
  inventory.forEach((id,i)=>{
    slots[i] = id;
    inventory_snapshots.push({time:purchase_log[3+i].time+8,items:[...slots]});
  });
  const levelTimes = [0,92,165,245,352,450,554,660,799,920,1060,1228,1390,1570];
  const skill_build = order.map((key,i)=>({
    time: Math.max(0,Math.round(levelTimes[i]*620/xpm)), key:ability[key], hero_level:i+1
  }));
  const support = position === 'support';
  return {
    account_id: 800000 + name, personaname:names[name], hero_id:hero, player_slot:slot,
    isRadiant:slot < 128, kills, deaths, assists, gold_per_min:gpm, xp_per_min:xpm,
    total_gold:Math.round(minutes*gpm), net_worth:Math.round(minutes*gpm*(support ? 0.68 : 0.85)),
    last_hits:Math.round(minutes*(support ? 1.35 : 5.4) + kills*2),
    denies:2+(name*3+slot)%14, hero_damage:kills*1480+assists*570+gpm*7,
    tower_damage:Math.round(gpm*(support ? 1.9 : 6.7)), hero_healing:support ? 620+assists*62 : 0,
    obs_placed:support ? 8+name%6 : name%3, sen_placed:support ? 11+name%7 : 0,
    level:Math.min(30,Math.round(11+xpm/55)), ability_upgrades_arr:order.map(i=>ability[i]),
    inventory_snapshots, skill_build, purchase_log, ...Object.fromEntries(Array.from({length:6},(_,i)=>['item_'+i,inventory[i]||0]))
  };
}

function minuteSeries(anchors, minutes) {
  return Array.from({length:minutes+1},(_,minute) => {
    const scaled = minute*(anchors.length-1)/minutes;
    const i = Math.floor(scaled);
    const next = anchors[Math.min(i+1,anchors.length-1)];
    return Math.round(anchors[i]+(next-anchors[i])*(scaled-i));
  });
}

// Authored map routes for the sample lobby. Live imports never use these paths.
function demoTrack(seed, players, duration, radiantWin) {
  const home = [[79,81],[174,172]];
  const lanes = [[84,141],[126,126],[151,88]];
  const routes = players.map((player, index)=>{
    const dire = index >= 5 ? 1 : 0, side = dire ? -1 : 1;
    const slot = index % 5;
    const laneIndex = role[player.hero_id] === 'mid' ? 1 : (slot + seed) % 2 * 2;
    const [lx,ly] = lanes[laneIndex];
    const dx = (slot-2)*2, dy = slot%2*3;
    const spawn = home[dire];
    const laneArrival = [lx+dx-side*3,ly+dy-side*3];
    const laneApproach = laneIndex === 1 ? [spawn[0]+side*20,spawn[1]+side*20] :
      laneIndex === 0 ? [lx+dx,spawn[1]+side*20] : [spawn[0]+side*20,ly+dy];
    const target = home[radiantWin ? 1 : 0];
    const variations = seed*2;
    return [[0,...spawn],[.035,...laneApproach],[.09,...laneArrival],[.20,lx+dx+side*6,ly+dy],
      [.26,113+dx+side*5,137+dy],[.32,...laneArrival],[.41,137+dx+side*4,119+dy],
      [.47,145+dx,110+dy+variations],[.55,109+dx,146+dy],[.63,lx+dx,ly+dy],
      [.72,134+dx,126+dy],[.81,143+dx+side*3,131+dy-variations],
      [.90,128+dx,130+dy],[1,target[0]+dx+(radiantWin?-8:8),target[1]+dy]];
  });
  const frames = [];
  for(let t=0;t<=duration;t=Math.min(duration,t+5)){
    const fraction = t/duration;
    const p = routes.flatMap((route,i)=>{
      // Simulated missing/dead intervals exercise the same UI as real tracking.
      const cycle = (t + i*57 + seed*9) % (466 + i*13);
      if (t>420 && t<duration-90 && cycle<19+i) return [-1,-1];
      const next = route.findIndex(v=>v[0]>=fraction);
      const a = route[Math.max(0,next-1)], b = route[next];
      const ratio = (fraction-a[0])/(b[0]-a[0]||1);
      return [1,2].map((axis)=>Math.round(a[axis]+(b[axis]-a[axis])*ratio+
        Math.sin(t/(23+i*2)+axis*2+i)*1.5));
    });
    frames.push({t,p});
    if(t===duration) break;
  }
  return frames;
}

function game(id, day, duration, radiantWin, rows, gold, xp) {
  const players = rows.map((row,i) => teamMember(row,i<5 ? i : i+123,duration));
  const kills = team => team.reduce((n,p)=>n+p.kills,0);
  return {
    demo:true, match_id:99000000000+id, start_time:Date.UTC(2026,10,day,11,30)/1000,
    duration, radiant_win:radiantWin, radiant_score:kills(players.slice(0,5)),
    dire_score:kills(players.slice(5)), players, position_track:demoTrack(id,players,duration,radiantWin),
    radiant_gold_adv:minuteSeries(gold,Math.floor(duration/60)),
    radiant_xp_adv:minuteSeries(xp,Math.floor(duration/60))
  };
}

export const sampleMatches = [
  game(3,20,2874,false,[
    [8,6,12,8,9,712,801],[5,74,9,7,16,624,754],[9,18,6,8,12,571,682],
    [4,5,4,8,20,380,485],[11,31,3,5,17,364,453],
    [0,13,16,3,15,805,932],[3,44,10,7,10,729,810],[12,35,4,7,11,543,644],
    [13,27,2,9,20,395,530],[1,29,4,8,17,503,669]
  ],[0,400,1300,-800,1700,380,-1350,2400,1100,-740,-3300],
    [0,250,1100,-650,1300,-40,-850,1750,820,-690,-2800]),
  game(2,18,2436,true,[
    [3,44,12,3,9,742,824],[0,13,15,2,15,812,930],[1,97,5,5,21,565,680],
    [10,27,3,7,20,393,520],[11,31,2,5,16,365,470],
    [12,35,7,8,10,623,715],[8,8,6,6,8,615,701],[2,86,2,9,14,382,492],
    [6,2,5,7,13,534,641],[7,26,2,7,12,357,470]
  ],[0,-120,550,1400,300,2400,5100,4200,6500,8900,10800],
    [0,-200,450,1050,640,2200,3500,3900,5250,7200,9200]),
  game(1,16,2578,false,[
    [0,13,11,5,8,685,798],[1,97,4,6,13,501,602],[2,86,2,8,16,376,482],
    [3,8,6,5,9,633,719],[4,5,1,7,12,337,440],
    [5,74,9,4,15,718,849],[6,2,6,6,14,573,669],[7,26,3,6,17,399,512],
    [8,6,10,3,10,744,840],[9,18,3,5,14,543,641]
  ],[0,450,1300,800,2100,120,-1700,-2200,-5200,-6800,-9700],
    [0,200,700,500,1600,-300,-1300,-1550,-3450,-5600,-8300])
];
