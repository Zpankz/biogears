# BioGears Explorer

Nested, hierarchical, interactive **physiology · pharmacology · physics** study tool.
Neon-schematic UI with live educational models grounded in [BioGears](https://www.biogearsengine.com/) source constants and control logic.

> Educational tool — not for clinical use.

## Quick start

No build step. From the repo root:

```bash
python3 -m http.server 8080
# open http://localhost:8080/biogears-explorer/
```

Or open `biogears-explorer/index.html` after serving (relative load of `../pv-loop-visualizer/js/model.js` needs HTTP, not `file://`).

Headless model checks:

```bash
node biogears-explorer/tools/verify.js
```

## What you get

- **Hierarchy navigator** — Organism → System → Process, with breadcrumbs, tree, and minimap.
- **Neon schematic stage** — live node/edge diagrams with animated flow (aesthetic of the reference physiology HUD diagrams).
- **Parameter controls + metrics** — drag sliders; traces and readouts update in real time.
- **Cross-links** — optional couplings (e.g. PK/PD → HR/Ees, chemoreflex → VA).
- **Evidence strip** — each node cites BioGears file/function + literature keys.

## Concept nodes (prototype)

| Node | Tier | Model | BioGears grounding |
|---|---|---|---|
| Cardiovascular | system/leaf | Reuses `pv-loop-visualizer` closed-loop elastance | `Cardiovascular.cpp` double-Hill, Ees maxima |
| Human Thermostat | process | Core–skin two-node + effectors | `Energy.cpp`, `Environment.cpp` |
| CO₂ / Acid–Base | process | Production–carriage–elimination–drive | `BloodChemistry.cpp`, `Respiratory.cpp` |
| PK / PD | process | 1-compartment + effect-site EC₅₀ Eₘₐₓ | `Drugs.cpp` |
| Gas Exchange | process | Alveolar gas + CaO₂ / DO₂ | Respiratory / Diffusion concepts |
| Membrane Signalling | process | Occupancy + pathway cascades | Educational receptor kinetics |

Parent overview nodes (Organism, Energy, Respiratory, Blood Chemistry, Cell Signalling, Pharmacology) provide zoom-out maps.

## Architecture

```
biogears-explorer/
├── index.html
├── styles.css
├── js/
│   ├── kernel.js       # integrator helpers, Series, Emax, node contract
│   ├── schematic.js    # neon draw kit (glow, nodes, edges, flow, gauges)
│   ├── registry.js     # graph + cross-link bus
│   ├── navigator.js    # tree, breadcrumbs, minimap
│   ├── controls.js     # sliders, metrics, evidence text
│   ├── app.js          # boot, RAF loop, hash routing, parents
│   └── nodes/          # one file per concept (self-registering)
├── data/references.js
└── tools/verify.js
```

### Node contract

Each file under `js/nodes/` calls `BGX.registry.register({...})` with:

| Field | Role |
|---|---|
| `meta` | `id`, `title`, `tier`, `parents[]`, `blurb`, `color` |
| `createModel()` | `{ params, state, reset, setParam, advance, settle, getSeries, getFluxes }` |
| `schematic(ctx, kit, model, t, layout)` | neon draw |
| `controls` | slider group descriptors |
| `metrics(model)` | readout rows |
| `links` | named inputs/outputs for the cross-link bus |
| `references` | keys into `data/references.js` |

Adding a module = drop a file, include a `<script>` tag in `index.html`, done.

## Interaction

- Click tree / minimap / overview child to **descend**.
- **Esc** or **Up** to ascend.
- **Space** play/pause. Stabilize fast-forwards; Reset restores defaults.
- URL hash `#nodeId` deep-links a concept for study/sharing.

## Provenance notes

Models are **hand-ported educational reductions** of BioGears logic (same approach as the existing PV-Loop Explorer), not a WASM build of the C++ engine. Constants and control structure are cited per node; quantitative fidelity is suitable for learning and exploration, not clinical decision support.

## Related

- [`pv-loop-visualizer/`](../pv-loop-visualizer/) — four-chamber PV-loop tool reused as the Cardiovascular leaf.
- BioGears engine sources under `projects/biogears/libBiogears/src/engine/Systems/`.
