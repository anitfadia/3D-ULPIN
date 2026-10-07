/* =============================================================================
   SCENE — renderer, sky, lighting, camera rig and the site assembler.
   Owns everything that happens inside the viewport; the UI layer talks to it
   through loadSite / focusStructure / flyTo and a handful of callbacks.
   ========================================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { MAT } from './materials.js';
import { buildStructure, pulseSelection } from './building.js';
import { buildMetroCorridor, buildUtilityCorridor } from './corridor.js';
import {
  buildRoad, buildPark, buildTrees, buildStreetLights, buildCars,
  buildBoundary, buildCorners, buildFence, buildField, scatterInRect, buildBackdrop
} from './props.js';
import { centroid, polyArea } from '../data/world.js';
import { mulberry32, floorCode } from '../data/ulpin.js';

/* ------------------------------------------------------------------- state */
export const S = {
  renderer: null, scene: null, camera: null, controls: null, composer: null,
  labels: null, clock: null, siteGroup: null, site: null,
  structures: [], corridors: [], lands: [],
  focused: null, selectedKey: null,
  animated: [], labelObjects: [], floorLabels: [],
  showLabels: true, xray: false, explode: 0, mask: null,
  idle: 0, autoRotate: true, ready: false, mode: 'site'
};

const listeners = { pick: () => {}, hover: () => {}, focus: () => {} };
export const on = (evt, fn) => { listeners[evt] = fn; };

const GROUND_TONE = { urban: '#43474e', suburban: '#454a41', rural: '#63563c' };

/* -------------------------------------------------------------------- init */
export function initScene(holder, labelHolder){
  const w = holder.clientWidth, h = holder.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc6d6e6, 420, 1700);

  const camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 3000);
  camera.position.set(120, 90, 160);

  const labels = new CSS2DRenderer();
  labels.setSize(w, h);
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.top = '0';
  labels.domElement.style.pointerEvents = 'none';
  labelHolder.appendChild(labels.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.maxPolarAngle = Math.PI * 0.492;
  controls.minDistance = 12;
  controls.maxDistance = 620;
  controls.screenSpacePanning = false;

  /* ------------------------------------------------------------- sky + light */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f5c94) },
        mid: { value: new THREE.Color(0x8fb2d4) },
        bot: { value: new THREE.Color(0xd9d3c4) }
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
        void main(){
          float hgt = normalize(vP).y;
          vec3 c = mix(bot, mid, smoothstep(-0.08, 0.22, hgt));
          c = mix(c, top, smoothstep(0.2, 0.75, hgt));
          gl_FragColor = vec4(c, 1.0);
        }`
    })
  );
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xb6d2f0, 0x4a4438, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.75);
  sun.position.set(150, 190, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 620;
  const sr = 175;
  Object.assign(sun.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9dbfe6, 0.28);
  fill.position.set(-120, 80, -140);
  scene.add(fill);

  // environment map for the glazing, generated from the same sky gradient
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 64; envCanvas.height = 32;
  const ectx = envCanvas.getContext('2d');
  const grad = ectx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, '#2f5c94'); grad.addColorStop(.55, '#9dbdda'); grad.addColorStop(1, '#cfc7b6');
  ectx.fillStyle = grad; ectx.fillRect(0, 0, 64, 32);
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(envTex).texture;
  envTex.dispose(); pmrem.dispose();

  /* ------------------------------------------------------------ post stack */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.7, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  Object.assign(S, { renderer, scene, camera, controls, composer, labels, clock: new THREE.Clock(), sun });

  S.siteGroup = new THREE.Group();
  scene.add(S.siteGroup);

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', () => { S.autoRotate = false; });
  renderer.domElement.addEventListener('click', onClick);

  S.ready = true;
  animate();
  return S;
}

function onResize(){
  const holder = S.renderer.domElement.parentElement;
  const w = holder.clientWidth, h = holder.clientHeight;
  S.camera.aspect = w / h; S.camera.updateProjectionMatrix();
  S.renderer.setSize(w, h); S.composer.setSize(w, h); S.labels.setSize(w, h);
}

/* --------------------------------------------------------------- site build */
export function clearSite(){
  S.structures.forEach(g => g.userData.api?.dispose?.());
  while (S.siteGroup.children.length) S.siteGroup.remove(S.siteGroup.children[0]);
  S.labelObjects.forEach(l => l.element.remove());
  S.structures = []; S.corridors = []; S.lands = [];
  S.labelObjects = []; S.floorLabels = []; S.animated = [];
  S.focused = null; S.selectedKey = null;
}

function label(text, cls, x, y, z){
  const div = document.createElement('div');
  div.className = `tag3d ${cls}`;
  div.textContent = text;
  const obj = new CSS2DObject(div);
  obj.position.set(x, y, z);
  S.labelObjects.push(obj);
  return obj;
}

export function loadSite(site){
  clearSite();
  S.site = site;
  const rnd = mulberry32(site.key.length * 97 + 13);

  /* ground */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(site.bounds.w * 3.4, site.bounds.d * 3.4),
    MAT.ground(GROUND_TONE[site.ground] || '#44484f')
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  S.siteGroup.add(ground);

  /* distant massing so the locality sits inside a city rather than a void */
  S.siteGroup.add(buildBackdrop(contentExtent(site), site.ground, site.key.length * 11));

  /* locality boundary + survey pegs */
  if (site.boundary){
    S.siteGroup.add(buildBoundary(site.boundary, { color: 0x3ddad0, y: 0.09 }));
    S.siteGroup.add(buildCorners(site.boundary));
  }

  /* roads, parks, trees, lights, parked cars */
  (site.roads || []).forEach(r => S.siteGroup.add(buildRoad(r)));
  (site.parks || []).forEach((p, i) => S.siteGroup.add(buildPark(p, 20 + i * 7)));

  if (site.roads?.length && site.ground !== 'rural'){
    const lights = [], cars = [];
    site.roads.forEach((r, ri) => {
      const a = r.pts[0], b = r.pts[r.pts.length - 1];
      const n = Math.max(3, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 42));
      for (let i = 1; i < n; i++){
        const t = i / n;
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const perp = Math.atan2(b.z - a.z, b.x - a.x) + Math.PI / 2;
        lights.push({ x: x + Math.cos(perp) * (r.w / 2 + 1.4), z: z + Math.sin(perp) * (r.w / 2 + 1.4) });
        if (rnd() > 0.35){
          cars.push({
            x: x + Math.cos(perp) * (r.w / 2 - 2.2), z: z + Math.sin(perp) * (r.w / 2 - 2.2),
            r: Math.atan2(b.x - a.x, b.z - a.z)
          });
        }
      }
    });
    S.siteGroup.add(buildStreetLights(lights));
    S.siteGroup.add(buildCars(cars, 31));
  }

  /* land parcels (tier 3) */
  (site.lands || []).forEach(land => {
    const mesh = buildField(land);
    mesh.userData = { land, isLand: true };
    S.siteGroup.add(mesh);
    S.siteGroup.add(buildBoundary(land.poly, {
      color: land.unresolved ? 0xef6b6b : 0xa8ae5e, y: 0.12
    }));
    const c = centroid(land.poly);
    const l = label(land.unresolved ? 'L00 · UNRESOLVED' : `${land.label} · ${land.crop}`,
      land.unresolved ? 'big' : 'plot', c.x, 2.4, c.z);
    S.siteGroup.add(l);
    S.lands.push(mesh);
  });

  /* structures */
  site.structures.forEach(entity => {
    const g = buildStructure(entity);
    S.siteGroup.add(g);

    // plot boundary + a low boundary wall for houses
    if (entity.plot){
      S.siteGroup.add(buildBoundary(entity.plot, { color: 0x66748c, y: 0.07 }));
      if (entity.form === 'bungalow') S.siteGroup.add(buildFence(entity.plot, 1.3, 0xb9bcc2));
      if (entity.form !== 'airport'){
        // planting goes behind and beside the structure so it never blocks the entry view
        const spots = [
          ...scatterInRect({ x: entity.x, z: entity.z - (entity.depth / 2 + 7), w: entity.width * 1.5, d: 7 },
            entity.form === 'tower' ? 3 : 2, 40 + entity.x),
          ...scatterInRect({ x: entity.x - entity.width * 0.9, z: entity.z, w: 6, d: entity.depth },
            2, 70 + entity.z)
        ];
        S.siteGroup.add(buildTrees(spots, 60 + Math.abs(entity.x | 0)));
      }
    }

    // invisible pick volume so the whole structure is clickable in overview
    const totalH = entity.floors * entity.floorHeight + 6;
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(entity.width + 3, totalH, entity.depth + 3),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pick.position.set(entity.x, totalH / 2, entity.z);
    pick.userData = { structureGroup: g, entity, isPick: true };
    S.siteGroup.add(pick);
    g.userData.pick = pick;

    const l = label(entity.structureID, 'dim', entity.x, totalH + 3, entity.z);
    S.siteGroup.add(l);
    g.userData.label = l;
    S.structures.push(g);
  });

  /* corridors */
  (site.corridors || []).forEach(c => {
    const g = c.form === 'utility' ? buildUtilityCorridor(c) : buildMetroCorridor(c);
    S.siteGroup.add(g);
    if (g.userData.update) S.animated.push(g.userData.update);
    const anchor = c.path[Math.max(0, c.path.length - 2)];
    const l = label(`${c.structureID} · ${c.zBottom.toFixed(1)} m → ${c.zTop.toFixed(1)} m`,
      'big', anchor.x, c.zTop + 5, anchor.z);
    S.siteGroup.add(l);
    S.corridors.push(g);
  });

  applyLabelVisibility();
  frameSite(site, true);
  return S;
}

/* ------------------------------------------------------------ camera moves */
let flight = null;
export function flyTo(pos, target, duration = 1500){
  S.controls.enabled = false;
  flight = {
    t0: performance.now(), duration,
    fromPos: S.camera.position.clone(), toPos: new THREE.Vector3().copy(pos),
    fromTgt: S.controls.target.clone(), toTgt: new THREE.Vector3().copy(target)
  };
}
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Frames what is actually built rather than the nominal site bounds. */
function contentExtent(site){
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  const eat = (x, z) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
  site.structures.forEach(e => { eat(e.x - e.width, e.z - e.depth); eat(e.x + e.width, e.z + e.depth); });
  (site.lands || []).forEach(l => l.poly.forEach(p => eat(p.x, p.z)));
  (site.corridors || []).forEach(c => c.path.forEach(p => eat(p.x * .7, p.z * .7)));
  if (minX > maxX) return { cx: 0, cz: 0, r: 120 };
  return {
    cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
    r: Math.max(60, Math.max(maxX - minX, maxZ - minZ) * 0.62)
  };
}

export function frameSite(site, instant = false){
  S.mode = 'site';
  const { cx, cz, r } = contentExtent(site);
  const pos = new THREE.Vector3(cx + r * 0.85, r * 0.66, cz + r * 1.15);
  const tgt = new THREE.Vector3(cx, 8, cz);
  if (instant){
    S.camera.position.set(cx + r * 1.5, r * 1.25, cz + r * 1.9);
    S.controls.target.copy(tgt);
    flyTo(pos, tgt, 2400);
  } else flyTo(pos, tgt, 1400);
  S.autoRotate = true;
}

export function planView(){
  S.mode = 'plan';
  const site = S.site;
  const ext = contentExtent(site);
  const c = S.focused ? S.focused.userData.entity : null;
  const cx = c ? c.x : ext.cx, cz = c ? c.z : ext.cz;
  const h = c ? Math.max(60, c.width * 6) : ext.r * 2.1;
  flyTo(new THREE.Vector3(cx + 0.01, h, cz + 0.02), new THREE.Vector3(cx, 0, cz), 1200);
  S.autoRotate = false;
}

export function focusStructure(group, opts = {}){
  const e = group.userData.entity;
  S.focused = group;
  S.mode = 'focus';
  S.autoRotate = false;

  const totalH = e.floors * e.floorHeight;
  const dist = Math.max(e.width * 2.8, totalH * 2.4, 48);
  const unitY = opts.focusUnit ? (opts.focusUnit.zBottom + opts.focusUnit.zTop) / 2 : null;
  // aim at the unit, but keep enough of the building in frame to read the stack
  const targetY = unitY === null ? totalH * 0.5 : unitY * 0.62 + totalH * 0.5 * 0.38;
  const ang = (e.rotY || 0) + Math.PI * 0.22;
  const pos = new THREE.Vector3(
    e.x + Math.sin(ang) * dist, targetY + Math.max(totalH * 0.45, 10), e.z + Math.cos(ang) * dist
  );
  flyTo(pos, new THREE.Vector3(e.x, targetY, e.z), 1500);

  buildFloorLabels(group);
  applyLabelVisibility();
  listeners.focus(group);
  return group;
}

export function unfocusStructure(){
  if (S.focused){
    S.focused.userData.api.reset();
    clearFloorLabels();
  }
  S.focused = null; S.selectedKey = null;
  S.xray = false; S.explode = 0;
  frameSite(S.site);
  applyLabelVisibility();
}

export function focusCorridor(group){
  const e = group.userData.entity;
  const curve = group.userData.curve;
  const p = curve.getPointAt(0.5);
  S.focused = null; S.mode = 'corridor';
  S.autoRotate = false;
  flyTo(new THREE.Vector3(p.x + 58, e.zTop + 44, p.z + 76), new THREE.Vector3(p.x, e.zBottom - 1, p.z), 1500);
}

/* ------------------------------------------------------------ floor labels */
function clearFloorLabels(){
  S.floorLabels.forEach(l => { l.element.remove(); l.parent?.remove(l); });
  S.floorLabels = [];
}
function buildFloorLabels(group){
  clearFloorLabels();
  const e = group.userData.entity;
  const seen = new Set();
  e.units.forEach(u => {
    if (seen.has(u.floorNum)) return;
    seen.add(u.floorNum);
    const div = document.createElement('div');
    div.className = 'tag3d';
    div.textContent = `${floorCode(u.floorNum)} · ${u.zBottom.toFixed(1)}–${u.zTop.toFixed(1)}m`;
    const obj = new CSS2DObject(div);
    obj.position.set(-(e.width / 2) - 2.2, (u.zBottom + u.zTop) / 2, e.depth / 2 + 1);
    const target = group.userData.api.floorGroups.get(u.floorNum);
    (target || group).add(obj);
    S.floorLabels.push(obj);
  });
}
function applyLabelVisibility(){
  const inFocus = S.mode === 'focus';
  S.labelObjects.forEach(l => l.element.classList.toggle('hidden', !S.showLabels || inFocus));
  S.floorLabels.forEach(l => l.element.classList.toggle('hidden', !S.showLabels || !inFocus));
}
export function setLabels(on){ S.showLabels = on; applyLabelVisibility(); }

/* ------------------------------------------------------------- HUD controls */
export function setXray(on){
  S.xray = on;
  if (S.focused) S.focused.userData.api.setXray(on);
  else S.structures.forEach(g => g.userData.api.setXray(on));
}
export function setExplode(t){
  S.explode = t;
  if (S.focused) S.focused.userData.api.setExplode(t);
}
export function setMask(owner){
  S.mask = owner;
  if (S.focused) S.focused.userData.api.setMask(owner);
}
export function selectUnit(key){
  S.selectedKey = key;
  if (S.focused) S.focused.userData.api.select(key);
}

/* -------------------------------------------------------------- interaction */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

function pickTargets(){
  if (S.focused){
    const api = S.focused.userData.api;
    return { units: api.hitboxes.filter(h => !h.userData.locked), others: [] };
  }
  const others = [
    ...S.structures.map(g => g.userData.pick),
    ...S.corridors.flatMap(g => g.userData.hitboxes || []),
    ...S.lands
  ];
  return { units: [], others };
}
function castFrom(ev){
  const rect = S.renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, S.camera);
  const { units, others } = pickTargets();
  const hitU = units.length ? raycaster.intersectObjects(units, false) : [];
  if (hitU.length) return { type: 'unit', obj: hitU[0].object };
  const hitO = others.length ? raycaster.intersectObjects(others, false) : [];
  if (!hitO.length) return null;
  const o = hitO[0].object;
  if (o.userData.isPick) return { type: 'structure', obj: o };
  if (o.userData.isCorridor) return { type: 'corridor', obj: o };
  if (o.userData.isLand) return { type: 'land', obj: o };
  return null;
}
function onPointerMove(ev){
  S.idle = 0;
  const hit = castFrom(ev);
  S.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
  const changed = (hit?.obj || null) !== hovered;
  hovered = hit?.obj || null;
  if (changed) listeners.hover(hit, ev);
}
function onClick(ev){
  const hit = castFrom(ev);
  if (!hit){ listeners.pick(null); return; }
  listeners.pick(hit, ev);
}

/* -------------------------------------------------------------- render loop */
function animate(){
  requestAnimationFrame(animate);
  const dt = S.clock.getDelta();
  const t = S.clock.elapsedTime;

  if (flight){
    const k = easeInOut(Math.min(1, (performance.now() - flight.t0) / flight.duration));
    S.camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
    S.controls.target.lerpVectors(flight.fromTgt, flight.toTgt, k);
    if (k >= 1){ flight = null; S.controls.enabled = true; }
  } else {
    S.idle += dt;
    if (S.autoRotate && S.mode === 'site' && S.idle > 2.5){
      const off = S.camera.position.clone().sub(S.controls.target);
      const a = 0.035 * dt;
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      S.camera.position.copy(S.controls.target).add(off);
    }
  }

  S.animated.forEach(fn => fn(dt));
  if (S.focused) pulseSelection(S.focused, t);
  S.controls.update();
  S.composer.render();
  S.labels.render(S.scene, S.camera);
}
