/* =============================================================================
   ULPIN — identity generation, owner records and topology validation.
   This module is the project's core contribution (methodology stages 4 and 5);
   it holds no rendering code so the same rules drive the 3D views, the unit
   register and the interactive validator alike.
   ========================================================================== */

/* ---------------------------------------------------------------- utilities */
export function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s){
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
export const pad = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');

/* ------------------------------------------------------------- ID generation
   A 3D ULPIN extends the real DILRMP 14-character surface code rather than
   replacing it:  [base 14] - [structure] - [floor] - [unit] - [Z-range]
   -------------------------------------------------------------------------- */
export const makeBaseULPIN = (stateCode, n) => `${stateCode}12345678${String(n).padStart(4, '0')}`;

/** Basements and other below-ground levels carry a B-prefixed level code. */
export const floorCode = (f) => (f < 0 ? `B${pad(-f)}` : `F${pad(f)}`);

/**
 * The band tag keeps the documented `Z(21.0-24.0m)` form for above-ground claims.
 * When either bound is negative a hyphen would read ambiguously, so those bands
 * (basements, subsurface utilities) use `~` as the separator: `Z(-4.5~-3.0m)`.
 */
export const zTag = (zBottom, zTop) => {
  const sep = (zBottom < 0 || zTop < 0) ? '~' : '-';
  return `Z(${zBottom.toFixed(1)}${sep}${zTop.toFixed(1)}m)`;
};

export const generateUnitULPIN = (base, structureID, floorNum, unitNum, zBottom, zTop) =>
  `${base}-${structureID}-${floorCode(floorNum)}-U${pad(unitNum)}-${zTag(zBottom, zTop)}`;

export const generateCorridorULPIN = (base, code, zBottom, zTop) =>
  `${base}-COR-${code}-${zTag(zBottom, zTop)}`;

export const generateSurfaceULPIN = (base, parcelID) => `${base}-${parcelID}`;

/** Splits a generated ID back into its labelled segments, for the record panel. */
export function explainULPIN(id){
  const parts = String(id).split('-');
  const out = [{ label: 'Base ULPIN', value: parts[0] }];
  let i = 1;
  if (parts[1] === 'COR'){
    out.push({ label: 'Corridor', value: parts[2] });
    i = 3;
  } else if (parts.length > 1){
    out.push({ label: 'Structure', value: parts[1] });   // always the structure, even when it reads like B02
    i = 2;
  }
  for (; i < parts.length; i++){
    const p = parts[i];
    if (p.startsWith('Z(')){
      out.push({ label: 'Elevation band', value: parts.slice(i).join('-') });
      break;
    }
    if (/^F\d+$/.test(p)) out.push({ label: 'Floor', value: p });
    else if (/^B\d+$/.test(p)) out.push({ label: 'Basement level', value: p });
    else if (/^U\d+$/.test(p)) out.push({ label: 'Unit', value: p });
    else out.push({ label: 'Segment', value: p });
  }
  return out;
}

/* ------------------------------------------------------------ owner records */
export const OWNER_POOL = [
  'Rohan Mehta', 'Ananya Sharma', 'Vikram Rao', 'Priya Nair', 'Arjun Kapoor',
  'Sneha Iyer', 'Karan Malhotra', 'Isha Bhatt', 'Aditya Verma', 'Meera Joshi',
  'Suresh Patil', 'Farah Sheikh', 'Devendra Singh', 'Lakshmi Menon'
];
let ownerCursor = 0;
export const nextOwner = () => OWNER_POOL[(ownerCursor++) % OWNER_POOL.length];
export const COMMON_OWNER = '— Common / society-owned —';

/** Deterministic dummy PII: the same owner always resolves to the same record. */
export function ownerDetailsFor(name){
  const rng = mulberry32(hashStr(name));
  const digits = Array.from({ length: 10 }, () => Math.floor(rng() * 10)).join('');
  return {
    phone: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
    age: 24 + Math.floor(rng() * 44),
    gender: rng() < 0.52 ? 'Male' : 'Female',
    khata: `KH-${String(hashStr(name) % 90000 + 10000)}`,
    since: 1998 + Math.floor(rng() * 26)
  };
}

export const DEMO_ACCOUNTS = [
  { username: 'rohan',  password: 'demo123', owner: 'Rohan Mehta' },
  { username: 'ananya', password: 'demo123', owner: 'Ananya Sharma' },
  { username: 'vikram', password: 'demo123', owner: 'Vikram Rao' }
];

/* --------------------------------------------------------- unit construction
   Every unit carries a real rectangular footprint in the structure's local
   metres, so the topology test below is a genuine geometric predicate rather
   than a comparison of floor labels.
   -------------------------------------------------------------------------- */
export function buildStructureUnits(spec){
  const {
    base, structureID, floors, unitsPerFloor, floorHeight,
    defaultType = 'Residential', overrides = {}, zBase = 0,
    unitW = 8, unitD = 12, coreW = 3, startFloor = 1
  } = spec;

  const totalW = unitsPerFloor === 1 ? unitW : unitsPerFloor * unitW + coreW;
  const units = [];
  for (let i = 0; i < floors; i++){
    const f = startFloor + i;                 // level label: negative = below ground
    const zBottom = zBase + i * floorHeight;  // absolute elevation band, metres
    const zTop = zBottom + floorHeight;
    for (let u = 1; u <= unitsPerFloor; u++){
      const key = `${f}-${u}`;
      const ov = overrides[key] || {};
      // left-to-right placement, with the circulation core between the units
      const x0 = unitsPerFloor === 1
        ? -unitW / 2
        : -totalW / 2 + (u - 1) * (unitW + coreW);
      const rect = { x0, x1: x0 + unitW, z0: -unitD / 2, z1: unitD / 2 };
      units.push({
        floorNum: f, unitNum: u, zBottom, zTop, rect,
        side: unitsPerFloor === 1 ? 'centre' : (u === 1 ? 'west' : 'east'),
        unitType: ov.unitType || defaultType,
        owner: ov.owner || nextOwner(),
        carpetArea: Math.round((rect.x1 - rect.x0) * (rect.z1 - rect.z0) * 0.82),
        ulpin: generateUnitULPIN(base, structureID, f, u, zBottom, zTop)
      });
    }
  }
  return units;
}

/* ------------------------------------------------- stage 5: topology validation
   Two claims conflict ONLY when their 2D footprints overlap AND their Z-ranges
   overlap. Footprint overlap alone is legitimate vertical stacking (a flat above
   a parking slot); Z overlap alone is two neighbours sharing one floor.
   -------------------------------------------------------------------------- */
export const overlaps1D = (aMin, aMax, bMin, bMax) => aMin < bMax && bMin < aMax;

export const footprintsOverlap = (a, b) =>
  overlaps1D(a.x0, a.x1, b.x0, b.x1) && overlaps1D(a.z0, a.z1, b.z0, b.z1);

export function checkPair(a, b){
  const fp = footprintsOverlap(a.rect, b.rect);
  const z = overlaps1D(a.zBottom, a.zTop, b.zBottom, b.zTop);
  return { fp, z, conflict: fp && z };
}

export function runTopologyCheck(units){
  let conflicts = 0, stacked = 0, disjoint = 0, pairs = 0;
  const flagged = [];
  for (let i = 0; i < units.length; i++){
    for (let j = i + 1; j < units.length; j++){
      const r = checkPair(units[i], units[j]);
      pairs++;
      if (r.conflict){ conflicts++; flagged.push([units[i], units[j]]); }
      else if (r.fp) stacked++;
      else disjoint++;
    }
  }
  return { conflicts, stacked, disjoint, pairs, flagged, unitsChecked: units.length };
}

/* Convenience for building an ID from an arbitrary elevation band (air-rights,
   subsurface utility runs) that has no floor number at all. */
export const generateBandULPIN = (base, code, zBottom, zTop) =>
  `${base}-${code}-${zTag(zBottom, zTop)}`;
