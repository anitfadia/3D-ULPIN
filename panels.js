/* =============================================================================
   PANELS — the record panel, the government unit register, toasts and legend.
   ========================================================================== */
import { explainULPIN, ownerDetailsFor, floorCode, pad } from '../data/ulpin.js';
import { polyArea } from '../data/world.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

export const badgeClass = (type) => ({
  'Residential': 'residential', 'Parking': 'parking', 'Independent House': 'house',
  'Hutment': 'hutment', 'Airport Terminal': 'airport', 'Commercial': 'commercial',
  'Utility': 'utility'
}[type] || 'residential');

/* ------------------------------------------------------------------ toasts */
export function toast(kind, msg, ms = 4200){
  const t = el('div', `toast ${kind}`);
  t.appendChild(el('div', 'ic', kind === 'bad' ? '!' : '✓'));
  t.appendChild(el('div', 'msg', msg));
  $('toasts').appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 380);
  }, ms);
}

/* ------------------------------------------------------------------ legend */
export function setLegend(title, rows){
  const l = $('legend');
  if (!rows || !rows.length){ l.hidden = true; return; }
  l.innerHTML = '';
  l.appendChild(el('div', 'lgTitle', title));
  rows.forEach(r => {
    const row = el('div', 'row');
    const sw = el('span', 'sw');
    sw.style.background = r.color;
    row.appendChild(sw);
    row.appendChild(el('span', null, r.text));
    l.appendChild(row);
  });
  l.hidden = false;
}

/* ------------------------------------------------------------ record panel */
let activeTab = 'identity';

function setTab(name){
  activeTab = name;
  document.querySelectorAll('#recTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tabPane').forEach(p => p.classList.toggle('on', p.dataset.pane === name));
}
document.querySelectorAll('#recTabs button').forEach(b => {
  b.addEventListener('click', () => setTab(b.dataset.tab));
});

function segments(id){
  const box = $('recSegments');
  box.innerHTML = '';
  explainULPIN(id).forEach(s => {
    box.appendChild(el('i', null, `${s.label} <b>${s.value}</b>`));
  });
}

/** Elevation ruler: where this band sits within the structure's full extent. */
function zTrack(zBottom, zTop, min, max){
  const span = Math.max(1, max - min);
  const left = ((zBottom - min) / span) * 100;
  const width = Math.max(2.5, ((zTop - zBottom) / span) * 100);
  const ticks = [];
  const stepCount = 5;
  for (let i = 0; i <= stepCount; i++){
    const v = min + (span * i) / stepCount;
    ticks.push(`<div class="tick" style="left:${(i / stepCount) * 100}%"></div>`);
  }
  return `<div class="zTrack">
      ${ticks.join('')}
      <div class="band" style="left:${left}%;width:${width}%"></div>
      <div class="cap" style="left:6px">${min.toFixed(1)}m</div>
      <div class="cap" style="right:6px">${max.toFixed(1)}m</div>
    </div>`;
}

function field(k, v, mono){
  return `<div class="field"><div class="k">${k}</div><div class="v${mono ? ' mono' : ''}">${v}</div></div>`;
}

export function openUnitRecord(unit, entity, ctx = {}){
  const rec = $('record');
  $('recEyebrow').textContent = 'Generated 3D ULPIN';
  const uBox = $('recUlpin');
  uBox.textContent = unit.ulpin;
  uBox.className = 'ulpinBox mono';
  segments(unit.ulpin);

  const zMin = Math.min(0, ...entity.units.map(u => u.zBottom));
  const zMax = Math.max(...entity.units.map(u => u.zTop));
  const below = unit.floorNum < 0;

  $('paneIdentity').innerHTML =
    field('Owner', unit.owner) +
    field('Use', `<span class="badge ${badgeClass(unit.unitType)}">${unit.unitType}</span>`) +
    field('Location', `${entity.label} · ${floorCode(unit.floorNum)} · Unit ${pad(unit.unitNum)}${below ? ' (below ground)' : ''}`) +
    field('Elevation band', `${unit.zBottom.toFixed(1)} m — ${unit.zTop.toFixed(1)} m`, true) +
    zTrack(unit.zBottom, unit.zTop, zMin, zMax) +
    `<div class="note" style="margin-top:16px">${below
      ? 'A below-ground level: the level code is <b>B</b>-prefixed and the elevation band is negative, which is how underground parcels enter the register at all.'
      : 'The Z-range is <b>computed</b> from the ground elevation and floor height, not merely labelled — that is what makes this ID volumetric rather than a 2D address with a floor number attached.'}</div>`;

  const w = unit.rect.x1 - unit.rect.x0, d = unit.rect.z1 - unit.rect.z0;
  const h = unit.zTop - unit.zBottom;
  $('paneGeometry').innerHTML =
    field('Footprint', `${w.toFixed(1)} m × ${d.toFixed(1)} m = ${(w * d).toFixed(1)} m²`, true) +
    field('Height', `${h.toFixed(1)} m`, true) +
    field('Volume claimed', `${(w * d * h).toFixed(1)} m³`, true) +
    field('Carpet area (approx.)', `${unit.carpetArea} m²`, true) +
    field('Local footprint rect', `x [${unit.rect.x0.toFixed(1)}, ${unit.rect.x1.toFixed(1)}] · z [${unit.rect.z0.toFixed(1)}, ${unit.rect.z1.toFixed(1)}]`, true) +
    field('Parent parcel', entity.base, true) +
    (entity.plot ? field('Parcel area', `${polyArea(entity.plot).toFixed(0)} m² (${(polyArea(entity.plot) / 10000).toFixed(2)} ha)`, true) : '') +
    `<div class="note">Topology validation compares this rectangle and this band against every other unit in the structure. Overlap in both is a conflict; overlap in only one is a legitimate stack or a neighbour.</div>`;

  renderOwnerTab(unit.owner, ctx);
  setTab(activeTab === 'owner' && ctx.portal !== 'gov' ? 'identity' : activeTab);
  rec.hidden = false;
  requestAnimationFrame(() => rec.classList.add('open'));
}

export function openCorridorRecord(entity, ctx = {}){
  const rec = $('record');
  $('recEyebrow').textContent = entity.form === 'utility' ? 'Generated Subsurface Band ID' : 'Generated Corridor ID';
  const uBox = $('recUlpin');
  uBox.textContent = entity.ulpin;
  uBox.className = 'ulpinBox mono';
  segments(entity.ulpin);

  const buried = entity.zBottom < 0;
  $('paneIdentity').innerHTML =
    field('Managed by', entity.operator) +
    field('Class', `<span class="badge corridor">${buried ? 'Subsurface utility' : 'Elevated corridor'}</span>`) +
    field('Elevation band', `${entity.zBottom.toFixed(1)} m — ${entity.zTop.toFixed(1)} m`, true) +
    zTrack(entity.zBottom, entity.zTop, Math.min(-6, entity.zBottom - 2), Math.max(20, entity.zTop + 6)) +
    `<div class="note" style="margin-top:16px">This claim has <b>no floor number at all</b> — only an elevation band. It crosses several surface parcels without belonging to any of them, which is precisely the case a 2D cadastre cannot record.</div>`;

  $('paneGeometry').innerHTML =
    field('Vertical extent', `${(entity.zTop - entity.zBottom).toFixed(1)} m`, true) +
    field('Alignment nodes', `${entity.path.length} control points`, true) +
    field('Parent parcel', entity.base, true) +
    `<div class="note">${buried
      ? 'Subsurface utility networks are registered as a trench envelope: a continuous volume beneath the surface parcels it crosses.'
      : 'Air-rights easement: the deck volume is registered above the road reserve, leaving the surface parcels beneath it untouched.'}</div>`;

  $('paneOwner').innerHTML =
    `<div class="lockNote"><b>Public asset.</b> No private owner record exists for this claim; it is held by the operating authority named on the Identity tab.</div>`;
  setTab('identity');
  rec.hidden = false;
  requestAnimationFrame(() => rec.classList.add('open'));
}

export function openLandRecord(land, ctx = {}){
  const rec = $('record');
  $('recEyebrow').textContent = 'Generated Surface ULPIN';
  const uBox = $('recUlpin');
  uBox.textContent = land.ulpin;
  uBox.className = 'ulpinBox mono' + (land.unresolved ? ' warn' : '');
  segments(land.ulpin);

  const area = polyArea(land.poly);
  $('paneIdentity').innerHTML =
    field('Owner', land.unresolved
      ? 'Unknown — ownership unverified.<br>Records pending at the Taluka office.'
      : land.owner) +
    field('Class', `<span class="badge ${land.unresolved ? 'unknown' : 'agri'}">${land.unresolved ? 'Unverified ownership' : 'Agricultural land'}</span>`) +
    field('Crop / use', land.crop) +
    `<div class="note" style="margin-top:14px">${land.unresolved
      ? 'The system still issues a valid spatial ID from the geo-referenced boundary even with no resolved owner. It <b>flags the gap</b> for manual reconciliation instead of blocking ID generation — a missing record must not become a missing parcel.'
      : 'A surface-only parcel: no vertical subdivision, so no Z-range is generated. The same base code would carry one the day anything is built on it.'}</div>`;

  $('paneGeometry').innerHTML =
    field('Parcel area', `${area.toFixed(0)} m² · ${(area / 10000).toFixed(2)} hectares`, true) +
    field('Boundary nodes', `${land.poly.length} corners`, true) +
    field('Vertical subdivision', 'None — surface parcel only') +
    `<div class="note">Area is measured from the polygon itself rather than quoted from a record, so the figure and the drawing can never disagree.</div>`;

  renderOwnerTab(land.unresolved ? null : land.owner, ctx);
  setTab('identity');
  rec.hidden = false;
  requestAnimationFrame(() => rec.classList.add('open'));
}

function renderOwnerTab(owner, ctx){
  const pane = $('paneOwner');
  if (ctx.portal !== 'gov'){
    pane.innerHTML = `<div class="lockNote"><b>Restricted.</b> Owner records are visible only in the Government (Revenue Department) portal. The citizen portal never receives this data — it is withheld at the record layer, not merely hidden in the interface.</div>`;
    return;
  }
  if (!owner || owner.startsWith('—')){
    pane.innerHTML = `<div class="lockNote">No individual owner is attached to this record. ${owner ? 'It is held in common by the society.' : 'The ownership record is unresolved and pending reconciliation.'}</div>`;
    return;
  }
  const d = ownerDetailsFor(owner);
  pane.innerHTML =
    field('Registered owner', owner) +
    `<div class="restricted" id="piiToggle"><span>Restricted — Revenue Department access</span><span id="piiCaret">▸</span></div>
     <div class="piiBody" id="piiBody" hidden>
       <div class="row"><span>Phone</span><span>${d.phone}</span></div>
       <div class="row"><span>Age</span><span>${d.age}</span></div>
       <div class="row"><span>Gender</span><span>${d.gender}</span></div>
       <div class="row"><span>Khata no.</span><span>${d.khata}</span></div>
       <div class="row"><span>On record since</span><span>${d.since}</span></div>
     </div>
     <div class="note" style="margin-top:14px">Dummy data, generated deterministically from the owner name so the same person always resolves to the same record.</div>`;
  const t = $('piiToggle');
  t.addEventListener('click', () => {
    const b = $('piiBody');
    b.hidden = !b.hidden;
    $('piiCaret').textContent = b.hidden ? '▸' : '▾';
  });
}

export function closeRecord(){
  const rec = $('record');
  rec.classList.remove('open');
  setTimeout(() => { rec.hidden = true; }, 380);
}

/* --------------------------------------------------------- unit register */
let registerRows = [];
export function buildRegister(entity, onPick){
  const panel = $('unitList');
  $('ulTitle').textContent = entity.label;
  $('ulSub').textContent = `${entity.base} · ${entity.sub}`;
  const body = $('ulBody');
  body.innerHTML = '';
  registerRows = [];

  const byFloor = new Map();
  entity.units.forEach(u => {
    if (!byFloor.has(u.floorNum)) byFloor.set(u.floorNum, []);
    byFloor.get(u.floorNum).push(u);
  });
  const floors = [...byFloor.keys()].sort((a, b) => b - a);   // top floor first
  floors.forEach(f => {
    const head = el('div', 'ulFloor', `${floorCode(f)} · ${byFloor.get(f)[0].zBottom.toFixed(1)}–${byFloor.get(f)[0].zTop.toFixed(1)} m`);
    body.appendChild(head);
    byFloor.get(f).forEach(u => {
      const row = el('div', 'uRow');
      row.dataset.key = `${u.floorNum}-${u.unitNum}`;
      // the base code is already in the header, so rows show the vertical part only
      const short = u.ulpin.slice(u.ulpin.indexOf('-') + 1);
      row.innerHTML = `<div><div class="uId">${short}</div><div class="uOwner">${u.owner}</div></div>
                       <span class="badge ${badgeClass(u.unitType)}">${u.unitType}</span>`;
      row.addEventListener('click', () => { markRegister(row.dataset.key); onPick(u); });
      body.appendChild(row);
      registerRows.push({ row, unit: u, head });
    });
  });
  $('ulFoot').textContent = `${entity.units.length} units · ${floors.length} levels`;
  $('ulSearch').value = '';
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('open'));
}

export function markRegister(key){
  registerRows.forEach(r => r.row.classList.toggle('sel', r.row.dataset.key === key));
  const hit = registerRows.find(r => r.row.dataset.key === key);
  hit?.row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function hideRegister(){
  const panel = $('unitList');
  panel.classList.remove('open');
  setTimeout(() => { panel.hidden = true; }, 420);
}

$('ulSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const seen = new Set();
  registerRows.forEach(r => {
    const hay = `${r.unit.ulpin} ${r.unit.owner} ${r.unit.unitType}`.toLowerCase();
    const show = !q || hay.includes(q);
    r.row.style.display = show ? '' : 'none';
    if (show) seen.add(r.head);
  });
  registerRows.forEach(r => { r.head.style.display = seen.has(r.head) || !q ? '' : 'none'; });
});
