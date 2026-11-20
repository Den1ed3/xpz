// Hero names and internal keys from OpenDota's dotaconstants. Artwork by Valve.
const catalog = {
  "1": ["Anti-Mage", "antimage"],
  "2": ["Axe", "axe"],
  "3": ["Bane", "bane"],
  "4": ["Bloodseeker", "bloodseeker"],
  "5": ["Crystal Maiden", "crystal_maiden"],
  "6": ["Drow Ranger", "drow_ranger"],
  "7": ["Earthshaker", "earthshaker"],
  "8": ["Juggernaut", "juggernaut"],
  "9": ["Mirana", "mirana"],
  "10": ["Morphling", "morphling"],
  "11": ["Shadow Fiend", "nevermore"],
  "12": ["Phantom Lancer", "phantom_lancer"],
  "13": ["Puck", "puck"],
  "14": ["Pudge", "pudge"],
  "15": ["Razor", "razor"],
  "16": ["Sand King", "sand_king"],
  "17": ["Storm Spirit", "storm_spirit"],
  "18": ["Sven", "sven"],
  "19": ["Tiny", "tiny"],
  "20": ["Vengeful Spirit", "vengefulspirit"],
  "21": ["Windranger", "windrunner"],
  "22": ["Zeus", "zuus"],
  "23": ["Kunkka", "kunkka"],
  "25": ["Lina", "lina"],
  "26": ["Lion", "lion"],
  "27": ["Shadow Shaman", "shadow_shaman"],
  "28": ["Slardar", "slardar"],
  "29": ["Tidehunter", "tidehunter"],
  "30": ["Witch Doctor", "witch_doctor"],
  "31": ["Lich", "lich"],
  "32": ["Riki", "riki"],
  "33": ["Enigma", "enigma"],
  "34": ["Tinker", "tinker"],
  "35": ["Sniper", "sniper"],
  "36": ["Necrophos", "necrolyte"],
  "37": ["Warlock", "warlock"],
  "38": ["Beastmaster", "beastmaster"],
  "39": ["Queen of Pain", "queenofpain"],
  "40": ["Venomancer", "venomancer"],
  "41": ["Faceless Void", "faceless_void"],
  "42": ["Wraith King", "skeleton_king"],
  "43": ["Death Prophet", "death_prophet"],
  "44": ["Phantom Assassin", "phantom_assassin"],
  "45": ["Pugna", "pugna"],
  "46": ["Templar Assassin", "templar_assassin"],
  "47": ["Viper", "viper"],
  "48": ["Luna", "luna"],
  "49": ["Dragon Knight", "dragon_knight"],
  "50": ["Dazzle", "dazzle"],
  "51": ["Clockwerk", "rattletrap"],
  "52": ["Leshrac", "leshrac"],
  "53": ["Nature's Prophet", "furion"],
  "54": ["Lifestealer", "life_stealer"],
  "55": ["Dark Seer", "dark_seer"],
  "56": ["Clinkz", "clinkz"],
  "57": ["Omniknight", "omniknight"],
  "58": ["Enchantress", "enchantress"],
  "59": ["Huskar", "huskar"],
  "60": ["Night Stalker", "night_stalker"],
  "61": ["Broodmother", "broodmother"],
  "62": ["Bounty Hunter", "bounty_hunter"],
  "63": ["Weaver", "weaver"],
  "64": ["Jakiro", "jakiro"],
  "65": ["Batrider", "batrider"],
  "66": ["Chen", "chen"],
  "67": ["Spectre", "spectre"],
  "68": ["Ancient Apparition", "ancient_apparition"],
  "69": ["Doom", "doom_bringer"],
  "70": ["Ursa", "ursa"],
  "71": ["Spirit Breaker", "spirit_breaker"],
  "72": ["Gyrocopter", "gyrocopter"],
  "73": ["Alchemist", "alchemist"],
  "74": ["Invoker", "invoker"],
  "75": ["Silencer", "silencer"],
  "76": ["Outworld Devourer", "obsidian_destroyer"],
  "77": ["Lycan", "lycan"],
  "78": ["Brewmaster", "brewmaster"],
  "79": ["Shadow Demon", "shadow_demon"],
  "80": ["Lone Druid", "lone_druid"],
  "81": ["Chaos Knight", "chaos_knight"],
  "82": ["Meepo", "meepo"],
  "83": ["Treant Protector", "treant"],
  "84": ["Ogre Magi", "ogre_magi"],
  "85": ["Undying", "undying"],
  "86": ["Rubick", "rubick"],
  "87": ["Disruptor", "disruptor"],
  "88": ["Nyx Assassin", "nyx_assassin"],
  "89": ["Naga Siren", "naga_siren"],
  "90": ["Keeper of the Light", "keeper_of_the_light"],
  "91": ["Io", "wisp"],
  "92": ["Visage", "visage"],
  "93": ["Slark", "slark"],
  "94": ["Medusa", "medusa"],
  "95": ["Troll Warlord", "troll_warlord"],
  "96": ["Centaur Warrunner", "centaur"],
  "97": ["Magnus", "magnataur"],
  "98": ["Timbersaw", "shredder"],
  "99": ["Bristleback", "bristleback"],
  "100": ["Tusk", "tusk"],
  "101": ["Skywrath Mage", "skywrath_mage"],
  "102": ["Abaddon", "abaddon"],
  "103": ["Elder Titan", "elder_titan"],
  "104": ["Legion Commander", "legion_commander"],
  "105": ["Techies", "techies"],
  "106": ["Ember Spirit", "ember_spirit"],
  "107": ["Earth Spirit", "earth_spirit"],
  "108": ["Underlord", "abyssal_underlord"],
  "109": ["Terrorblade", "terrorblade"],
  "110": ["Phoenix", "phoenix"],
  "111": ["Oracle", "oracle"],
  "112": ["Winter Wyvern", "winter_wyvern"],
  "113": ["Arc Warden", "arc_warden"],
  "114": ["Monkey King", "monkey_king"],
  "119": ["Dark Willow", "dark_willow"],
  "120": ["Pangolier", "pangolier"],
  "121": ["Grimstroke", "grimstroke"],
  "123": ["Hoodwink", "hoodwink"],
  "126": ["Void Spirit", "void_spirit"],
  "128": ["Snapfire", "snapfire"],
  "129": ["Mars", "mars"],
  "131": ["Ring Master", "ringmaster"],
  "135": ["Dawnbreaker", "dawnbreaker"],
  "136": ["Marci", "marci"],
  "137": ["Primal Beast", "primal_beast"],
  "138": ["Muerta", "muerta"],
  "145": ["Kez", "kez"],
  "155": ["Largo", "largo"],
};

const steam = 'https://cdn.cloudflare.steamstatic.com/apps/dota2';
const videoKeys = new Set(['puck', 'phantom_assassin', 'shadow_shaman', 'axe', 'rubick', 'magnataur', 'juggernaut']);
const modelKeys = new Set([...videoKeys, 'spectre', 'dark_willow', 'undying', 'invoker']);
const localAsset = path => new URL('./assets/' + path, import.meta.url).href;
export function heroName(id) { return catalog[id]?.[0] || ('Hero ' + (Number(id) || 'unknown')); }
export function heroPortrait(id) {
  return localAsset('portraits/' + (catalog[id] ? Number(id) : 'unknown') + '.webp');
}
export const heroImage = heroPortrait;
export function heroShowcase(id) {
  if (!catalog[id]) return '';
  return `<div class="ledger-showcase" data-showcase="${catalog[id][1]}" data-hero-id="${Number(id)}" aria-busy="true">
    <style>
      .ledger-showcase{width:100%;height:100%;min-height:205px;position:relative;isolation:isolate;display:grid;place-items:center}
      .ledger-showcase .hero-layer,.ledger-showcase video,.ledger-showcase model-viewer{width:100%;height:100%;position:absolute;inset:0;object-fit:contain}
      .ledger-showcase .hero-layer{opacity:0;pointer-events:none;transition:opacity .23s ease}
      .ledger-showcase .hero-layer.visible{opacity:1;pointer-events:auto}
      .ledger-showcase model-viewer{touch-action:pan-y;--poster-color:transparent;--progress-bar-height:0;cursor:grab}
      .ledger-showcase model-viewer:active{cursor:grabbing}
      .ledger-showcase [hidden]{display:none!important}
      .ledger-showcase .hero-status{font:500 13px/1.4 system-ui;color:#a4afb4;text-align:center}
      .ledger-showcase .hero-controls{display:flex;gap:8px;align-items:center;justify-content:center;position:absolute;inset:auto 0 0;pointer-events:none;z-index:2}
      .ledger-showcase .hero-controls>*{color:#e4e9ed;background:#152027e8;font:500 12px/1.25 system-ui;padding:4px 8px;border-radius:12px;white-space:nowrap}
      .ledger-showcase model-viewer:focus-visible{outline:2px solid white;outline-offset:2px}
      @media(max-width:480px){.ledger-showcase .orbit-hint{display:none}}
      @media(prefers-reduced-motion:reduce){.ledger-showcase .hero-layer{transition:none}}
    </style>
    <span class="hero-status" role="status">Loading hero…</span>
    <div class="hero-controls"><span class="orbit-hint" hidden>Drag or scroll to rotate</span></div>
  </div>`;
}

const stages = new WeakMap();
let webgl;
function supports3D() {
  if (webgl !== undefined) return webgl;
  try {
    const context = document.createElement('canvas').getContext('webgl2');
    webgl = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { webgl = false; }
  return webgl;
}

function waitForMedia(media, event, signal, timeout) {
  return new Promise((resolve,reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      media.removeEventListener(event,ready);
      media.removeEventListener('error',failed);
      signal.removeEventListener('abort',failed);
    };
    const ready = () => {cleanup();resolve();};
    const failed = () => {cleanup();reject(new Error('Media unavailable'));};
    const timer = setTimeout(failed,timeout);
    media.addEventListener(event,ready);
    media.addEventListener('error',failed);
    signal.addEventListener('abort',failed,{once:true});
    if (signal.aborted) failed();
  });
}

function createModel(key,name) {
  const viewer = document.createElement('model-viewer');
  if (typeof viewer.getCameraOrbit !== 'function') throw new Error('3D unavailable');
  viewer.alt = name + ' default model. Drag, scroll, or use arrow keys to rotate.';
  for (const attr of ['camera-controls','disable-pan','disable-zoom']) viewer.setAttribute(attr,'');
  viewer.setAttribute('interaction-prompt','none');
  viewer.setAttribute('loading','eager');
  viewer.setAttribute('camera-orbit','18deg 78deg auto');
  viewer.setAttribute('exposure','1.12');
  viewer.setAttribute('shadow-intensity','0.28');
  viewer.setAttribute('tabindex','0');
  viewer.setAttribute('animation-name','Showcase idle');
  let wheelAngle;
  viewer.addEventListener('pointerdown',() => { wheelAngle=undefined; });
  viewer.addEventListener('keydown',() => { wheelAngle=undefined; });
  viewer.addEventListener('wheel',event => {
    if (event.ctrlKey || !viewer.loaded) return;
    event.preventDefault();
    const orbit=viewer.getCameraOrbit();
    const delta=(Math.abs(event.deltaX)>Math.abs(event.deltaY) ? event.deltaX : event.deltaY)*(event.deltaMode===1?16:1);
    wheelAngle=(wheelAngle ?? orbit.theta*180/Math.PI)+Math.max(-35,Math.min(35,delta*0.33));
    viewer.cameraOrbit=wheelAngle+'deg '+orbit.phi*180/Math.PI+'deg '+orbit.radius+'m';
  },{passive:false});
  return viewer;
}

function createVideo(name) {
  const video = document.createElement('video');
  video.setAttribute('aria-label',name+' full-body showcase');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  return video;
}

function retire(layer) {
  const media=layer?.firstElementChild;
  media?.pause?.();
  if (media?.tagName==='VIDEO') {
    media.removeAttribute('src');
    media.load();
  }
  layer?.remove();
}

export async function switchHeroShowcase(stage,id) {
  const info=catalog[id];
  if (!stage || !info) return false;
  const [name,key]=info;
  const state=stages.get(stage) || {};
  stages.set(stage,state);
  state.pending?.abort();
  const request=new AbortController();
  const signal=request.signal;
  state.pending=request;
  const current=() => !signal.aborted && stage.isConnected;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  stage.dataset.showcase=key;
  stage.dataset.heroId=String(id);
  stage.setAttribute('aria-busy','true');
  const status=stage.querySelector('.hero-status');
  status.textContent='Loading '+name+'…';
  status.hidden=Boolean(state.layer);
  const layer=document.createElement('div');
  layer.className='hero-layer';
  layer.setAttribute('aria-hidden','true');
  stage.insertBefore(layer,stage.querySelector('.hero-controls'));
  signal.addEventListener('abort',() => retire(layer),{once:true});
  let media, isModel=false;
  if (modelKeys.has(key) && supports3D()) {
    try {
      await import('./assets/models/model-viewer.min.js');
      if (!current()) return false;
      media=createModel(key,name);
      const ready=waitForMedia(media,'load',signal,9000);
      layer.append(media);
      media.src=localAsset('models/'+key+'.glb')+'?v=2';
      await ready;
      isModel=true;
    } catch {
      media?.remove();
      media=undefined;
    }
  }
  if (!current()) return false;
  if (!media) {
    try {
      media=createVideo(name);
      const ready=waitForMedia(media,'loadeddata',signal,18000);
      layer.append(media);
      media.src=videoKeys.has(key) ? localAsset('showcase/'+key+'.webm')+'?v=3' : steam+'/videos/dota_react/heroes/renders/'+key+'.webm';
      await ready;
    } catch {
      media?.remove();
      media=undefined;
    }
  }
  if (!current()) return false;
  if (media && !reduced) await Promise.resolve(media.play()).catch(() => {});
  // Wait for decoding and the first canvas paint before retiring the outgoing hero.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if (!current()) return false;
  const previous=state.layer;
  state.layer=media ? layer : undefined;
  state.pending=undefined;
  stage.setAttribute('aria-busy','false');
  status.hidden=Boolean(media);
  if (!media) {status.textContent='Animation unavailable for '+name+'.';retire(layer);}
  else {
    layer.removeAttribute('aria-hidden');
    layer.classList.add('visible');
  }
  stage.querySelector('.orbit-hint').hidden=!isModel;
  if (previous) {
    previous.setAttribute('aria-hidden','true');
    previous.classList.remove('visible');
    if (reduced) retire(previous);
    else setTimeout(()=>retire(previous),240);
  }
  return true;
}

export function hydrateHeroes(root = document) {
  for (const stage of root.querySelectorAll('[data-showcase]:not([data-hydrated])')) {
    stage.dataset.hydrated='true';
    switchHeroShowcase(stage,Number(stage.dataset.heroId));
  }
}
