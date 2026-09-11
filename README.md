# 3D ULPIN — Vertical Property Mapping

A browser-based volumetric cadastre prototype for the Smart India Hackathon problem statement
*"3D ULPIN Generation and Vertical Property Mapping System"* (theme: Smart Automation).

All four prototype stages are folded into a single application, over one shared dataset.

## Run it

The app is an ES-module project, so it must be **served over HTTP** — opening `index.html`
from the filesystem will not work.

```bash
python3 serve.py
```

Then open <http://localhost:8123>. Pass a port as an argument to use a different one.

## What is in the build

| Stage | Where it lives |
|---|---|
| **Prototype 1** — single parcel | Hub → *Single Building*: one parcel, 5 floors × 2 units plus a basement level, with the DEM/DSM derivation shown on screen |
| **Prototype 2** — multi-tier locality | Hub → *Multi-Tier Locality*: Tier 1 (towers, two elevated metro viaducts with a running train, a buried utility trunk, an airport with its own control-tower ID), Tier 2 (towers + bungalows), Tier 3 (crop parcels, hutments, one unresolved-ownership plot) |
| **Prototype 3** — digital twin + portals | Hub → *Digital Twin Portals*: Government and Citizen portals over identical records |
| **Prototype 4** — refinements | Applied throughout: the glowing selection, the government-only unit register, plus the volume mode, explode slider and live validator added in this build |
| Reference | Hub → *Scheme & algorithm* / *Topology validator* / *Prototype log* |

Demo citizen accounts: `rohan`, `ananya`, `vikram` — password `demo123` for all.

## Viewer controls

Drag to orbit · scroll to zoom · **Esc** back · **X** volume mode · **P** plan view · **L** labels.
The HUD also carries an explode slider and a manual *Validate topology* button.

## The ID scheme

```
[Base ULPIN 14 chars] - [Structure] - [Level] - [Unit] - [Z-range]
KA1234567890AB        - B01         - F07     - U12    - Z(21.0-24.0m)
```

Below-ground levels use a `B`-prefixed level code and a negative band (`B01-Z(-3.0~0.0m)`); bands with a
negative bound separate their bounds with `~` so the signs stay readable.
Infrastructure that belongs to no floor at all carries a band only:

```
MH123456780050-COR-M01-Z(8.0-11.5m)      elevated metro viaduct (air-rights)
MH123456780060-UTL01-Z(-4.5~-3.0m)       subsurface utility trunk
```

## Layout

```
index.html            application shell (screens, panels, HUD)
serve.py              no-cache static server for local development
assets/css/app.css    all styling
src/
  main.js             navigation state machine + wiring
  data/ulpin.js       ID generation, owner records, topology validation (stages 4 & 5)
  data/world.js       the three localities and the single-parcel demo, in metres
  three/scene.js      renderer, sky, lighting, camera rig, site assembler
  three/building.js   floor-by-floor architecture, unit volumes, explode / X-ray / masking
  three/corridor.js   metro viaducts and buried utility runs
  three/materials.js  procedural canvas textures and shared materials
  three/props.js      roads, parks, trees, street furniture, boundaries, backdrop city
  ui/panels.js        record panel, unit register, toasts, legend
  ui/docs.js          reference screen and the interactive validator
archive/              the two earlier single-file builds, kept for reference
```

Nothing is fetched at runtime except `three` from a CDN and the two web fonts; every texture is
generated on a canvas at load time.

## Stated limitations

Floor heights are constants rather than derived per building from real DSM−DEM data; records live
in memory in the browser with no backend or spatial database; geometry is hand-authored to
plausible dimensions rather than surveyed; the citizen login is a prototype gate, not real
authentication, and every owner name and personal detail is deterministic dummy data.
These are listed in the app under *Reference → Scope cuts & known gaps*.
