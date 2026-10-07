/* =============================================================================
   WORLD — the three localities and the single-parcel demo, laid out in metres.
   Nothing here is rendering code: every structure is a record with a footprint,
   an elevation band and a generated identity. The 3D layer reads this verbatim.
   ========================================================================== */
import {
  makeBaseULPIN, buildStructureUnits, generateCorridorULPIN, generateBandULPIN,
  nextOwner, COMMON_OWNER, mulberry32
} from './ulpin.js';

/* ------------------------------------------------------------------ helpers */
const rect = (cx, cz, w, d) => ([
  { x: cx - w / 2, z: cz - d / 2 }, { x: cx + w / 2, z: cz - d / 2 },
  { x: cx + w / 2, z: cz + d / 2 }, { x: cx - w / 2, z: cz + d / 2 }
]);
export function polyArea(poly){
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    a += (poly[j].x + poly[i].x) * (poly[j].z - poly[i].z);
  return Math.abs(a / 2);
}
export const centroid = (poly) => ({
  x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
  z: poly.reduce((s, p) => s + p.z, 0) / poly.length
});

const TOWER_DIMS = { unitW: 8, unitD: 12, coreW: 3 };
const towerWidth = (upf) => upf * TOWER_DIMS.unitW + TOWER_DIMS.coreW;

/** A residential tower: one basement parking level plus N floors above ground. */
function tower({ state, n, structureID, floors, x, z, rotY = 0, roof, plot = 46, label }){
  const base = makeBaseULPIN(state, n);
  const common = { base, structureID, unitsPerFloor: 2, floorHeight: 3, ...TOWER_DIMS };
  const basement = buildStructureUnits({
    ...common, floors: 1, startFloor: -1, zBase: -3,
    defaultType: 'Parking', overrides: {
      '-1-1': { unitType: 'Parking', owner: COMMON_OWNER },
      '-1-2': { unitType: 'Parking', owner: COMMON_OWNER }
    }
  });
  const above = buildStructureUnits({
    ...common, floors, startFloor: 1, zBase: 0, defaultType: 'Residential',
    overrides: { '1-1': { unitType: 'Commercial', owner: nextOwner() } }
  });
  const units = [...basement, ...above];
  return {
    kind: 'structure', form: 'tower', base, structureID, floors, unitsPerFloor: 2,
    floorHeight: 3, units, x, z, rotY, roof,
    width: towerWidth(2), depth: TOWER_DIMS.unitD, basementLevels: 1,
    plot: rect(x, z, plot, plot - 6),
    label: label || `STRUCTURE ${structureID}`,
    sub: `${floors} floors · 1 basement · ${units.length} units`
  };
}

function bungalow({ state, n, structureID, floors, x, z, rotY = 0, plot = 26 }){
  const base = makeBaseULPIN(state, n);
  const units = buildStructureUnits({
    base, structureID, floors, unitsPerFloor: 1, floorHeight: 3, zBase: 0,
    defaultType: 'Independent House', unitW: 10, unitD: 9, coreW: 0
  });
  return {
    kind: 'structure', form: 'bungalow', base, structureID, floors, unitsPerFloor: 1,
    floorHeight: 3, units, x, z, rotY, width: 10, depth: 9,
    plot: rect(x, z, plot, plot - 4),
    label: structureID, sub: `Independent house · ${floors} floor${floors > 1 ? 's' : ''}`
  };
}

function hutment({ state, n, structureID, x, z, rotY = 0 }){
  const base = makeBaseULPIN(state, n);
  const units = buildStructureUnits({
    base, structureID, floors: 1, unitsPerFloor: 1, floorHeight: 2.5, zBase: 0,
    defaultType: 'Hutment', unitW: 5, unitD: 5, coreW: 0
  });
  return {
    kind: 'structure', form: 'hutment', base, structureID, floors: 1, unitsPerFloor: 1,
    floorHeight: 2.5, units, x, z, rotY, width: 5, depth: 5,
    plot: rect(x, z, 12, 11), label: structureID, sub: 'Hutment · 1 unit'
  };
}

/* --------------------------------------------------------------- TIER ONE
   Dense vertical core: towers with basements, two elevated metro viaducts,
   a subsurface utility trunk and a working airport parcel.
   -------------------------------------------------------------------------- */
function buildTier1(){
  const S = 'MH';
  const towers = [
    tower({ state: S, n: 1, structureID: 'B01', floors: 5, x: -72, z: -52, roof: 'tank' }),
    tower({ state: S, n: 2, structureID: 'B02', floors: 7, x:  56, z: -58, roof: 'setback' }),
    tower({ state: S, n: 3, structureID: 'B03', floors: 4, x: -76, z:  46, roof: 'garden' }),
    tower({ state: S, n: 4, structureID: 'B04', floors: 6, x:  60, z:  44, roof: 'crown' })
  ];

  /* Airport: terminal + separately identified control tower. */
  const aptBase = makeBaseULPIN(S, 90);
  const terminalUnits = buildStructureUnits({
    base: aptBase, structureID: 'APT01', floors: 2, unitsPerFloor: 2, floorHeight: 7,
    zBase: 0, unitW: 34, unitD: 46, coreW: 8, defaultType: 'Airport Terminal',
    overrides: {
      '1-1': { unitType: 'Airport Terminal', owner: 'Airports Authority of India' },
      '1-2': { unitType: 'Utility', owner: 'Airports Authority of India' },
      '2-1': { unitType: 'Airport Terminal', owner: 'Airports Authority of India' },
      '2-2': { unitType: 'Commercial', owner: 'Airports Authority of India' }
    }
  });
  const atcUnits = buildStructureUnits({
    base: aptBase, structureID: 'ATC01', floors: 1, unitsPerFloor: 1, floorHeight: 6,
    zBase: 30, startFloor: 11, unitW: 9, unitD: 9, coreW: 0, defaultType: 'Utility',
    overrides: { '11-1': { unitType: 'Utility', owner: 'Airports Authority of India' } }
  });
  const airport = {
    kind: 'structure', form: 'airport', base: aptBase, structureID: 'APT01',
    floors: 2, unitsPerFloor: 2, floorHeight: 7,
    units: [...terminalUnits, ...atcUnits],
    x: 172, z: 14, rotY: 0, width: 72, depth: 44,
    plot: rect(168, 14, 168, 132),
    label: 'AIRPORT TERMINAL', sub: 'Terminal APT01 + control tower ATC01',
    extras: { atc: { x: 44, z: -46, base: 30, height: 6 }, runway: { x: 0, z: 92, length: 200, width: 24 } }
  };

  /* Elevated metro viaducts — air-rights with an elevation band and no floor. */
  const corridors = [
    {
      kind: 'corridor', form: 'metro', code: 'M01', structureID: 'M01',
      base: makeBaseULPIN(S, 50), zBottom: 8, zTop: 11.5,
      path: [{ x: -160, z: -18 }, { x: -60, z: -22 }, { x: 40, z: -14 }, { x: 150, z: -20 }],
      label: 'ELEVATED CORRIDOR M01', operator: 'Metro Rail Corporation'
    },
    {
      kind: 'corridor', form: 'metro', code: 'M02', structureID: 'M02',
      base: makeBaseULPIN(S, 51), zBottom: 13, zTop: 16.5,
      path: [{ x: -20, z: 120 }, { x: 0, z: 40 }, { x: 14, z: -30 }, { x: 30, z: -120 }],
      label: 'ELEVATED CORRIDOR M02', operator: 'Metro Rail Corporation'
    }
  ].map(c => ({ ...c, ulpin: generateCorridorULPIN(c.base, c.code, c.zBottom, c.zTop) }));

  /* Subsurface utility trunk — a band ULPIN with no floor number at all. */
  const utilities = [{
    kind: 'corridor', form: 'utility', code: 'UTL01', structureID: 'UTL01',
    base: makeBaseULPIN(S, 60), zBottom: -4.5, zTop: -3,
    path: [{ x: -170, z: 6 }, { x: 0, z: 10 }, { x: 170, z: 6 }],
    label: 'SUBSURFACE UTILITY TRUNK', operator: 'Municipal Water & Fibre Utility',
    ulpin: generateBandULPIN(makeBaseULPIN(S, 60), 'UTL01', -4.5, -3)
  }];

  return {
    key: 'tier1', name: 'Tier 1 — Dense Vertical Core', ground: 'urban',
    bounds: { w: 400, d: 300 },
    boundary: [{ x: -170, z: -132 }, { x: 252, z: -140 }, { x: 258, z: 144 }, { x: -162, z: 138 }],
    structures: [...towers, airport],
    corridors: [...corridors, ...utilities],
    lands: [],
    roads: [
      { pts: [{ x: -175, z: 6 }, { x: 262, z: 6 }], w: 16 },
      { pts: [{ x: -8, z: -160 }, { x: -8, z: 160 }], w: 13 },
      { pts: [{ x: -190, z: -104 }, { x: 150, z: -104 }], w: 11 },
      { pts: [{ x: -190, z: 100 }, { x: 150, z: 100 }], w: 11 }
    ],
    parks: [{ x: -140, z: -60, w: 52, d: 62 }, { x: -22, z: 118, w: 64, d: 46 }]
  };
}

/* --------------------------------------------------------------- TIER TWO */
function buildTier2(){
  const S = 'GJ';
  const towers = [
    tower({ state: S, n: 1, structureID: 'B01', floors: 4, x: -46, z: -40, roof: 'tank', plot: 42 }),
    tower({ state: S, n: 2, structureID: 'B02', floors: 3, x:  52, z:  34, roof: 'setback', plot: 42 })
  ];
  const spots = [
    { x: -100, z: 46, r: 0 }, { x: -52, z: 62, r: 0.2 }, { x: 8, z: 66, r: -0.15 },
    { x: 74, z: -50, r: 0.1 }, { x: 118, z: -6, r: -0.25 }
  ];
  const houses = spots.map((s, i) => bungalow({
    state: S, n: 20 + i, structureID: `H0${i + 1}`, floors: 1 + (i % 2), x: s.x, z: s.z, rotY: s.r
  }));
  return {
    key: 'tier2', name: 'Tier 2 — Low-Rise Mixed', ground: 'suburban',
    bounds: { w: 360, d: 280 },
    boundary: [{ x: -150, z: -120 }, { x: 165, z: -126 }, { x: 170, z: 122 }, { x: -145, z: 118 }],
    structures: [...towers, ...houses],
    corridors: [], lands: [],
    roads: [
      { pts: [{ x: -170, z: 4 }, { x: 180, z: 4 }], w: 12 },
      { pts: [{ x: 26, z: -140 }, { x: 26, z: 140 }], w: 10 }
    ],
    parks: [{ x: -104, z: -58, w: 54, d: 44 }]
  };
}

/* -------------------------------------------------------------- TIER THREE */
function buildTier3(){
  const S = 'UP';
  const fields = [
    { id: 'L01', crop: 'Sugarcane', poly: [{x:-165,z:-105},{x:-20,z:-118},{x:-8,z:-14},{x:-152,z:-4}] },
    { id: 'L02', crop: 'Cotton',    poly: [{x:26,z:-112},{x:172,z:-100},{x:166,z:-8},{x:32,z:-16}] }
  ].map((f, i) => {
    const base = makeBaseULPIN(S, 10 + i);
    return {
      kind: 'land', base, parcelID: f.id, poly: f.poly, crop: f.crop,
      owner: nextOwner(), unresolved: false, label: f.id,
      ulpin: `${base}-${f.id}`
    };
  });
  const barrenBase = makeBaseULPIN(S, 77);
  fields.push({
    kind: 'land', base: barrenBase, parcelID: 'L00', crop: 'Barren / unclassified',
    poly: [{x:-150,z:22},{x:-48,z:16},{x:-38,z:112},{x:-146,z:118}],
    owner: null, unresolved: true, label: 'L00', ulpin: `${barrenBase}-L00`
  });
  const huts = [
    { x: 52, z: 46, r: .3 }, { x: 78, z: 74, r: -.2 }, { x: 108, z: 40, r: .5 }, { x: 66, z: 108, r: .1 }
  ].map((h, i) => hutment({ state: S, n: 40 + i, structureID: `HT0${i + 1}`, x: h.x, z: h.z, rotY: h.r }));
  return {
    key: 'tier3', name: 'Tier 3 — Rural & Agricultural', ground: 'rural',
    bounds: { w: 420, d: 320 },
    boundary: [{ x: -180, z: -135 }, { x: 190, z: -128 }, { x: 186, z: 140 }, { x: -176, z: 134 }],
    structures: huts, corridors: [], lands: fields,
    roads: [{ pts: [{ x: -190, z: 4 }, { x: 190, z: 10 }], w: 9, unpaved: true }],
    parks: []
  };
}

/* ---------------------------------------------- PROTOTYPE 1 — single parcel */
function buildSingleParcel(){
  const t = tower({ state: 'KA', n: 1, structureID: 'B01', floors: 5, x: 0, z: 0, roof: 'tank', plot: 54 });
  t.label = 'STRUCTURE B01';
  t.sub = '5 floors · 1 basement · 12 units';
  return {
    key: 'p1', name: 'Single Parcel — KA123456780001', ground: 'urban',
    bounds: { w: 180, d: 150 }, single: true,
    boundary: [{ x: -30, z: -26 }, { x: 30, z: -28 }, { x: 31, z: 26 }, { x: -29, z: 25 }],
    structures: [t], corridors: [], lands: [],
    roads: [{ pts: [{ x: -90, z: 44 }, { x: 90, z: 44 }], w: 12 }],
    parks: [{ x: -58, z: -22, w: 32, d: 34 }],
    derivation: {
      dem: 0, dsm: 15, floorHeight: 3, floors: 5, unitsPerFloor: 2,
      basement: 1, totalUnits: t.units.length
    }
  };
}

/* ------------------------------------------------------------------ exports */
export const TIERS = { tier1: buildTier1(), tier2: buildTier2(), tier3: buildTier3() };
export const P1 = buildSingleParcel();
export const SITES = { ...TIERS, p1: P1 };

/** Every unit held by one owner, across every tier (Prototype 1 stays separate). */
export function propertiesFor(ownerName){
  const out = [];
  Object.values(TIERS).forEach(site => {
    site.structures.forEach(st => {
      if (st.form === 'airport') return;
      st.units.forEach(u => {
        if (u.owner === ownerName) out.push({ siteKey: site.key, site, structure: st, unit: u });
      });
    });
  });
  return out;
}

export const allUnitsOf = (structure) => structure.units;
export const rng = mulberry32;
