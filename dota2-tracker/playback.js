import { heroName, heroPortrait } from './heroes.js';

const clock = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
const mapUrl = new URL('./assets/tactical-map.webp', import.meta.url).href;

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// The parser's positionTrack holds Source 2 cell coordinates. OpenDota's
// gameCoordToUV uses a 64-cell offset, 127-cell span, and a bottom-left origin.
function coordinates(row, index) {
  const x = row?.p[index * 2], y = row?.p[index * 2 + 1];
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
  return [(x - 64) * 100 / 127, (191 - y) * 100 / 127];
}

function frameAt(rows, time) {
  let low = 0, high = rows.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (rows[middle].t <= time) low = middle + 1;
    else high = middle;
  }
  return rows[low - 1];
}

export function mountPlayback(host, match) {
  host.replaceChildren();
  const rows = (Array.isArray(match.position_track) ? match.position_track : [])
    .filter(row => Number.isFinite(row?.t) && row.t >= 0 && Array.isArray(row.p) && row.p.length === 20)
    .sort((a, b) => a.t - b.t);
  const intro = createNode('p', 'playback-description', match.demo
    ? 'Illustrative playback of ten heroes on the Dota 2 map. Scrub the timeline or select a hero to highlight their position.'
    : 'Recorded hero positions on the Dota 2 map. Scrub the timeline or select a hero to highlight their position.');
  host.append(intro);
  if (!rows.length) {
    host.append(createNode('p','playback-empty','This match has no recorded position track. Import a replay or a parser JSON export containing positionTrack to watch the tactical replay.'));
    return () => {};
  }
  const panel = createNode('section', 'playback-layout');
  const surface = createNode('div', 'playback-stage');
  const map = createNode('div', 'playback-map');
  const terrain = createNode('img', 'playback-terrain');
  terrain.src = mapUrl; terrain.alt = 'Dota 2 map with Radiant in the southwest and Dire in the northeast';
  map.append(terrain);
  const controls = createNode('div','playback-controls');
  const toggle = createNode('button','playback-toggle','Play');
  const time = createNode('output','playback-clock');
  const slider = createNode('input','playback-scrub');
  const max = rows[rows.length - 1].t;
  slider.type = 'range'; slider.min = rows[0].t; slider.max = max; slider.step = 1;
  slider.setAttribute('aria-label','Replay time');
  const speed = createNode('select','playback-speed');
  speed.setAttribute('aria-label','Playback speed');
  for (const n of [1, 4, 8, 16, 32]) {
    const option = createNode('option', '', n + '×');
    option.value = n; speed.append(option);
  }
  speed.value = '8';
  controls.append(toggle, time, slider, speed);
  surface.append(map, controls);
  const rail = createNode('aside','playback-rail');
  const groups = ['Radiant','Dire'].map((name, i) => {
    const section = createNode('div','playback-group ' + (i ? 'playback-dire' : 'playback-radiant'));
    section.append(createNode('h3','playback-team',name));
    rail.append(section); return section;
  });
  const refs = [];
  let selection = null;
  for (const p of match.players || []) {
    const isDire = p.player_slot >= 128;
    const index = isDire ? p.player_slot - 123 : p.player_slot;
    if (!Number.isInteger(index) || index < 0 || index > 9) continue;
    const name = heroName(p.hero_id);
    const portrait = () => {
      const image = createNode('img'); image.alt = ''; image.src = heroPortrait(p.hero_id); return image;
    };
    const marker = createNode('button','playback-marker ' + (isDire ? 'playback-dire' : 'playback-radiant'));
    marker.type = 'button'; marker.append(portrait());
    const roster = createNode('button','playback-roster');
    roster.type = 'button';
    const words = createNode('span','playback-names');
    words.append(createNode('b','',name), createNode('small','', p.personaname || 'Anonymous player'));
    const label = 'Highlight ' + name;
    for (const button of [roster, marker]) {
      button.setAttribute('aria-label',label); button.setAttribute('aria-pressed','false');
      button.onclick = () => {
        selection = selection === index ? null : index;
        for (const ref of refs) for (const b of [ref.marker, ref.roster]) {
          b.setAttribute('aria-pressed',String(ref.index === selection));
        }
      };
    }
    marker.title = name + (p.personaname ? ' · ' + p.personaname : '');
    roster.append(portrait(),words); groups[Number(isDire)].append(roster);
    map.append(marker); refs.push({index,marker,roster});
  }
  panel.append(surface, rail);
  const caption = createNode('p','playback-caption','2D tactical replay · Terrain reference 7.40 · Heroes disappear while dead or untracked. Full 3D playback is available in the Dota 2 client with the original replay.');
  host.append(panel, caption);
  let position = rows[0].t, running = false, handle = 0, last = 0, shownFrame = null;
  function render() {
    const at = Math.floor(position);
    slider.value = at;
    slider.setAttribute('aria-valuetext',clock(at));
    time.textContent = clock(at) + ' / ' + clock(max);
    const frame = frameAt(rows, at);
    if (frame === shownFrame) return;
    shownFrame = frame;
    for (const { index, marker, roster } of refs) {
      const coords = coordinates(frame, index);
      const visible = !!coords && coords.every(value => value >= 0 && value <= 100);
      marker.hidden = !visible;
      roster.classList.toggle('untracked', !visible);
      roster.title = visible ? 'Highlight on map' : 'Dead, untracked or outside the map at this time';
      if (visible) { marker.style.left = coords[0] + '%'; marker.style.top = coords[1] + '%'; }
    }
  }
  function pause() {
    running = false;
    cancelAnimationFrame(handle);
    toggle.textContent = 'Play';
  }
  function tick(now) {
    if (!running) return;
    position = Math.min(max, position + (now - last) / 1000 * Number(speed.value));
    last = now; render();
    if (position >= max) pause();
    else handle = requestAnimationFrame(tick);
  }
  toggle.onclick = () => {
    if (running) { pause(); return; }
    if (position >= max) position = rows[0].t;
    running = true; toggle.textContent = 'Pause'; last = performance.now();
    handle = requestAnimationFrame(tick);
  };
  toggle.disabled = rows.length < 2;
  slider.oninput = () => { position = Number(slider.value); last = performance.now(); render(); };
  render();
  return pause;
}
