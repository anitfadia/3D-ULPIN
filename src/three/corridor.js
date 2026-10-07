/* =============================================================================
   CORRIDOR — infrastructure that owns an elevation band rather than a floor:
   elevated metro viaducts (air-rights) and subsurface utility trunks.
   ========================================================================== */
import * as THREE from 'three';
import { MAT } from './materials.js';

function curveFrom(path, y){
  return new THREE.CatmullRomCurve3(
    path.map(p => new THREE.Vector3(p.x, y, p.z)), false, 'catmullrom', 0.4
  );
}

/* Cross-section of the viaduct: a U-shaped deck with parapets either side. */
function deckShape(halfW = 4.6, slab = 0.85, parapet = 1.15){
  const s = new THREE.Shape();
  s.moveTo(-halfW, 0);
  s.lineTo(halfW, 0);
  s.lineTo(halfW, parapet);
  s.lineTo(halfW - 0.45, parapet);
  s.lineTo(halfW - 0.45, slab);
  s.lineTo(-halfW + 0.45, slab);
  s.lineTo(-halfW + 0.45, parapet);
  s.lineTo(-halfW, parapet);
  s.closePath();
  return s;
}
function railShape(offset, w = 0.16, h = 0.22, base = 0.85){
  const s = new THREE.Shape();
  s.moveTo(offset - w / 2, base);
  s.lineTo(offset + w / 2, base);
  s.lineTo(offset + w / 2, base + h);
  s.lineTo(offset - w / 2, base + h);
  s.closePath();
  return s;
}

function buildTrain(){
  const train = new THREE.Group();
  const carBody = (len) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.6, len), MAT.paint(0xf0f3f8));
    body.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.42, len * 0.98), MAT.paint(0x3ddad0));
    stripe.position.y = 0.55;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.85, len * 0.9), MAT.darkGlass());
    glass.position.y = 0.05;
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, len * 0.96), MAT.paint(0x39424f));
    skirt.position.y = -1.45;
    g.add(body, stripe, glass, skirt);
    return g;
  };
  [-1, 0, 1].forEach(i => {
    const car = carBody(11);
    car.position.z = i * 11.6;
    train.add(car);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 4), MAT.paint(0xf0f3f8));
  nose.rotation.x = -Math.PI / 2; nose.rotation.y = Math.PI / 4;
  nose.position.z = 11.6 + 6.4; nose.scale.set(1.35, 1, 0.9);
  train.add(nose);
  return train;
}

export function buildMetroCorridor(entity){
  const root = new THREE.Group();
  const y = entity.zBottom;
  const curve = curveFrom(entity.path, y);
  const steps = 220;

  const deckGeo = new THREE.ExtrudeGeometry(deckShape(), {
    steps, bevelEnabled: false, extrudePath: curve
  });
  const deck = new THREE.Mesh(deckGeo, MAT.concrete(0xbfc4cb));
  deck.castShadow = true; deck.receiveShadow = true;
  deck.userData = { corridor: entity, isCorridor: true };
  root.add(deck);

  [-1.35, 1.35].forEach(off => {
    const railGeo = new THREE.ExtrudeGeometry(railShape(off), { steps, bevelEnabled: false, extrudePath: curve });
    const rail = new THREE.Mesh(railGeo, MAT.metal(0x8e959f));
    rail.userData = { corridor: entity, isCorridor: true };
    root.add(rail);
  });

  // piers down to the ground, on the curve
  const len = curve.getLength();
  const bays = Math.max(3, Math.round(len / 27));
  for (let i = 0; i <= bays; i++){
    const t = i / bays;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const pier = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.5, y, 10), MAT.concrete(0xa9aeb6));
    shaft.position.y = y / 2; shaft.castShadow = true; shaft.receiveShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.1, 6.2), MAT.concrete(0xb7bcc3));
    head.position.y = y - 0.4; head.castShadow = true;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.5, 10), MAT.concrete(0x9aa0a8));
    pad.position.y = 0.2;
    pier.add(shaft, head, pad);
    pier.position.copy(p); pier.position.y = 0;
    pier.rotation.y = Math.atan2(tan.x, tan.z);
    root.add(pier);
  }

  // catenary masts along the parapet
  for (let i = 0; i < bays * 2; i++){
    const t = (i + 0.5) / (bays * 2);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), MAT.metal(0x848b95));
    mast.position.copy(p); mast.position.y = y + 2.6;
    const side = i % 2 ? 1 : -1;
    mast.translateOnAxis(new THREE.Vector3(tan.z, 0, -tan.x).normalize(), side * 4.1);
    root.add(mast);
  }

  const train = buildTrain();
  root.add(train);

  let t = 0;
  const upVec = new THREE.Vector3(0, 1, 0);
  const update = (dt) => {
    t = (t + dt * 0.028) % 1;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    train.position.set(p.x, y + 2.3, p.z);
    train.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.clone().normalize());
  };
  update(0);

  root.userData = { entity, kind: 'corridor', update, hitboxes: [deck], curve };
  return root;
}

/* ------------------------------------------------------ subsurface utilities */
export function buildUtilityCorridor(entity){
  const root = new THREE.Group();
  const y = (entity.zBottom + entity.zTop) / 2;
  const curve = curveFrom(entity.path, y);

  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 160, 0.75, 10, false),
    new THREE.MeshStandardMaterial({ color: 0x9aa6bd, roughness: .6, metalness: .3,
      transparent: true, opacity: .85 })
  );
  tube.userData = { corridor: entity, isCorridor: true };
  root.add(tube);

  // trench envelope — the actual volumetric claim, shown in volume mode
  const trench = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 120, 1.9, 4, false),
    new THREE.MeshBasicMaterial({ color: 0x9aa6bd, transparent: true, opacity: .12, depthWrite: false })
  );
  trench.rotation.z = Math.PI / 4;
  root.add(trench);

  // manhole covers at ground level trace the run from the surface
  const n = 9;
  for (let i = 0; i <= n; i++){
    const p = curve.getPointAt(i / n);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 12), MAT.metal(0x6f747c));
    lid.position.set(p.x, 0.08, p.z);
    lid.userData = { corridor: entity, isCorridor: true };
    root.add(lid);
  }

  root.userData = { entity, kind: 'corridor', hitboxes: [tube], curve, buried: true };
  return root;
}
