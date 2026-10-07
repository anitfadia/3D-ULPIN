/* =============================================================================
   MATERIALS — procedural textures and shared surfaces.
   Everything is generated on a canvas at load time so the build stays a single
   self-contained folder with no binary texture assets.
   ========================================================================== */
import * as THREE from 'three';
import { mulberry32 } from '../data/ulpin.js';

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

function canvas(size = 256){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}
function finish(c, repeat = [1, 1], srgb = true){
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function noise(ctx, size, amount, alpha){
  const rnd = mulberry32(1337);
  for (let i = 0; i < amount; i++){
    ctx.fillStyle = `rgba(0,0,0,${alpha * rnd()})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6 * rnd()})`;
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/* ------------------------------------------------------------------ ground */
export const groundTexture = (tone) => memo(`ground-${tone}`, () => {
  const S = 256, { c, ctx } = canvas(S);
  ctx.fillStyle = tone; ctx.fillRect(0, 0, S, S);
  noise(ctx, S, 5200, 0.16);
  return finish(c, [26, 26]);
});

export const grassTexture = () => memo('grass', () => {
  const S = 128, { c, ctx } = canvas(S);
  ctx.fillStyle = '#3d5f3a'; ctx.fillRect(0, 0, S, S);
  const rnd = mulberry32(9);
  for (let i = 0; i < 2600; i++){
    ctx.strokeStyle = `rgba(${90 + rnd() * 60 | 0},${130 + rnd() * 60 | 0},${70 + rnd() * 40 | 0},.5)`;
    const x = rnd() * S, y = rnd() * S;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd() * 2 - 1, y - 2 - rnd() * 3); ctx.stroke();
  }
  return finish(c, [10, 10]);
});

export const cropTexture = (tone1, tone2) => memo(`crop-${tone1}${tone2}`, () => {
  const S = 128, { c, ctx } = canvas(S);
  ctx.fillStyle = tone1; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = tone2;
  for (let y = 0; y < S; y += 8) ctx.fillRect(0, y, S, 4);
  noise(ctx, S, 2400, 0.2);
  return finish(c, [7, 7]);
});

export const roadTexture = (lengthRepeat) => memo(`road-${Math.round(lengthRepeat)}`, () => {
  const S = 256, { c, ctx } = canvas(S);
  ctx.fillStyle = '#26292f'; ctx.fillRect(0, 0, S, S);
  noise(ctx, S, 4200, 0.22);
  ctx.fillStyle = 'rgba(228,232,240,.8)';                     // centre line, dashed
  for (let y = 0; y < S; y += 46) ctx.fillRect(S / 2 - 2.5, y, 5, 24);
  ctx.fillStyle = 'rgba(214,220,232,.45)';                    // edge lines
  ctx.fillRect(12, 0, 3, S); ctx.fillRect(S - 15, 0, 3, S);
  const t = finish(c, [1, lengthRepeat]);
  return t;
});

export const runwayTexture = () => memo('runway', () => {
  const S = 512, { c, ctx } = canvas(S);
  ctx.fillStyle = '#232629'; ctx.fillRect(0, 0, S, S);
  noise(ctx, S, 7000, 0.2);
  ctx.fillStyle = 'rgba(235,238,245,.85)';
  for (let y = 24; y < S; y += 96) ctx.fillRect(S / 2 - 4, y, 8, 54);
  ctx.fillStyle = 'rgba(235,238,245,.5)';
  ctx.fillRect(22, 0, 5, S); ctx.fillRect(S - 27, 0, 5, S);
  return finish(c, [1, 4]);
});

/* Facade glass panel: mullion grid + faint interior variation. Used as the
   colour map on the glazing so the towers read as real curtain-wall buildings. */
export const glazingTexture = (seed, cols = 6, rows = 3) => memo(`glaze-${seed}-${cols}-${rows}`, () => {
  const S = 256, { c, ctx } = canvas(S);
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#0f1620'; ctx.fillRect(0, 0, S, S);
  const cw = S / cols, rh = S / rows;
  for (let r = 0; r < rows; r++){
    for (let col = 0; col < cols; col++){
      const v = rnd();
      // interior tones behind the glass — blinds, lit rooms, empty offices
      const base = v < 0.18 ? [58, 72, 92] : v < 0.42 ? [34, 46, 62] : v < 0.7 ? [24, 34, 47] : [42, 54, 70];
      ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
      ctx.fillRect(col * cw + 2, r * rh + 2, cw - 4, rh - 4);
      // sky gradient reflected in the top half of each pane
      const g = ctx.createLinearGradient(0, r * rh, 0, r * rh + rh);
      g.addColorStop(0, 'rgba(150,190,225,.30)');
      g.addColorStop(.55, 'rgba(120,160,200,.10)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(col * cw + 2, r * rh + 2, cw - 4, rh - 4);
    }
  }
  ctx.strokeStyle = '#39414d'; ctx.lineWidth = 3;             // mullions
  for (let col = 0; col <= cols; col++){ ctx.beginPath(); ctx.moveTo(col * cw, 0); ctx.lineTo(col * cw, S); ctx.stroke(); }
  for (let r = 0; r <= rows; r++){ ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(S, r * rh); ctx.stroke(); }
  return finish(c, [1, 1]);
});

/** Low-detail window grid for the distant city ring. */
export const distantTexture = () => memo('distant', () => {
  const S = 128, { c, ctx } = canvas(S);
  const rnd = mulberry32(77);
  ctx.fillStyle = '#9aa0a9'; ctx.fillRect(0, 0, S, S);
  const cols = 9, rows = 16, cw = S / cols, rh = S / rows;
  for (let r = 0; r < rows; r++){
    for (let col = 0; col < cols; col++){
      const v = rnd();
      ctx.fillStyle = v < .5 ? 'rgba(58,74,94,.72)' : v < .8 ? 'rgba(96,116,140,.6)' : 'rgba(150,175,200,.5)';
      ctx.fillRect(col * cw + cw * .22, r * rh + rh * .22, cw * .56, rh * .5);
    }
  }
  noise(ctx, S, 1200, .1);
  return finish(c, [1, 1]);
});

/** Plastered wall with punched windows — bungalows and hutments. */
export const wallTexture = (wallColor, seed) => memo(`wall-${wallColor}-${seed}`, () => {
  const S = 256, { c, ctx } = canvas(S);
  const rnd = mulberry32(seed);
  ctx.fillStyle = wallColor; ctx.fillRect(0, 0, S, S);
  noise(ctx, S, 3000, 0.13);
  for (let i = 0; i < 2; i++){
    for (let j = 0; j < 2; j++){
      const x = 30 + i * 120, y = 60 + j * 110, w = 66, h = 58;
      ctx.fillStyle = '#2a3646'; ctx.fillRect(x, y, w, h);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(170,200,230,.55)'); g.addColorStop(1, 'rgba(120,150,185,.12)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#e6e9ee'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    }
  }
  return finish(c, [1, 1]);
});

export const corrugatedTexture = () => memo('corrugated', () => {
  const S = 128, { c, ctx } = canvas(S);
  ctx.fillStyle = '#6d6a63'; ctx.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 8){
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x, 0, 3, S);
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.fillRect(x + 4, 0, 3, S);
  }
  noise(ctx, S, 1800, 0.22);
  return finish(c, [3, 3]);
});

/* --------------------------------------------------------------- materials */
export const MAT = {
  concrete: (tone = 0xb9bcc2) => memo(`m-conc-${tone}`, () => new THREE.MeshStandardMaterial({
    color: tone, roughness: .92, metalness: .02
  })),
  concreteDark: () => memo('m-concdark', () => new THREE.MeshStandardMaterial({
    color: 0x5d6470, roughness: .88, metalness: .04
  })),
  metal: (tone = 0x9aa2ad) => memo(`m-metal-${tone}`, () => new THREE.MeshStandardMaterial({
    color: tone, roughness: .38, metalness: .82
  })),
  glass: () => memo('m-glass', () => new THREE.MeshStandardMaterial({
    color: 0x8fb6d6, roughness: .06, metalness: .95, envMapIntensity: 1.5
  })),
  darkGlass: () => memo('m-darkglass', () => new THREE.MeshStandardMaterial({
    color: 0x2b3d52, roughness: .1, metalness: .9, envMapIntensity: 1.2
  })),
  glazing: (seed, cols, rows) => memo(`m-glaze-${seed}-${cols}-${rows}`, () => new THREE.MeshStandardMaterial({
    map: glazingTexture(seed, cols, rows), roughness: .16, metalness: .78, envMapIntensity: 1.25
  })),
  wall: (color, seed) => memo(`m-wall-${color}-${seed}`, () => new THREE.MeshStandardMaterial({
    map: wallTexture(color, seed), roughness: .85, metalness: .02
  })),
  roofTile: (tone = 0x8f4f3c) => memo(`m-tile-${tone}`, () => new THREE.MeshStandardMaterial({
    color: tone, roughness: .8, metalness: .03
  })),
  corrugated: () => memo('m-corr', () => new THREE.MeshStandardMaterial({
    map: corrugatedTexture(), roughness: .55, metalness: .45
  })),
  foliage: (tone = 0x4a7a4e) => memo(`m-fol-${tone}`, () => new THREE.MeshStandardMaterial({
    color: tone, roughness: .95, flatShading: true
  })),
  trunk: () => memo('m-trunk', () => new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: .95 })),
  // daylight scene: lamps read as glass, not as light sources
  lamp: () => memo('m-lamp', () => new THREE.MeshStandardMaterial({
    color: 0xdfe4ec, emissive: 0xffe6b0, emissiveIntensity: 0.12, roughness: .35, metalness: .4
  })),
  ground: (tone) => memo(`m-ground-${tone}`, () => new THREE.MeshStandardMaterial({
    map: groundTexture(tone), roughness: .98, metalness: 0
  })),
  grass: () => memo('m-grass', () => new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: .98 })),
  crop: (a, b) => memo(`m-crop-${a}-${b}`, () => new THREE.MeshStandardMaterial({
    map: cropTexture(a, b), roughness: .95
  })),
  road: (rep) => memo(`m-road-${Math.round(rep)}`, () => new THREE.MeshStandardMaterial({
    map: roadTexture(rep), roughness: .82, metalness: .02
  })),
  runway: () => memo('m-runway', () => new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: .8 })),
  distantFacade: () => memo('m-distant', () => new THREE.MeshStandardMaterial({
    map: distantTexture(), roughness: .8, metalness: .05
  })),
  paint: (hex) => memo(`m-paint-${hex}`, () => new THREE.MeshStandardMaterial({
    color: hex, roughness: .35, metalness: .35
  }))
};

/* Unit-volume colours, keyed by the cadastral use of the space. */
export const UNIT_COLOR = {
  'Residential': 0x6f8fe0,
  'Commercial': 0x3ddad0,
  'Parking': 0xf0b25f,
  'Independent House': 0x6cc389,
  'Hutment': 0xc08f60,
  'Airport Terminal': 0xa68cf0,
  'Utility': 0x9aa6bd,
  'default': 0x6f8fe0
};
export const unitColor = (t) => UNIT_COLOR[t] ?? UNIT_COLOR.default;
export const MASK_COLOR = 0x59637a;

export function disposeTextures(){
  cache.forEach(v => { if (v && v.dispose) v.dispose(); });
  cache.clear();
}
