/* =============================================================================
   DOCS — the reference screen: problem statement, ID anatomy, algorithm,
   methodology, an interactive topology validator, and the prototype log.
   ========================================================================== */
import { checkPair } from '../data/ulpin.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

const HTML = `
  <div class="docNav" id="docNav">
    <button data-to="secProblem">Problem</button>
    <button data-to="secScheme">ID scheme</button>
    <button data-to="secAlgorithm">Algorithm</button>
    <button data-to="secPipeline">Methodology</button>
    <button data-to="secValidator">Validator</button>
    <button data-to="secEvolution">Prototype log</button>
    <button data-to="secLimits">Limits</button>
  </div>

  <section class="docSec" id="secProblem">
    <h2><span class="num">01</span>Problem statement</h2>
    <p class="lead">Smart India Hackathon · Theme: Smart Automation · 3D ULPIN Generation and Vertical Property Mapping System</p>
    <p>With rapid urbanisation and the vertical growth of cities, conventional 2D land-record systems are becoming
    inadequate for modern urban property. Existing land administration is designed to identify <b>surface-level
    parcels</b>, and cannot uniquely define the ownership rights stacked above and below them.</p>
    <div class="subh">Rights a 2D cadastre cannot express</div>
    <ul>
      <li>Multi-storey apartment units and shops</li>
      <li>Underground infrastructure and basement levels</li>
      <li>Elevated transport corridors — metro viaducts, flyovers</li>
      <li>Parking slots, frequently owned separately from the flat above them</li>
      <li><b>Air-rights</b> sold or leased independently of the ground</li>
      <li>Subsurface utility networks — water, power, fibre, sewer</li>
    </ul>
    <div class="subh">Inputs the production system integrates</div>
    <div class="kvGrid">
      <div class="kv"><div class="k">Imagery</div><div class="v">Drone and satellite orthophotos for footprint extraction</div></div>
      <div class="kv"><div class="k">LiDAR</div><div class="v">3D point clouds for structure massing</div></div>
      <div class="kv"><div class="k">GIS layers</div><div class="v">Existing cadastral parcel boundaries</div></div>
      <div class="kv"><div class="k">Floor plans</div><div class="v">Per-floor unit segmentation source</div></div>
      <div class="kv"><div class="k">GNSS / CORS</div><div class="v">Survey-grade absolute positioning</div></div>
      <div class="kv"><div class="k">DEM / DSM</div><div class="v">Ground and surface elevation models</div></div>
    </div>
    <p style="margin-top:18px"><b>Expected solution:</b> a scalable, interoperable 3D cadastral framework that generates
    standardised 3D ULPINs, maps vertical and underground ownership rights, supports volumetric cadastre, enables
    accurate urban property governance, reduces ownership conflicts, and improves infrastructure and utility planning.</p>
  </section>

  <section class="docSec" id="secScheme">
    <h2><span class="num">02</span>The 3D ULPIN scheme</h2>
    <p class="lead">A hierarchical spatial ID that <b>extends</b> the real DILRMP ULPIN — a 14-character alphanumeric code
    derived from a parcel's latitude and longitude — rather than replacing it. Existing records stay valid.</p>
    <div class="anat">
      <div class="anatSeg" style="border-top-color:var(--text)">
        <div class="code" style="color:var(--text)">KA1234567890AB</div>
        <div class="lbl">Base ULPIN · 14 chars</div>
        <div class="exp">The existing surface parcel code, lat/long derived and backward compatible with DILRMP records.</div>
      </div>
      <div class="anatSeg" style="border-top-color:var(--teal)">
        <div class="code" style="color:var(--teal)">B01</div>
        <div class="lbl">Structure ID</div>
        <div class="exp">Which building stands on that parcel — one parcel can hold several (B01, B02, APT01, ATC01…).</div>
      </div>
      <div class="anatSeg" style="border-top-color:var(--amber)">
        <div class="code" style="color:var(--amber)">F07 / B01</div>
        <div class="lbl">Level code</div>
        <div class="exp">Floor number above ground, or a <b>B</b>-prefixed code for basements and underground levels.</div>
      </div>
      <div class="anatSeg" style="border-top-color:var(--violet)">
        <div class="code" style="color:var(--violet)">U12</div>
        <div class="lbl">Unit ID</div>
        <div class="exp">The specific flat, shop, parking slot or plant room on that level.</div>
      </div>
      <div class="anatSeg" style="border-top-color:var(--green)">
        <div class="code" style="color:var(--green)">Z(21.0-24.0m)</div>
        <div class="lbl">Elevation band</div>
        <div class="exp">The Z-range, bottom to top in metres, that the unit physically occupies. Bands that dip below
        ground separate their bounds with <b>~</b> so the minus signs stay readable: <b>Z(-4.5~-3.0m)</b>.</div>
      </div>
    </div>
    <div class="subh">Why the Z-range is non-negotiable</div>
    <ul>
      <li><b>Floor numbers are not comparable across buildings.</b> A "Floor 7" sits at very different real elevations
      depending on plinth height, sloping ground or a double-height lobby.</li>
      <li><b>Some rights have no floor number at all.</b> Air-rights, elevated corridors and buried utility runs exist
      only as an elevation band — and the problem statement requires them explicitly. Both appear in Tier 1 of this build.</li>
      <li><b>It makes conflict detection geometrically meaningful.</b> Two units can share a footprint — a flat directly
      above a parking slot — without conflicting, precisely because their bands differ.</li>
      <li><b>It separates a real volumetric cadastre from a 2D address with a floor label</b>, which is the exact
      shortfall the problem statement calls inadequate.</li>
    </ul>
  </section>

  <section class="docSec" id="secAlgorithm">
    <h2><span class="num">03</span>Generation algorithm</h2>
    <p class="lead">From a surface parcel polygon to a stored, queryable, visualised volumetric record.</p>
    <div class="step"><div class="n">1</div><div class="txt"><b>Take the surface parcel.</b> Read the boundary polygon; look up or generate its 14-character Base ULPIN from its coordinates.</div></div>
    <div class="step"><div class="n">2</div><div class="txt"><b>Detect the structures on it.</b> Footprint extraction over drone or satellite imagery; assign a Structure ID per building.</div></div>
    <div class="step"><div class="n">3</div><div class="txt"><b>Derive height and floor count.</b> <code>height = DSM − DEM</code>, then <code>floors = height ÷ floor height</code>.</div></div>
    <div class="step"><div class="n">4</div><div class="txt"><b>Segment each floor into units.</b> Edge and contour detection over floor plans; every closed shape becomes a unit with its own footprint rectangle.</div></div>
    <div class="step"><div class="n">5</div><div class="txt"><b>Assign the elevation band.</b> <code>bottom = DEM + (level × floor height)</code>, <code>top = bottom + floor height</code>. Negative levels produce basements and underground parcels.</div></div>
    <div class="step"><div class="n">6</div><div class="txt"><b>Generate the 3D ULPIN.</b> Concatenate base + structure + level + unit + Z-range; store it with the owner, the use class and the 2D footprint.</div></div>
    <div class="step"><div class="n">7</div><div class="txt"><b>Validate topology.</b> Test the new unit's footprint <i>and</i> band against every existing unit in the structure. Both overlap → conflict, flag and refuse. One overlaps → a valid stack or neighbour. Neither → independent.</div></div>
    <div class="step"><div class="n">8</div><div class="txt"><b>Store and expose.</b> Persist to a spatial database; make it queryable by parcel, by structure or by individual unit.</div></div>
    <div class="step"><div class="n">9</div><div class="txt"><b>Visualise.</b> Extrude each footprint across its band, stack the volumes, expose the full record on click, and render flagged conflicts highlighted.</div></div>
  </section>

  <section class="docSec" id="secPipeline">
    <h2><span class="num">04</span>Implementation methodology</h2>
    <p class="lead">Stages 4, 5 and 7 are this project's actual novel work. Saying so plainly is more useful to a judge
    than presenting all seven as equally original.</p>
    <div class="step"><div class="n">1</div><div class="txt"><b>Data acquisition</b> — drone imagery, LiDAR, GNSS/CORS, floor plans <span class="pill std">standard component</span></div></div>
    <div class="step"><div class="n">2</div><div class="txt"><b>Preprocessing</b> — georeferencing, noise cleanup <span class="pill std">standard component</span></div></div>
    <div class="step"><div class="n">3</div><div class="txt"><b>AI / ML processing</b> — building extraction, floor segmentation <span class="pill std">standard component</span></div></div>
    <div class="step"><div class="n">4</div><div class="txt"><b>3D ULPIN generation</b> — hierarchical identity and elevation band computed <span class="pill novel">core contribution</span></div></div>
    <div class="step"><div class="n">5</div><div class="txt"><b>Topology validation</b> — volumetric detection of overlapping ownership claims <span class="pill novel">core contribution</span></div></div>
    <div class="step"><div class="n">6</div><div class="txt"><b>Spatial database</b> — 3D cadastre record storage <span class="pill std">standard component</span></div></div>
    <div class="step"><div class="n">7</div><div class="txt"><b>Access portals</b> — Government and Citizen views with role-based access <span class="pill novel">core contribution</span></div></div>
    <div class="flowline">Parcel boundary → Building footprint → Height (DSM − DEM) → Floor / unit segmentation → Combined 3D ULPIN → Conflict check → Stored &amp; visualised in 3D</div>
  </section>

  <section class="docSec" id="secValidator">
    <h2><span class="num">05</span>Topology validation — try it</h2>
    <p class="lead">Unit A is an existing record. Move unit B's footprint and elevation band and watch the rule decide.
    This is the same predicate the viewer runs when you enter any structure.</p>
    <div class="valGrid">
      <div class="valStage"><svg id="valSvg" viewBox="0 0 520 300" style="width:100%;height:auto"></svg></div>
      <div>
        <div class="ctrl">
          <div class="k">Unit B — 2D footprint</div>
          <div class="toggle" id="valFp">
            <button data-v="same" class="on">Same as A</button>
            <button data-v="offset">Beside A</button>
          </div>
        </div>
        <div class="ctrl">
          <div class="k">Unit B — elevation band</div>
          <div class="toggle" id="valZ">
            <button data-v="same" class="on">Same band</button>
            <button data-v="above">Stacked above</button>
          </div>
        </div>
        <div class="verdict" id="valVerdict">
          <div class="vT" id="valTitle">—</div>
          <div class="vB" id="valBody">—</div>
          <div class="vC" id="valCalc">—</div>
        </div>
      </div>
    </div>
  </section>

  <section class="docSec" id="secEvolution">
    <h2><span class="num">06</span>Prototype log</h2>
    <p class="lead">Four successive builds, all folded into this one application.</p>
    <div class="evo">
      <div class="evoCard">
        <div class="who">Prototype 1</div><h4>Single building</h4>
        <ul>
          <li>One parcel, one structure: 5 floors × 2 units plus a basement parking level.</li>
          <li>Top-down plan view that lifts into the modelled 3D stack.</li>
          <li>Clicking a unit reveals its generated ULPIN, owner, use class and elevation band.</li>
          <li>A ground-floor commercial unit and basement parking prove the scheme is not residential-only.</li>
          <li>The stage-5 topology check runs on entry and reports live.</li>
        </ul>
      </div>
      <div class="evoCard">
        <div class="who">Prototype 2</div><h4>Multi-tier locality</h4>
        <ul>
          <li>Tier 1 / 2 / 3 densities, each a full 3D locality with roads, parks and boundaries.</li>
          <li><b>Tier 1:</b> four towers (5/7/4/6 floors), two elevated metro viaducts with a running train, a buried
          utility trunk, and an airport with a separately identified control tower.</li>
          <li>Corridor IDs take the form <b>[Base]-COR-M01-Z(8.0-11.5m)</b> — infrastructure with a band and no floor.</li>
          <li><b>Tier 2:</b> two mid-rise towers and five bungalows on their own walled plots.</li>
          <li><b>Tier 3:</b> crop parcels measured from their own geometry, hutments, and one barren plot with
          unresolved ownership.</li>
        </ul>
      </div>
      <div class="evoCard">
        <div class="who">Prototype 3</div><h4>Digital twin + portals</h4>
        <ul>
          <li>Role selector: Government and Citizen portals over identical records.</li>
          <li>Daylight scene with sun shadows, sky reflections in the glazing, procedural facades, balconies,
          rooftop plant, street furniture and traffic.</li>
          <li>Restricted <b>owner records</b> — phone, age, gender, khata number — deterministic per owner, government portal only.</li>
          <li>Citizen portal: demo login, a properties list, and every unit the citizen does not own reduced to a
          featureless grey volume with no record behind it.</li>
        </ul>
      </div>
      <div class="evoCard">
        <div class="who">Prototype 4 — final</div><h4>Refinements, live here</h4>
        <ul>
          <li>Heading simplified to <b>3D ULPIN</b> across the tab title and top bar.</li>
          <li>Unmistakable selection: an additive glow that breathes, plus a bright outline around the chosen volume.</li>
          <li>Government-only <b>unit register</b>: every unit top level first, with search across ULPIN, owner and
          use class; a row click flies the selection to that volume. Hidden in the citizen portal and for corridors.</li>
          <li>Added in this build: X-ray volume mode, an explode slider, plan/orbit camera modes and a live validator.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="docSec" id="secLimits">
    <h2><span class="num">07</span>Scope cuts &amp; known gaps</h2>
    <p class="lead">Stated openly — a prototype honest about its simplifications is easier to trust.</p>
    <div class="warnbar">
      <b>Fixed floor height.</b> Floor height is a constant (3 m residential, 7 m terminal, 2.5 m hutment) rather than
      derived per building from real DSM−DEM data. The Z-range arithmetic is identical; only the input is assumed.<br><br>
      <b>Front-end only.</b> Records live in memory in the browser. There is no backend or spatial database in this
      build and no real drone or LiDAR ingestion — methodology stages 1–3 and 6 are represented, not implemented.<br><br>
      <b>Synthetic geometry.</b> Footprints, alignments and elevations are hand-authored to plausible dimensions rather
      than surveyed, and the parcels are illustrative rather than tied to a real revenue map.<br><br>
      <b>Demo authentication.</b> The citizen login is a prototype gate, not real authentication, and all owner names,
      phone numbers, ages and genders are deterministic dummy data.
    </div>
  </section>
`;

/* --------------------------------------------------------------- validator */
const state = { fp: 'same', z: 'same' };
const A = { rect: { x0: 0, x1: 6, z0: 0, z1: 8 }, zBottom: 21, zTop: 24 };
const unitB = () => ({
  rect: state.fp === 'same'
    ? { x0: 0, x1: 6, z0: 0, z1: 8 }
    : { x0: 7.4, x1: 13.4, z0: 0, z1: 8 },
  zBottom: state.z === 'same' ? 21 : 24,
  zTop: state.z === 'same' ? 24 : 27
});

function drawValidator(){
  const B = unitB();
  const r = checkPair(A, B);
  const svg = document.getElementById('valSvg');
  if (!svg) return;
  svg.innerHTML = '';

  const label = (x, y, text, fill, size = 10) => {
    const t = svgEl('text', { x, y, fill, 'font-size': size, 'font-family': 'IBM Plex Mono, monospace' });
    t.textContent = text; svg.appendChild(t);
  };
  const colA = '#95b2f7';
  const colB = r.conflict ? '#ef6b6b' : '#3ddad0';

  /* --- plan view (left): footprints in metres --- */
  label(14, 22, 'PLAN — 2D footprint', '#8a9ab5', 10);
  const PX = (v) => 20 + v * 14, PY = (v) => 44 + v * 14;
  svg.appendChild(svgEl('rect', { x: 14, y: 30, width: 216, height: 150, rx: 8,
    fill: 'rgba(255,255,255,.02)', stroke: '#1f2839' }));
  for (let g = 0; g <= 14; g += 2){
    svg.appendChild(svgEl('line', { x1: PX(g), y1: 34, x2: PX(g), y2: 176, stroke: '#1a2233' }));
  }
  const planRect = (u, col, dash) => {
    const rc = svgEl('rect', {
      x: PX(u.rect.x0), y: PY(u.rect.z0),
      width: (u.rect.x1 - u.rect.x0) * 14, height: (u.rect.z1 - u.rect.z0) * 14,
      rx: 3, fill: col + '2e', stroke: col, 'stroke-width': 1.8
    });
    if (dash) rc.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(rc);
  };
  planRect(A, colA, false);
  planRect({ rect: { ...B.rect, x0: B.rect.x0 + (state.fp === 'same' ? 0.35 : 0), x1: B.rect.x1 - (state.fp === 'same' ? 0.35 : 0), z0: B.rect.z0 + 0.35, z1: B.rect.z1 - 0.35 } }, colB, true);
  label(PX(0.4), PY(1.4), 'A', colA, 12);
  label(PX(state.fp === 'same' ? 4.6 : 12.2), PY(7.2), 'B', colB, 12);
  label(14, 194, r.fp ? 'footprints overlap' : 'footprints are disjoint', r.fp ? '#f0b25f' : '#8a9ab5', 10);

  /* --- elevation view (right): bands in metres --- */
  label(266, 22, 'ELEVATION — Z-range', '#8a9ab5', 10);
  const EY = (v) => 176 - (v - 18) * 11.5, EX = (v) => 286 + v * 14;
  svg.appendChild(svgEl('rect', { x: 262, y: 30, width: 244, height: 150, rx: 8,
    fill: 'rgba(255,255,255,.02)', stroke: '#1f2839' }));
  [18, 21, 24, 27, 30].forEach(v => {
    svg.appendChild(svgEl('line', { x1: 280, y1: EY(v), x2: 500, y2: EY(v), stroke: '#1a2233' }));
    label(264, EY(v) + 3, `${v}m`, '#61708a', 8.5);
  });
  const elevRect = (u, col, dash, inset) => {
    const rc = svgEl('rect', {
      x: EX(u.rect.x0) + inset, y: EY(u.zTop) + inset,
      width: (u.rect.x1 - u.rect.x0) * 14 - inset * 2,
      height: (u.zTop - u.zBottom) * 11.5 - inset * 2,
      rx: 3, fill: col + '2e', stroke: col, 'stroke-width': 1.8
    });
    if (dash) rc.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(rc);
  };
  elevRect(A, colA, false, 0);
  elevRect(B, colB, true, 5);
  label(EX(0.3) + 6, EY(23.3), 'A', colA, 12);
  label(EX(B.rect.x0) + 12, EY(B.zTop - 2.3), 'B', colB, 12);
  label(266, 194, r.z ? 'bands overlap' : 'bands are separate', r.z ? '#f0b25f' : '#8a9ab5', 10);

  /* --- verdict --- */
  const v = document.getElementById('valVerdict');
  v.classList.toggle('bad', r.conflict);
  const T = document.getElementById('valTitle');
  const Bd = document.getElementById('valBody');
  if (r.conflict){
    T.textContent = '✕ CONFLICT — flagged, not saved';
    Bd.textContent = 'Both records claim the same volume of space. This is precisely the overlapping-ownership case a 2D cadastre cannot see: on paper, both look like valid claims on the same parcel.';
  } else if (r.fp){
    T.textContent = '✓ VALID — vertical stack';
    Bd.textContent = 'Identical footprint, different elevation band — a flat directly above a parking slot. A 2D system reads this as a duplicate claim; the Z-range proves it is not.';
  } else if (r.z){
    T.textContent = '✓ VALID — neighbours on one level';
    Bd.textContent = 'Same elevation band, separate footprints — two units side by side on the same floor.';
  } else {
    T.textContent = '✓ VALID — unrelated claims';
    Bd.textContent = 'Neither the footprint nor the band overlaps, so the two claims are entirely independent.';
  }
  document.getElementById('valCalc').innerHTML =
    `A  x[${A.rect.x0}, ${A.rect.x1}]  z[${A.rect.z0}, ${A.rect.z1}]  Z(${A.zBottom.toFixed(1)}-${A.zTop.toFixed(1)}m)<br>` +
    `B  x[${B.rect.x0}, ${B.rect.x1}]  z[${B.rect.z0}, ${B.rect.z1}]  Z(${B.zBottom.toFixed(1)}-${B.zTop.toFixed(1)}m)<br>` +
    `footprintOverlap = <b>${r.fp}</b> &nbsp;·&nbsp; bandOverlap = <b>${r.z}</b><br>→ ${r.conflict ? 'CONFLICT' : 'VALID'}`;
}

/* ------------------------------------------------------------------ mount */
export function mountDocs(){
  const wrap = document.getElementById('docsWrap');
  if (wrap.dataset.built) return;
  wrap.dataset.built = '1';
  wrap.innerHTML = HTML;

  [['valFp', 'fp'], ['valZ', 'z']].forEach(([id, key]) => {
    document.querySelectorAll(`#${id} button`).forEach(btn => {
      btn.addEventListener('click', () => {
        state[key] = btn.dataset.v;
        document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle('on', b === btn));
        drawValidator();
      });
    });
  });
  document.querySelectorAll('#docNav button').forEach(b => {
    b.addEventListener('click', () => {
      document.getElementById(b.dataset.to)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  drawValidator();
}

export function scrollDocsTo(anchor){
  const t = document.getElementById(anchor);
  if (t) setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
}
