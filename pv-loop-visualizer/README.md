# PV-Loop Explorer

An interactive, four-chamber **pressure–volume (PV) loop** visualiser for the
left ventricle (LV), right ventricle (RV), left atrium (LA) and right atrium (RA).
It runs a real-time, closed-loop cardiovascular simulation in the browser and lets
you reshape the loops by dragging physiological parameters or loading clinical
scenarios.

The heart model is grounded in the **BioGears®** physiology engine: the ventricular
activation waveform and default chamber elastances are taken directly from
`projects/biogears/libBiogears/src/engine/Systems/Cardiovascular.cpp`
(`CalculateHeartElastance`) and `BioGearsConfiguration.cpp`.

> ⚠️ Educational tool — not for clinical use.

---

## Quick start

No build step and no dependencies. Either:

- **Open directly:** double-click `index.html` (it loads as plain `file://`), or
- **Serve locally** (recommended):

```bash
cd pv-loop-visualizer
python3 -m http.server 8080
# then browse to http://localhost:8080
```

## What you can do

- **Watch live loops trace** for any combination of the four chambers. Toggle
  `LV · RV · LA · RA` with the chips above the plot. With only the atria selected
  the axes auto-zoom so you can see the low-pressure atrial loops in detail.
- **Drag parameters** — heart rate, blood volume (preload), per-chamber
  contractility (Ees) and diastolic stiffness, systemic/pulmonary resistance,
  arterial/pulmonary compliance, and stenosis/regurgitation for all four valves.
  Every change reshapes the loops in real time. Sliders that differ from the
  current scenario are highlighted.
- **Load clinical scenarios** from the *Scenario* menu (see below).
- **Read the reference relations** — the dashed **ESPVR** (contractility) and
  **EDPVR** (compliance) curves are drawn for each visible chamber.
- **Compare with normal** — tick *Compare with Normal* to overlay the healthy
  resting loops as a dashed ghost.
- **Cross-check the physiology** via the scrolling **Wiggers waveforms**
  (LV / aortic / LA pressures and LV volume), the **cardiac schematic** (live
  chamber filling, valve open/closed state and flow), and the **hemodynamics**
  panel (EDV, ESV, SV, EF, pressures, MAP, CO, PA pressures).
- **Transport controls:** *Pause* (or press `Space`), *Stabilize* (fast-forward to
  steady state), *Reset* (return to the scenario defaults).

## Scenarios

| Scenario | What it demonstrates |
|---|---|
| Normal | Healthy resting adult (~120/8 mmHg, EF ~60%, CO ~5 L/min) |
| Exercise | High sympathetic drive — fast, vigorous, vasodilated, high CO |
| Systolic HF (HFrEF) | Dilated weak LV, low EF, rightward-shifted loop, congestion |
| Diastolic HF (HFpEF) | Stiff LV, preserved EF, high filling pressures |
| Hypertension | High afterload and stiff arteries; tall, narrow loop |
| Hemorrhage / Hypovolemia | Reduced preload; small, leftward-shifted loops |
| Aortic Stenosis | Large LV–aortic systolic gradient, tall square LV loop |
| Aortic Regurgitation | Wide pulse pressure, dilated LV, loss of isovolumic relaxation |
| Mitral Regurgitation | Giant LA v-wave, volume-overloaded LV, no true isovolumic phase |
| Mitral Stenosis | Impeded LV filling, high LA pressure, small underfilled LV |
| Pulmonary Hypertension | High PVR loads the RV; the RV loop enlarges markedly |

## The model

A lumped, closed-loop circulation links eight compartments:

```
LV ─(aortic)→ systemic arteries ─(SVR)→ systemic veins ─→ RA ─(tricuspid)→
RV ─(pulmonic)→ pulmonary arteries ─(PVR)→ pulmonary veins ─→ LA ─(mitral)→ LV
```

- **Chambers (LV, RV, LA, RA)** develop pressure through a time-varying elastance
  that blends an active end-systolic relation with a passive (exponential)
  end-diastolic relation, following Burkhoff/Smith minimal-model conventions:

  ```
  P(V, t) = a(t)·Ees·(V − Vd) + (1 − a(t))·P0·(exp(λ·(V − V0)) − 1)
  ```

  The **ventricular activation** `a(t)` is the normalised double-Hill waveform used
  by BioGears (α₁ = 0.303, α₂ = 0.508, n₁ = 1.32, n₂ = 21.9). The atria use the
  same waveform shifted earlier in the cycle to reproduce the atrial "kick".
- **Vessels** are linear compliances; **resistances** connect compartments.
- **Valves** are diodes: forward flow through a small resistance, near-zero
  backflow when competent. *Stenosis* raises the forward resistance; *regurgitation*
  opens a backflow leak.
- Volumes are integrated with an explicit sub-stepped solver; total blood volume is
  conserved (preload changes adjust the systemic venous reservoir).

Units throughout: pressure mmHg, volume mL, time s, flow mL/s, elastance mmHg/mL,
compliance mL/mmHg, resistance mmHg·s/mL.

### Default parameters vs. BioGears

| Quantity | This model | BioGears config |
|---|---|---|
| LV max elastance (Ees) | 2.5 mmHg/mL | `LeftHeartElastanceMaximum` 2.49 |
| RV max elastance (Ees) | ~1.0 mmHg/mL | `RightHeartElastanceMaximum` 1.08 |
| Ventricular activation | double-Hill | `CalculateHeartElastance` double-Hill |

BioGears models the LV and RV as time-varying elastances with passive atria; this
tool extends that with **actively contracting atria** so all four chambers produce
true PV loops.

## Files

```
pv-loop-visualizer/
├── index.html        # layout
├── styles.css        # dark dashboard theme
├── js/
│   ├── model.js      # closed-loop cardiovascular model (browser + Node)
│   ├── presets.js    # clinical scenarios
│   ├── plots.js      # canvas renderers (PV loops, Wiggers, schematic)
│   ├── ui.js         # controls, presets, metrics
│   └── app.js        # animation loop + glue
└── tools/
    └── tune.js       # headless Node harness for validating the model
```

## Validating the model headlessly

`tools/tune.js` runs the model to steady state under Node and prints per-chamber
EDV/ESV/SV/EF and circulatory pressures — handy for retuning parameters:

```bash
node pv-loop-visualizer/tools/tune.js all      # every preset
node pv-loop-visualizer/tools/tune.js hfref     # one scenario
```

## References

- BioGears Cardiovascular Methodology (`Cardiovascular.cpp`).
- Stergiopulos N, et al. *Elastance of the canine left ventricle* — double-Hill
  activation form.
- Burkhoff D, et al. *Pressure–volume analysis of the cardiovascular system*.
- Smith BW, et al. *Minimal haemodynamic system model* (closed-loop elastance model).
