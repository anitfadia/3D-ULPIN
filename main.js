/* =============================================================================
   MAIN — navigation state machine and the wiring between the UI and the 3D
   engine. Every screen, portal and viewer state is one entry on a single stack.
   ========================================================================== */
import * as Scene from './three/scene.js';
import { SITES, TIERS, P1, propertiesFor } from './data/world.js';
import { DEMO_ACCOUNTS, runTopologyCheck, floorCode, pad } from './data/ulpin.js';
import {
  toast, setLegend, openUnitRecord, openCorridorRecord, openLandRecord,
  closeRecord, buildRegister, hideRegister, markRegister, badgeClass
} from './ui/panels.js';
import { mountDocs, scrollDocsTo } from './ui/docs.js';

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------- state */
const APP = {
  stack: [],
  current: null,
  mode: null,            // 'p1' | 'p2' | 'p34'
  portal: null,          // 'gov' | 'citizen'
  owner: null,           // logged-in citizen
  loadedSite: null
};

const SCREENS = ['hub', 'roleSelect', 'tierSelect', 'citizenLogin', 'citizenProps', 'docs'];
const isGov = () => APP.mode === 'p34' && APP.portal === 'gov';

/* ------------------------------------------------------------------ chrome */
function setStatus(text, kind = ''){
  $('statusPill').className = kind;
  $('statusText').textContent = text;
}
function setCrumb(text){ $('crumb').textContent = text; }

function showScreen(id){
  SCREENS.forEach(s => {
    const n = $(s);
    if (s === id) n.classList.add('active');
    else n.classList.remove('active');
  });
  $('scrim').classList.add('on');
  $('siteNote').hidden = true;
  $('labelLayer').classList.add('off');
  $('hud').classList.remove('show');
  $('legend').hidden = true;
  closeRecord(); hideRegister();
  const n = $(id);
  if (n?.classList.contains('scroll')) n.scrollTop = 0;
}
function showViewer(){
  SCREENS.forEach(s => $(s).classList.remove('active'));
  $('scrim').classList.remove('on');
  $('labelLayer').classList.remove('off');
  $('hud').classList.add('show');
}

/* -------------------------------------------------------------- navigation */
function render(state, opts = {}){
  APP.current = state;
  $('backBtn').classList.toggle('show', APP.stack.length > 0);
  $('logoutBtn').hidden = !APP.owner;

  if (state.screen){
    showScreen(state.screen);
    setCrumb(state.crumb || 'Vertical Property Mapping');
    setStatus(state.status || 'Ready', state.kind || '');
    if (state.screen === 'docs'){ mountDocs(); if (state.anchor) scrollDocsTo(state.anchor); }
    if (state.screen === 'citizenProps') renderProperties();
    return;
  }

  /* viewer states */
  const site = SITES[state.site];
  showViewer();
  setCrumb(state.crumb || site.name);

  const needsLoad = APP.loadedSite !== state.site;
  if (needsLoad){
    $('loader').classList.add('on');
    $('loader').querySelector('.loadMsg').textContent = `Building ${site.name}…`;
    // let the loader paint before the (synchronous) scene assembly
    setTimeout(() => {
      Scene.loadSite(site);
      APP.loadedSite = state.site;
      $('loader').classList.remove('on');
      afterSiteReady(state, opts);
    }, 60);
  } else {
    afterSiteReady(state, opts);
  }
}

function afterSiteReady(state, opts){
  resetHudToggles();
  closeRecord();                 // never carry a previous record into a new view
  if (state.focus){
    const group = Scene.S.structures.find(g => g.userData.entity.structureID === state.focus
      && g.userData.entity.base === state.focusBase);
    if (group){
      Scene.focusStructure(group, { focusUnit: opts.focusUnit });
      onStructureFocused(group, opts);
      return;
    }
  }
  Scene.unfocusStructure();
  hideRegister(); closeRecord();
  siteLegend(state.site);
  siteNote(state.site);
  setStatus(`${SITES[state.site].structures.length} structures · click one to enter`, '');
}

function goTo(state, opts){
  if (APP.current) APP.stack.push(APP.current);
  render(state, opts);
}
function back(){
  const prev = APP.stack.pop();
  if (!prev) return;
  if (prev.screen === 'hub'){ APP.mode = null; APP.portal = null; APP.owner = null; }
  if (prev.screen === 'roleSelect' || prev.screen === 'citizenLogin') APP.owner = null;
  render(prev);
}
$('backBtn').addEventListener('click', back);

/** Prototype 1 shows how the numbers on screen were derived from DEM/DSM. */
function siteNote(siteKey){
  const site = SITES[siteKey];
  const n = $('siteNote');
  if (!site.derivation){ n.hidden = true; return; }
  const d = site.derivation;
  n.innerHTML = `<div class="snTitle">Derived on this parcel</div>
    <div class="snRow">DSM <b>${d.dsm.toFixed(1)} m</b> − DEM <b>${d.dem.toFixed(1)} m</b> = height <b>${(d.dsm - d.dem).toFixed(1)} m</b></div>
    <div class="snRow">${(d.dsm - d.dem).toFixed(1)} ÷ <b>${d.floorHeight.toFixed(1)} m</b> floor height = <b>${d.floors} floors</b></div>
    <div class="snRow">${d.floors} × ${d.unitsPerFloor} units + ${d.basement} basement level = <b>${d.totalUnits} parcels</b></div>
    <div class="snRow">Fixed floor height is a stated prototype assumption.</div>`;
  n.hidden = false;
}

/* ------------------------------------------------------------------ legend */
function siteLegend(siteKey){
  const site = SITES[siteKey];
  const rows = [{ color: '#3ddad0', text: 'Locality boundary / survey pegs' }];
  if (site.structures.some(s => s.form === 'tower')) rows.push({ color: '#95b2f7', text: 'Residential tower' });
  if (site.structures.some(s => s.form === 'bungalow')) rows.push({ color: '#6cc389', text: 'Independent house' });
  if (site.structures.some(s => s.form === 'hutment')) rows.push({ color: '#c08f60', text: 'Hutment' });
  if (site.structures.some(s => s.form === 'airport')) rows.push({ color: '#a68cf0', text: 'Airport parcel' });
  if (site.corridors?.some(c => c.form === 'metro')) rows.push({ color: '#f0b25f', text: 'Elevated corridor (air-rights)' });
  if (site.corridors?.some(c => c.form === 'utility')) rows.push({ color: '#9aa6bd', text: 'Subsurface utility band' });
  if (site.lands?.length) rows.push({ color: '#a8ae5e', text: 'Agricultural parcel' });
  if (site.lands?.some(l => l.unresolved)) rows.push({ color: '#ef6b6b', text: 'Unresolved ownership' });
  setLegend(site.name, rows);
}

/* --------------------------------------------------------- focus behaviour */
function onStructureFocused(group, opts = {}){
  const entity = group.userData.entity;
  const api = group.userData.api;

  if (APP.portal === 'citizen' && APP.owner){
    api.setMask(APP.owner);
    setLegend('Citizen view', [
      { color: '#3ddad0', text: 'Your registered volume' },
      { color: '#59637a', text: 'Not yours — no record exposed' }
    ]);
  } else {
    setLegend('Volumes', [
      { color: '#95b2f7', text: 'Residential' },
      { color: '#3ddad0', text: 'Commercial' },
      { color: '#f0b25f', text: 'Parking (incl. basement)' },
      { color: '#a68cf0', text: 'Terminal / public' },
      { color: '#9aa6bd', text: 'Utility' }
    ]);
  }

  siteNote(APP.current.site);
  if (isGov()) buildRegister(entity, u => selectUnit(entity, u, group));
  else hideRegister();

  runValidation(entity, true);

  if (opts.focusUnit){
    setTimeout(() => selectUnit(entity, opts.focusUnit, group), 900);
  }
}

function selectUnit(entity, unit, group){
  const key = `${unit.floorNum}-${unit.unitNum}`;
  // a below-ground unit is invisible behind the shell, so reveal the volumes for it
  if (unit.floorNum < 0 && !Scene.S.xray){
    $('btnXray').classList.add('on');
    Scene.setXray(true);
    toast('ok', '<b>Below-ground level</b> — volume mode switched on so the buried parcel is visible.');
  }
  Scene.selectUnit(key);
  markRegister(key);
  openUnitRecord(unit, entity, { portal: APP.portal });
}

function runValidation(entity, quiet){
  setStatus('Running topology validation…', 'busy');
  setTimeout(() => {
    const r = runTopologyCheck(entity.units);
    if (r.conflicts > 0){
      setStatus(`${r.conflicts} conflict(s) flagged in ${entity.structureID}`, 'warn');
      toast('bad', `<b>${r.conflicts} overlapping claim(s)</b> in ${entity.structureID} — records withheld pending reconciliation.`);
      return;
    }
    const msg = r.pairs === 0
      ? 'Topology OK — single unit, no overlapping claim possible'
      : `Topology OK — 0 conflicts · ${r.pairs} pairs checked · ${r.stacked} valid vertical stacks`;
    setStatus(msg, 'ok');
    if (!quiet) toast('ok', `<b>${entity.structureID}</b> — ${r.pairs} unit pairs checked, ${r.stacked} legitimate stacks, <b>0 conflicts</b>.`);
  }, 420);
}

/* ------------------------------------------------------------ scene events */
Scene.on('pick', (hit) => {
  if (!hit){
    if (Scene.S.focused){ Scene.selectUnit(null); markRegister(null); closeRecord(); }
    return;
  }
  if (hit.type === 'unit'){
    const { unit, entity } = hit.obj.userData;
    selectUnit(entity, unit, Scene.S.focused);
    return;
  }
  if (hit.type === 'structure'){
    const g = hit.obj.userData.structureGroup;
    const e = g.userData.entity;
    goTo({ ...APP.current, focus: e.structureID, focusBase: e.base, crumb: `${SITES[APP.current.site].name} · ${e.label}` });
    return;
  }
  if (hit.type === 'corridor'){
    const e = hit.obj.userData.corridor;
    const group = Scene.S.corridors.find(g => g.userData.entity === e);
    if (group && e.form !== 'utility') Scene.focusCorridor(group);
    hideRegister();
    openCorridorRecord(e, { portal: APP.portal });
    setStatus(`${e.structureID} · ${e.zBottom.toFixed(1)} m → ${e.zTop.toFixed(1)} m — an elevation band with no floor number`, 'ok');
    return;
  }
  if (hit.type === 'land'){
    const land = hit.obj.userData.land;
    hideRegister();
    openLandRecord(land, { portal: APP.portal });
    setStatus(land.unresolved
      ? 'Spatial ID issued — ownership record unresolved and flagged'
      : `${land.label} · ${land.crop}`, land.unresolved ? 'warn' : '');
  }
});

Scene.on('hover', (hit, ev) => {
  const tip = $('hoverTip');
  if (!hit || !ev){ tip.classList.remove('on'); return; }
  let text = '';
  if (hit.type === 'structure'){
    const e = hit.obj.userData.entity;
    text = `<b>${e.structureID}</b> ${e.sub}`;
  } else if (hit.type === 'corridor'){
    const e = hit.obj.userData.corridor;
    text = `<b>${e.structureID}</b> ${e.zBottom.toFixed(1)} m → ${e.zTop.toFixed(1)} m`;
  } else if (hit.type === 'land'){
    const l = hit.obj.userData.land;
    text = `<b>${l.label}</b> ${l.crop}`;
  } else if (hit.type === 'unit'){
    const u = hit.obj.userData.unit;
    text = `<b>${floorCode(u.floorNum)}·U${pad(u.unitNum)}</b> ${u.unitType}`;
  }
  tip.innerHTML = text;
  tip.style.left = `${ev.clientX}px`;
  tip.style.top = `${ev.clientY}px`;
  tip.classList.add('on');
});

/* ------------------------------------------------------------- HUD wiring */
function resetHudToggles(){
  $('btnXray').classList.remove('on');
  $('btnLabels').classList.add('on');
  $('explode').value = 0;
  $('explodeWrap').style.opacity = Scene.S.focused ? 1 : .45;
}
$('btnPlan').addEventListener('click', () => { Scene.planView(); setStatus('Top-down plan view', ''); });
$('btnOrbit').addEventListener('click', () => {
  if (Scene.S.focused) Scene.focusStructure(Scene.S.focused);
  else Scene.frameSite(SITES[APP.current.site]);
});
$('btnXray').addEventListener('click', (e) => {
  const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on);
  Scene.setXray(on);
  setStatus(on ? 'Volume mode — every registered parcel shown as a solid' : 'Volume mode off', on ? 'ok' : '');
});
$('btnLabels').addEventListener('click', (e) => {
  const on = !e.currentTarget.classList.contains('on');
  e.currentTarget.classList.toggle('on', on);
  Scene.setLabels(on);
});
$('explode').addEventListener('input', (e) => {
  Scene.setExplode(Number(e.target.value) / 100);
});
$('btnValidate').addEventListener('click', () => {
  const e = Scene.S.focused?.userData.entity;
  if (!e){ toast('ok', 'Enter a structure first — validation runs per structure.'); return; }
  runValidation(e, false);
});
$('recordClose').addEventListener('click', () => { closeRecord(); Scene.selectUnit(null); markRegister(null); });

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') back();
  if (e.key.toLowerCase() === 'x') $('btnXray').click();
  if (e.key.toLowerCase() === 'p') $('btnPlan').click();
  if (e.key.toLowerCase() === 'l') $('btnLabels').click();
});

/* -------------------------------------------------------------- hub wiring */
document.querySelectorAll('[data-go]').forEach(card => {
  card.addEventListener('click', () => {
    const go = card.dataset.go;
    if (go === 'p1'){
      APP.mode = 'p1'; APP.portal = null;
      goTo({ site: 'p1', crumb: 'Prototype 1 — Single parcel', plan: true });
      setTimeout(() => Scene.planView(), 700);
    } else if (go === 'p2'){
      APP.mode = 'p2'; APP.portal = null;
      goTo({ screen: 'tierSelect', crumb: 'Prototype 2 — Multi-tier locality', status: 'Choose a city tier' });
    } else if (go === 'p34'){
      APP.mode = 'p34'; APP.portal = null;
      goTo({ screen: 'roleSelect', crumb: 'Prototype 3 + 4 — Digital twin portals', status: 'Select a portal' });
    } else if (go === 'docs'){
      goTo({ screen: 'docs', crumb: 'Reference — methodology & prototype log', status: 'Reference', anchor: card.dataset.anchor });
    }
  });
});

$('pickGov').addEventListener('click', () => {
  APP.portal = 'gov';
  goTo({ screen: 'tierSelect', crumb: 'Government Portal — full access', status: 'Choose a locality tier' });
});
$('pickCitizen').addEventListener('click', () => {
  APP.portal = 'citizen';
  goTo({ screen: 'citizenLogin', crumb: 'Citizen Portal — login required', status: 'Log in to continue' });
});
document.querySelectorAll('#tierSelect [data-tier]').forEach(card => {
  card.addEventListener('click', () => {
    const key = card.dataset.tier;
    const who = APP.mode === 'p2' ? 'Prototype 2' : 'Government Portal';
    goTo({ site: key, crumb: `${who} — ${TIERS[key].name}` });
  });
});

/* ----------------------------------------------------------- citizen login */
$('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const u = $('loginUser').value.trim().toLowerCase();
  const p = $('loginPass').value;
  const match = DEMO_ACCOUNTS.find(a => a.username === u && a.password === p);
  if (!match){ $('loginError').classList.add('show'); return; }
  $('loginError').classList.remove('show');
  APP.owner = match.owner;
  goTo({ screen: 'citizenProps', crumb: `Citizen Portal — ${match.owner}`, status: `Logged in as ${match.owner}`, kind: 'ok' });
});
document.querySelectorAll('.daRow').forEach(b => {
  b.addEventListener('click', () => {
    $('loginUser').value = b.dataset.user;
    $('loginPass').value = 'demo123';
    $('loginForm').dispatchEvent(new Event('submit'));
  });
});
$('logoutBtn').addEventListener('click', () => {
  APP.owner = null;
  while (APP.stack.length && APP.stack[APP.stack.length - 1].screen !== 'citizenLogin') APP.stack.pop();
  if (APP.stack.length) APP.stack.pop();
  render({ screen: 'citizenLogin', crumb: 'Citizen Portal — login required', status: 'Logged out' });
});

function renderProperties(){
  const props = propertiesFor(APP.owner);
  $('propsCount').textContent =
    `${props.length} registered volume${props.length === 1 ? '' : 's'} across ${new Set(props.map(p => p.siteKey)).size} localities · ${APP.owner}`;
  const list = $('propsList');
  list.innerHTML = '';
  props.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'propCard';
    card.style.animationDelay = `${i * 45}ms`;
    card.innerHTML = `<div>
        <div class="pid">${p.unit.ulpin}</div>
        <div class="pmeta">${p.site.name} · ${p.structure.label} · ${p.unit.unitType} · ${p.unit.carpetArea} m²</div>
      </div>
      <span class="badge ${badgeClass(p.unit.unitType)}">${p.unit.unitType}</span>
      <div class="parrow">→</div>`;
    card.addEventListener('click', () => {
      goTo({
        site: p.siteKey, focus: p.structure.structureID, focusBase: p.structure.base,
        crumb: `Citizen Portal — ${p.structure.label}`
      }, { focusUnit: p.unit });
    });
    list.appendChild(card);
  });
}

/* Debug handle — handy when demoing from the console, harmless otherwise. */
window.ULPIN = { Scene, APP, SITES };

/* -------------------------------------------------------------------- boot */
function boot(){
  Scene.initScene($('canvasHolder'), $('labelLayer'));
  // the hub sits over a live Tier-1 locality, blurred back by the scrim
  Scene.loadSite(TIERS.tier1);
  APP.loadedSite = 'tier1';
  render({ screen: 'hub', crumb: 'Vertical Property Mapping', status: 'Ready' });
  $('loader').classList.remove('on');
}
boot();
