/* =============================================================================
   PROPS — site context: roads, kerbs, parks, trees, street furniture, cars,
   parcel boundary markers. Instanced wherever there are many of a thing.
   ========================================================================== */
import * as THREE from 'three';
import { MAT } from './materials.js';
import { mulberry32 } from '../data/ulpin.js';

const up = new THREE.Vector3(0, 1, 0);

/* ------------------------------------------------------------------- roads */
export function buildRoad(road){
  const g = new THREE.Group();
  const pts = road.pts;
  for (let i = 0; i < pts.length - 1; i++){
    const a = pts[i], b = pts[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const geo = new THREE.PlaneGeometry(road.w, len);
    const mat = road.unpaved ? MAT.ground('#6d5f45') : MAT.road(len / road.w);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(dx, dz);
    m.position.set((a.x + b.x) / 2, 0.02, (a.z + b.z) / 2);
    m.receiveShadow = true;
    g.add(m);

    if (!road.unpaved){                                   // raised kerbs either side
      [-1, 1].forEach(side => {
        const kerb = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.2, len),
          MAT.concrete(0x71767e)
        );
        kerb.position.set((a.x + b.x) / 2, 0.11, (a.z + b.z) / 2);
        kerb.rotation.y = Math.atan2(dx, dz);
        kerb.translateX(side * (road.w / 2 + 0.35));
        kerb.receiveShadow = true; kerb.castShadow = true;
        g.add(kerb);
      });
    }
  }
  return g;
}

/* ------------------------------------------------------------------- trees */
export function buildTrees(spots, seed = 7){
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.4, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, MAT.trunk(), spots.length);
  const tones = [0x4a7a4e, 0x3f6b45, 0x557f4c, 0x466d3f];
  const canopies = tones.map(t => new THREE.InstancedMesh(canopyGeo, MAT.foliage(t), spots.length));
  const counts = new Array(tones.length).fill(0);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();

  spots.forEach((spot, i) => {
    const h = 0.85 + rnd() * 0.7;
    p.set(spot.x, 1.2 * h, spot.z);
    q.setFromAxisAngle(up, rnd() * Math.PI);
    s.set(h, h, h);
    trunks.setMatrixAt(i, m.compose(p, q, s));
    const ti = Math.floor(rnd() * tones.length);
    const cIdx = counts[ti]++;
    const cs = (1.5 + rnd() * 1.1) * h;
    p.set(spot.x, (2.4 * h) + cs * 0.55, spot.z);
    q.setFromAxisAngle(up, rnd() * Math.PI);
    s.set(cs, cs * (0.9 + rnd() * 0.35), cs);
    canopies[ti].setMatrixAt(cIdx, m.compose(p, q, s));
  });
  trunks.castShadow = true; trunks.instanceMatrix.needsUpdate = true;
  group.add(trunks);
  canopies.forEach((c, i) => {
    c.count = counts[i]; c.castShadow = true; c.instanceMatrix.needsUpdate = true;
    if (counts[i] > 0) group.add(c);
  });
  return group;
}

export function scatterInRect(rectSpec, n, seed, margin = 3){
  const rnd = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({
      x: rectSpec.x - rectSpec.w / 2 + margin + rnd() * (rectSpec.w - margin * 2),
      z: rectSpec.z - rectSpec.d / 2 + margin + rnd() * (rectSpec.d - margin * 2)
    });
  }
  return out;
}

/* -------------------------------------------------------------------- park */
export function buildPark(p, seed){
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), MAT.grass());
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(p.x, 0.09, p.z);
  lawn.receiveShadow = true; g.add(lawn);

  // kerb drawn as a frame, so it never covers the lawn it surrounds
  [[p.w + 0.8, 0.5, 0, (p.d + 0.8) / 2], [p.w + 0.8, 0.5, 0, -(p.d + 0.8) / 2],
   [0.5, p.d + 0.8, (p.w + 0.8) / 2, 0], [0.5, p.d + 0.8, -(p.w + 0.8) / 2, 0]].forEach(([w, d, dx, dz]) => {
    const k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), MAT.concrete(0x8c9098));
    k.position.set(p.x + dx, 0.11, p.z + dz); k.receiveShadow = true; g.add(k);
  });

  const path = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.8, 2.2), MAT.concrete(0xb2b6be));
  path.rotation.x = -Math.PI / 2; path.position.set(p.x, 0.12, p.z); g.add(path);

  g.add(buildTrees(scatterInRect(p, 9, seed, 4), seed));
  return g;
}

/* ------------------------------------------------------------ street lights */
export function buildStreetLights(points, seed = 3){
  const g = new THREE.Group();
  points.forEach((pt, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 7, 6), MAT.metal(0x767d88));
    pole.position.set(pt.x, 3.5, pt.z); pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), MAT.metal(0x767d88));
    arm.position.set(pt.x + (i % 2 ? 0.9 : -0.9), 6.9, pt.z); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.34), MAT.lamp());
    lamp.position.set(pt.x + (i % 2 ? 1.7 : -1.7), 6.82, pt.z); g.add(lamp);
  });
  return g;
}

/* -------------------------------------------------------------------- cars */
const CAR_COLORS = [0xd8dde4, 0x2c3442, 0xa02f2f, 0x2f5aa0, 0x8a8f98, 0x1d1f24];
export function buildCars(slots, seed = 11){
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  slots.forEach((s) => {
    const col = CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)];
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 4.3), MAT.paint(col));
    body.position.y = 0.62; body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), MAT.darkGlass());
    cabin.position.set(0, 1.16, -0.15); cabin.castShadow = true;
    car.add(body, cabin);
    [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]].forEach(([x, z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10), MAT.paint(0x15171b));
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); car.add(w);
    });
    car.position.set(s.x, 0, s.z);
    car.rotation.y = s.r ?? 0;
    g.add(car);
  });
  return g;
}

/* ---------------------------------------------------- parcel boundary lines */
export function buildBoundary(poly, { color = 0x3ddad0, y = 0.06, dashed = true, closed = true } = {}){
  const pts = poly.map(p => new THREE.Vector3(p.x, y, p.z));
  if (closed) pts.push(pts[0].clone());
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 3.2, gapSize: 2.2, transparent: true, opacity: .95 })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity: .95 });
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

/** Small survey pegs at each parcel corner — reads as a cadastral drawing. */
export function buildCorners(poly, color = 0x3ddad0){
  const g = new THREE.Group();
  poly.forEach(p => {
    const peg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 1.1, 6),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .45, roughness: .5 })
    );
    peg.position.set(p.x, 0.55, p.z);
    g.add(peg);
  });
  return g;
}

/* ------------------------------------------------------------------- fence */
export function buildFence(poly, height = 1.5, tone = 0x8d939c){
  const g = new THREE.Group();
  for (let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, len), MAT.concrete(tone));
    wall.position.set((a.x + b.x) / 2, height / 2, (a.z + b.z) / 2);
    wall.rotation.y = -Math.atan2(b.x - a.x, b.z - a.z);
    wall.castShadow = true; wall.receiveShadow = true;
    g.add(wall);
  }
  return g;
}

/* ------------------------------------------------------------- crop parcels */
export function buildField(land){
  const shape = new THREE.Shape(land.poly.map(p => new THREE.Vector2(p.x, -p.z)));
  const geo = new THREE.ShapeGeometry(shape);
  const tones = land.unresolved ? ['#6b6152', '#5d543f'] : ['#6f7c34', '#5d6a2a'];
  const mat = land.unresolved
    ? MAT.ground('#6b6152')
    : MAT.crop(tones[0], tones[1]);
  // ShapeGeometry emits metre-scale UVs; bring them down so the crop rows read at ~1.8 m
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.08, uv.getY(i) * 0.08);
  uv.needsUpdate = true;
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  m.receiveShadow = true;
  return m;
}


/* ------------------------------------------------- distant city / tree line
   A ring of low-detail massing beyond the locality so the site does not end at
   an empty plane. Fog does most of the work; these are never interactive.
   -------------------------------------------------------------------------- */
export function buildBackdrop(extent, kind = 'urban', seed = 5){
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const inner = extent.r * 1.75, outer = extent.r * 3.6;
  const count = kind === 'rural' ? 40 : 90;

  if (kind === 'rural'){
    const spots = [];
    for (let i = 0; i < count * 3; i++){
      const a = rnd() * Math.PI * 2, d = inner + rnd() * (outer - inner);
      spots.push({ x: extent.cx + Math.cos(a) * d, z: extent.cz + Math.sin(a) * d });
    }
    group.add(buildTrees(spots, seed + 4));
    return group;
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, MAT.distantFacade(), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++){
    const a = rnd() * Math.PI * 2;
    const d = inner + Math.pow(rnd(), .7) * (outer - inner);
    const w = 14 + rnd() * 26, dp = 14 + rnd() * 26;
    const h = 9 + Math.pow(rnd(), 1.7) * 62;
    p.set(extent.cx + Math.cos(a) * d, h / 2, extent.cz + Math.sin(a) * d);
    q.setFromAxisAngle(up, Math.round(rnd() * 4) * Math.PI / 4);
    sc.set(w, h, dp);
    mesh.setMatrixAt(i, m.compose(p, q, sc));
    const t = 0.55 + rnd() * 0.35;
    mesh.setColorAt(i, col.setRGB(t, t * 1.01, t * 1.06));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = false;
  group.add(mesh);
  return group;
}
