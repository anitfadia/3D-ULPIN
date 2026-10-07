/* =============================================================================
   BUILDING — turns a structure record into architecture.
   Every structure is assembled floor by floor so the same group can be exploded
   vertically, X-rayed into its volumetric parcels, or masked for a citizen who
   only holds one unit in it.
   ========================================================================== */
import * as THREE from 'three';
import { MAT, unitColor, MASK_COLOR } from './materials.js';
import { mulberry32, hashStr } from '../data/ulpin.js';

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const place = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const shade = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };

/* ------------------------------------------------------------- floor plates */
function towerFloor(entity, f, seed){
  const g = new THREE.Group();
  const W = entity.width, D = entity.depth, FH = entity.floorHeight;
  const y0 = (f - 1) * FH;
  const isGround = f === 1;

  // spandrel / edge beam at the top of every floor
  const band = shade(box(W + 0.7, 0.55, D + 0.7, MAT.concrete(0xc3c6cc)));
  place(band, 0, y0 + FH - 0.27, 0); g.add(band);

  // curtain-wall glazing between the beams
  const glassMat = isGround ? MAT.darkGlass() : MAT.glazing(seed, 6, 2);
  const glazing = shade(box(W - 0.15, FH - 0.6, D - 0.15, glassMat), true, false);
  place(glazing, 0, y0 + (FH - 0.6) / 2 + 0.05, 0); g.add(glazing);

  // corner columns read as structure rather than a printed texture
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
    const col = shade(box(0.62, FH, 0.62, MAT.concrete(0xb2b6bd)));
    place(col, sx * (W / 2 - 0.1), y0 + FH / 2, sz * (D / 2 - 0.1));
    g.add(col);
  });

  if (isGround){
    const canopy = shade(box(W * 0.5, 0.32, 3.4, MAT.concrete(0xcfd2d7)));
    place(canopy, 0, FH - 0.9, D / 2 + 1.5); g.add(canopy);
    [-1, 1].forEach(s => {
      const post = shade(box(0.26, FH - 1.1, 0.26, MAT.metal(0x8d949f)));
      place(post, s * (W * 0.2), (FH - 1.1) / 2, D / 2 + 2.9); g.add(post);
    });
    for (let i = 0; i < 3; i++){
      const step = shade(box(W * 0.34 + i * 0.7, 0.16, 1.2 + i * 0.5, MAT.concrete(0xbfc2c8)), false, true);
      place(step, 0, 0.08 + (2 - i) * 0.16, D / 2 + 1.1 + i * 0.45); g.add(step);
    }
    const door = box(2.6, FH - 1.5, 0.14, MAT.metal(0x5c6675));
    place(door, 0, (FH - 1.5) / 2, D / 2 + 0.02); g.add(door);
  } else if (f % 2 === 0){
    // alternating balconies on both long faces
    [-1, 1].forEach(s => {
      const slab = shade(box(W * 0.44, 0.2, 1.7, MAT.concrete(0xc6c9cf)));
      place(slab, s * W * 0.22, y0 + 0.12, D / 2 + 0.85); g.add(slab);
      const rail = box(W * 0.44, 1.05, 0.08, MAT.darkGlass());
      place(rail, s * W * 0.22, y0 + 0.65, D / 2 + 1.66); g.add(rail);
      const hand = box(W * 0.44, 0.07, 0.14, MAT.metal(0xaeb5c0));
      place(hand, s * W * 0.22, y0 + 1.2, D / 2 + 1.66); g.add(hand);
    });
  }
  return g;
}

function towerRoof(entity, seed){
  const g = new THREE.Group();
  const W = entity.width, D = entity.depth, FH = entity.floorHeight;
  const top = entity.floors * FH;
  const deck = shade(box(W + 0.7, 0.3, D + 0.7, MAT.concrete(0x9fa4ac)));
  place(deck, 0, top + 0.15, 0); g.add(deck);
  // parapet
  [[0, 0, (D + 0.4) / 2, W + 0.8, 0.6], [0, 0, -(D + 0.4) / 2, W + 0.8, 0.6]].forEach(([x, , z, w]) => {
    const p = shade(box(w, 0.85, 0.22, MAT.concrete(0xc0c3ca)));
    place(p, x, top + 0.72, z); g.add(p);
  });
  [-1, 1].forEach(s => {
    const p = shade(box(0.22, 0.85, D + 0.8, MAT.concrete(0xc0c3ca)));
    place(p, s * (W + 0.4) / 2, top + 0.72, 0); g.add(p);
  });

  const lift = shade(box(4.2, 3.2, 4.2, MAT.concrete(0xaeb2b9)));
  place(lift, -W * 0.22, top + 1.9, -D * 0.18); g.add(lift);

  const rnd = mulberry32(seed);
  switch (entity.roof){
    case 'tank': {
      [[-2.5, 1.5], [2.9, -1.2]].forEach(([x, z]) => {
        const legs = shade(box(2.4, 1.4, 2.4, MAT.metal(0x767d88)));
        place(legs, W * 0.22 + x * 0.2, top + 1.0, z); g.add(legs);
        const tank = shade(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.7, 12), MAT.metal(0xa9b0ba)));
        place(tank, W * 0.22 + x * 0.2, top + 2.55, z); g.add(tank);
      });
      for (let i = 0; i < 4; i++){
        const ac = shade(box(1.1, 0.55, 1.1, MAT.metal(0x8b929c)));
        place(ac, W * 0.1 + (rnd() - .5) * W * 0.5, top + 0.6, (rnd() - .5) * D * 0.6); g.add(ac);
      }
      break;
    }
    case 'setback': {
      const cap = shade(box(W * 0.62, FH * 1.15, D * 0.62, MAT.glazing(seed + 3, 5, 2)));
      place(cap, 0, top + FH * 0.58, 0); g.add(cap);
      const capBand = shade(box(W * 0.66, 0.4, D * 0.66, MAT.concrete(0xc3c6cc)));
      place(capBand, 0, top + FH * 1.16 + 0.2, 0); g.add(capBand);
      break;
    }
    case 'garden': {
      const lawn = shade(box(W * 0.86, 0.16, D * 0.7, MAT.grass()), false, true);
      place(lawn, 0, top + 0.4, D * 0.06); g.add(lawn);
      for (let i = 0; i < 7; i++){
        const bush = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + rnd() * 0.35, 0), MAT.foliage(0x4f8552)));
        place(bush, (rnd() - .5) * W * 0.8, top + 0.75, (rnd() - .5) * D * 0.62); g.add(bush);
      }
      const pergola = shade(box(3.6, 0.14, 2.4, MAT.trunk()));
      place(pergola, W * 0.24, top + 2.3, -D * 0.18); g.add(pergola);
      break;
    }
    case 'crown': default: {
      const frame = shade(new THREE.Mesh(new THREE.TorusGeometry(W * 0.3, 0.12, 6, 20), MAT.metal(0xb7bec8)));
      frame.rotation.x = Math.PI / 2;
      place(frame, 0, top + 3.6, 0); g.add(frame);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
        const strut = shade(box(0.16, 3.6, 0.16, MAT.metal(0xb7bec8)));
        place(strut, sx * W * 0.22, top + 1.8, sz * D * 0.2); g.add(strut);
      });
      const mast = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 5, 6), MAT.metal(0xc3c9d2)));
      place(mast, 0, top + 6, 0); g.add(mast);
      break;
    }
  }
  return g;
}

/* -------------------------------------------------------------- house forms */
function bungalowShell(entity, seed){
  const W = entity.width, D = entity.depth, FH = entity.floorHeight, N = entity.floors;
  const groups = [];
  for (let f = 1; f <= N; f++){
    const fg = new THREE.Group();
    const y0 = (f - 1) * FH;
    const walls = shade(box(W, FH, D, MAT.wall('#d9d2c4', seed + f)));
    place(walls, 0, y0 + FH / 2, 0); fg.add(walls);
    const band = shade(box(W + 0.35, 0.28, D + 0.35, MAT.concrete(0xe3ddd0)));
    place(band, 0, y0 + FH - 0.14, 0); fg.add(band);
    if (f === 1){
      const door = box(1.2, 2.1, 0.12, MAT.roofTile(0x6f4a34));
      place(door, -W * 0.25, 1.05, D / 2 + 0.03); fg.add(door);
      const porch = shade(box(3.2, 0.2, 1.6, MAT.concrete(0xd7d1c4)));
      place(porch, -W * 0.25, 2.4, D / 2 + 0.75); fg.add(porch);
      [-1.2, 0.5].forEach(x => {
        const post = shade(box(0.16, 2.3, 0.16, MAT.concrete(0xd7d1c4)));
        place(post, -W * 0.25 + x, 1.15, D / 2 + 1.45); fg.add(post);
      });
    }
    groups.push({ f, group: fg });
  }
  const roof = new THREE.Group();
  const top = N * FH;
  const hip = shade(new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.78, 2.1, 4), MAT.roofTile(0x8f4f3c)));
  hip.rotation.y = Math.PI / 4;
  place(hip, 0, top + 1.05, 0); roof.add(hip);
  const chimney = shade(box(0.7, 1.5, 0.7, MAT.roofTile(0x7a4636)));
  place(chimney, W * 0.28, top + 1.5, -D * 0.2); roof.add(chimney);
  return { groups, roof };
}

function hutmentShell(entity, seed){
  const W = entity.width, D = entity.depth, FH = entity.floorHeight;
  const fg = new THREE.Group();
  const walls = shade(box(W, FH, D, MAT.wall('#b39a7d', seed)));
  place(walls, 0, FH / 2, 0); fg.add(walls);
  const roof = new THREE.Group();
  const sheet = shade(box(W + 1.3, 0.12, D + 1.1, MAT.corrugated()));
  sheet.rotation.z = 0.16;
  place(sheet, 0, FH + 0.35, 0); roof.add(sheet);
  const ridge = shade(box(W + 1.3, 0.12, 0.5, MAT.corrugated()));
  place(ridge, 0, FH + 0.55, -D * 0.2); roof.add(ridge);
  const pot = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.6, 8), MAT.roofTile(0x8a5a3c)));
  place(pot, W / 2 + 0.6, 0.3, D / 2 - 0.4); roof.add(pot);
  return { groups: [{ f: 1, group: fg }], roof };
}

/* ------------------------------------------------------------------ airport */
function airportShell(entity, seed){
  const groups = [];
  const W = entity.width, D = entity.depth, FH = entity.floorHeight, N = entity.floors;
  for (let f = 1; f <= N; f++){
    const fg = new THREE.Group();
    const y0 = (f - 1) * FH;
    const glass = shade(box(W, FH - 0.5, D, MAT.glazing(seed + f, 10, 2)), true, false);
    place(glass, 0, y0 + FH / 2, 0); fg.add(glass);
    const band = shade(box(W + 1.2, 0.6, D + 1.2, MAT.concrete(0xd0d3d8)));
    place(band, 0, y0 + FH - 0.3, 0); fg.add(band);
    for (let i = -3; i <= 3; i++){
      const fin = shade(box(0.5, FH, 0.5, MAT.concrete(0xc3c7cd)));
      place(fin, i * (W / 7), y0 + FH / 2, D / 2 + 0.3); fg.add(fin);
    }
    groups.push({ f, group: fg });
  }
  const roof = new THREE.Group();
  const top = N * FH;
  // barrel-vault terminal roof
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(D * 0.52, D * 0.52, W + 4, 24, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xd7dbe1, roughness: .45, metalness: .55, side: THREE.DoubleSide })
  );
  vault.rotation.z = Math.PI / 2;
  vault.scale.y = 0.34;
  place(vault, 0, top - 1.6, 0); shade(vault); roof.add(vault);
  for (let i = -4; i <= 4; i++){
    const rib = shade(new THREE.Mesh(new THREE.TorusGeometry(D * 0.52, 0.18, 5, 20, Math.PI), MAT.metal(0x9aa2ad)));
    rib.rotation.y = Math.PI / 2;
    rib.scale.y = 0.34;
    place(rib, i * (W / 9), top - 1.6, 0); roof.add(rib);
  }
  return { groups, roof };
}

function airportContext(entity, seed){
  const g = new THREE.Group();
  const ex = entity.extras;

  const apron = new THREE.Mesh(new THREE.PlaneGeometry(entity.width + 70, 58), MAT.concrete(0x7d838c));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.03, 52); apron.receiveShadow = true; g.add(apron);

  const rw = ex.runway;
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(rw.width, rw.length), MAT.runway());
  runway.rotation.x = -Math.PI / 2; runway.rotation.z = Math.PI / 2;
  runway.position.set(rw.x, 0.05, rw.z); runway.receiveShadow = true; g.add(runway);

  // control tower — separately identified structure ATC01
  const tower = new THREE.Group();
  const shaft = shade(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 3.1, ex.atc.base, 14), MAT.concrete(0xc5c9cf)));
  place(shaft, 0, ex.atc.base / 2, 0); tower.add(shaft);
  const cabin = shade(new THREE.Mesh(new THREE.CylinderGeometry(4.6, 3.4, ex.atc.height, 14), MAT.glazing(seed + 9, 14, 1)));
  place(cabin, 0, ex.atc.base + ex.atc.height / 2, 0); tower.add(cabin);
  const cap = shade(new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.1, 0.5, 14), MAT.concrete(0xb5b9c0)));
  place(cap, 0, ex.atc.base + ex.atc.height + 0.25, 0); tower.add(cap);
  const radar = shade(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), MAT.metal(0xd4d9e0)));
  place(radar, 0, ex.atc.base + ex.atc.height + 1.4, 0); tower.add(radar);
  tower.position.set(ex.atc.x, 0, ex.atc.z);
  g.add(tower);

  // a parked airliner on the apron
  const plane = new THREE.Group();
  const fus = shade(new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 20, 6, 14), MAT.paint(0xe9edf3)));
  fus.rotation.z = Math.PI / 2; place(fus, 0, 3.4, 0); plane.add(fus);
  const wing = shade(box(3.4, 0.35, 22, MAT.paint(0xdfe4ec)));
  place(wing, 0, 3.0, 0); plane.add(wing);
  const tailFin = shade(box(3.6, 4.4, 0.3, MAT.paint(0x3ddad0)));
  place(tailFin, -10.5, 5.6, 0); plane.add(tailFin);
  const tailPlane = shade(box(1.8, 0.25, 8, MAT.paint(0xdfe4ec)));
  place(tailPlane, -10.8, 3.9, 0); plane.add(tailPlane);
  [-6, 6].forEach(z => {
    const eng = shade(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 3.4, 12), MAT.metal(0xa8b0ba)));
    eng.rotation.z = Math.PI / 2; place(eng, 1.5, 2.1, z); plane.add(eng);
  });
  plane.position.set(4, 0, 50); plane.rotation.y = 0.1;
  g.add(plane);

  return g;
}

/* ------------------------------------------------------- volumetric parcels */
function unitVolumes(entity){
  const byFloor = new Map();
  const index = new Map();
  entity.units.forEach(u => {
    const w = u.rect.x1 - u.rect.x0, d = u.rect.z1 - u.rect.z0, h = u.zTop - u.zBottom;
    const cx = (u.rect.x0 + u.rect.x1) / 2, cz = (u.rect.z0 + u.rect.z1) / 2, cy = (u.zBottom + u.zTop) / 2;
    const geo = new THREE.BoxGeometry(w, h, d);

    const volume = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: unitColor(u.unitType), transparent: true, opacity: 0.34,
      roughness: .5, metalness: .1, depthWrite: false
    }));
    place(volume, cx, cy, cz); volume.visible = false;

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: unitColor(u.unitType), transparent: true, opacity: .55 })
    );
    place(edges, cx, cy, cz); edges.visible = false;

    const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x5cf5e6, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    place(glow, cx, cy, cz); glow.scale.setScalar(1.04);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x8ffff2, transparent: true, opacity: 0 })
    );
    place(outline, cx, cy, cz); outline.scale.setScalar(1.045);

    const hit = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
    place(hit, cx, cy, cz);
    hit.userData = { unit: u, entity, volume, edges, glow, outline, isUnit: true };
    [volume, edges, glow, outline].forEach(o => { o.userData.isUnit = true; });

    const key = `${u.floorNum}-${u.unitNum}`;
    const rec = { unit: u, volume, edges, glow, outline, hit };
    index.set(key, rec);
    if (!byFloor.has(u.floorNum)) byFloor.set(u.floorNum, []);
    byFloor.get(u.floorNum).push(rec);
  });
  return { byFloor, index };
}

/* ------------------------------------------------------------------ builder */
export function buildStructure(entity){
  const root = new THREE.Group();
  root.position.set(entity.x, 0, entity.z);
  root.rotation.y = entity.rotY || 0;
  const seed = hashStr(entity.base + entity.structureID) % 9999;

  const shell = new THREE.Group();
  const floorGroups = new Map();     // floor number → group (drives the explode)
  let roofGroup = new THREE.Group();
  const W = entity.width, D = entity.depth;

  /* plinth + ground apron shared by all forms */
  const plinth = shade(box(W + 2.6, 0.55, D + 2.6, MAT.concrete(0xa8acb4)), false, true);
  place(plinth, 0, 0.27, 0); shell.add(plinth);

  if (entity.form === 'tower'){
    for (let f = 1; f <= entity.floors; f++) floorGroups.set(f, towerFloor(entity, f, seed + f));
    roofGroup = towerRoof(entity, seed);
  } else if (entity.form === 'bungalow'){
    const r = bungalowShell(entity, seed);
    r.groups.forEach(x => floorGroups.set(x.f, x.group));
    roofGroup = r.roof;
  } else if (entity.form === 'hutment'){
    const r = hutmentShell(entity, seed);
    r.groups.forEach(x => floorGroups.set(x.f, x.group));
    roofGroup = r.roof;
  } else if (entity.form === 'airport'){
    const r = airportShell(entity, seed);
    r.groups.forEach(x => floorGroups.set(x.f, x.group));
    roofGroup = r.roof;
    root.add(airportContext(entity, seed));
  }

  /* below-ground levels: a concrete tank you only really see in volume mode */
  if (entity.basementLevels){
    const depth = entity.basementLevels * entity.floorHeight;
    const bg = new THREE.Group();
    const wallsMat = new THREE.MeshStandardMaterial({
      color: 0x6b7280, roughness: .95, transparent: true, opacity: .32, side: THREE.DoubleSide
    });
    const shellBox = box(W + 1.4, depth, D + 1.4, wallsMat);
    place(shellBox, 0, -depth / 2, 0); bg.add(shellBox);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 12), wallsMat);
    ramp.rotation.x = -0.25; place(ramp, W / 2 + 3, -1.4, D / 2 + 2); bg.add(ramp);
    floorGroups.set(-1, bg);
  }

  floorGroups.forEach(g => shell.add(g));
  shell.add(roofGroup);
  root.add(shell);

  /* volumetric parcels live inside their floor group so they explode together */
  const { byFloor, index } = unitVolumes(entity);
  byFloor.forEach((recs, floorNum) => {
    const target = floorGroups.get(floorNum) || shell;
    recs.forEach(r => { target.add(r.volume, r.edges, r.glow, r.outline, r.hit); });
  });

  /* --------------------------------------------------------------- controls
     Materials come from a shared cache, so clone them per structure before any
     opacity is animated — otherwise X-raying one tower would ghost every tower.
     -------------------------------------------------------------------------- */
  const clones = new Map();
  const shellMeshes = [];
  shell.traverse(o => {
    if (!o.isMesh || o.userData.isUnit || Array.isArray(o.material)) return;
    if (!clones.has(o.material)) clones.set(o.material, o.material.clone());
    o.material = clones.get(o.material);
    shellMeshes.push(o);
  });
  const baseline = new Map();
  shellMeshes.forEach(m => baseline.set(m, { transparent: m.material.transparent, opacity: m.material.opacity }));

  const state = { explode: 0, xray: false, mask: null, selected: null };

  function applyAppearance(){
    // shell transparency: X-ray and citizen masking both fade the envelope
    const alpha = state.xray ? 0.07 : (state.mask ? 0.17 : null);
    shellMeshes.forEach(m => {
      const b = baseline.get(m);
      if (alpha === null){
        m.material.transparent = b.transparent;
        m.material.opacity = b.opacity;
      } else {
        m.material.transparent = true;
        m.material.opacity = Math.min(b.opacity, 1) * alpha;
      }
      m.material.depthWrite = alpha === null ? true : false;
      m.material.needsUpdate = true;
    });
    // volumetric parcels
    index.forEach(r => {
      const mine = !state.mask || r.unit.owner === state.mask;
      const show = state.xray || !!state.mask;
      r.volume.visible = show;
      r.edges.visible = show;
      r.hit.userData.locked = !mine;
      // in citizen view the owner's volume takes the accent colour the legend names
      const col = mine ? (state.mask ? 0x3ddad0 : unitColor(r.unit.unitType)) : MASK_COLOR;
      r.volume.material.color.setHex(col);
      r.edges.material.color.setHex(col);
      r.volume.material.opacity = mine ? (state.mask ? 0.55 : 0.3) : (state.mask ? 0.2 : 0.12);
      r.edges.material.opacity = mine ? 0.9 : 0.26;
    });
  }

  const api = {
    entity, floorGroups, units: index, roofGroup, state,
    hitboxes: [...index.values()].map(r => r.hit),

    setExplode(t){
      state.explode = t;
      const spread = entity.floorHeight * 1.7;
      floorGroups.forEach((g, f) => {
        const i = f < 0 ? f : f - 1;
        g.position.y = t * i * spread;
      });
      roofGroup.position.y = t * ((entity.floors - 1) * spread + spread * 0.55);
    },
    setXray(on){ state.xray = on; applyAppearance(); },
    setMask(owner){ state.mask = owner; applyAppearance(); },
    select(key){
      state.selected = key;
      index.forEach((r, k) => {
        const on = k === key;
        r.glow.material.opacity = on ? 0.3 : 0;
        r.outline.material.opacity = on ? 0.95 : 0;
        r.glow.userData.pulse = on;
      });
    },
    reset(){ state.xray = false; state.mask = null; api.select(null); api.setExplode(0); applyAppearance(); },
    dispose(){ root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  };

  root.userData = { entity, api, kind: 'structure' };
  api.setExplode(0);
  return root;
}

/** Called every frame so the selected volume breathes rather than sitting flat. */
export function pulseSelection(group, t){
  const api = group?.userData?.api;
  if (!api) return;
  api.units.forEach(r => {
    if (r.glow.userData.pulse){
      r.glow.material.opacity = 0.22 + Math.sin(t * 3.1) * 0.10;
      r.outline.material.opacity = 0.75 + Math.sin(t * 3.1) * 0.22;
    }
  });
}
