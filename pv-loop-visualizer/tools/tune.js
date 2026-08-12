/* Headless tuning / validation harness for the cardiovascular model.
 * Run: node pv-loop-visualizer/tools/tune.js [presetName]
 * Reports per-chamber EDV/ESV/SV/EF and circulatory pressures over one beat. */
'use strict';
const path = require('path');
const { CVModel } = require(path.join(__dirname, '..', 'js', 'model.js'));
let presets = {};
try { presets = require(path.join(__dirname, '..', 'js', 'presets.js')).presets; } catch (e) {}

function sampleBeat(model, samples) {
  samples = samples || 2000;
  const T = model.period();
  const dtSample = T / samples;
  const rec = { lv: [], rv: [], la: [], ra: [], t: [], pSa: [], pPa: [], pLa: [], pRa: [] };
  // align to start of a cardiac cycle
  const startBeat = model.beat;
  while (model.beat === startBeat) model._step();
  for (let i = 0; i < samples; i++) {
    model.advance(dtSample);
    rec.t.push(i * dtSample);
    rec.lv.push({ v: model.V.lv, p: model.P.lv });
    rec.rv.push({ v: model.V.rv, p: model.P.rv });
    rec.la.push({ v: model.V.la, p: model.P.la });
    rec.ra.push({ v: model.V.ra, p: model.P.ra });
    rec.pSa.push(model.P.sa);
    rec.pPa.push(model.P.pa);
    rec.pLa.push(model.P.la);
    rec.pRa.push(model.P.ra);
  }
  return rec;
}

function chamberMetrics(arr) {
  let edv = -Infinity, esv = Infinity, pMax = -Infinity, pMin = Infinity;
  for (const s of arr) {
    if (s.v > edv) edv = s.v;
    if (s.v < esv) esv = s.v;
    if (s.p > pMax) pMax = s.p;
    if (s.p < pMin) pMin = s.p;
  }
  const sv = edv - esv;
  return { edv, esv, sv, ef: (sv / edv) * 100, pMax, pMin };
}

function stat(arr) {
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
  return { min: mn, max: mx, mean: sum / arr.length };
}

function run(presetName) {
  const params = presetName && presets[presetName] ? presets[presetName].params : {};
  const model = new CVModel(params);
  model.settle(30);
  const rec = sampleBeat(model);
  const hr = model.params.heartRate;
  const lv = chamberMetrics(rec.lv);
  const rv = chamberMetrics(rec.rv);
  const la = chamberMetrics(rec.la);
  const ra = chamberMetrics(rec.ra);
  const co = (lv.sv * hr) / 1000;
  const sa = stat(rec.pSa), pa = stat(rec.pPa), pla = stat(rec.pLa), pra = stat(rec.pRa);
  let totalVol = 0; for (const k in model.V) totalVol += model.V[k];

  const f = (x, d = 0) => x.toFixed(d);
  console.log(`\n=== ${presetName || 'default'} (HR ${hr}) ===`);
  console.log(`LV  EDV ${f(lv.edv)} ESV ${f(lv.esv)} SV ${f(lv.sv)} EF ${f(lv.ef)}%  P ${f(lv.pMin)}–${f(lv.pMax)}`);
  console.log(`RV  EDV ${f(rv.edv)} ESV ${f(rv.esv)} SV ${f(rv.sv)} EF ${f(rv.ef)}%  P ${f(rv.pMin)}–${f(rv.pMax)}`);
  console.log(`LA  Vmin ${f(la.esv)} Vmax ${f(la.edv)}  P ${f(la.pMin)}–${f(la.pMax)}`);
  console.log(`RA  Vmin ${f(ra.esv)} Vmax ${f(ra.edv)}  P ${f(ra.pMin)}–${f(ra.pMax)}`);
  console.log(`Aorta ${f(sa.min)}/${f(sa.max)} (MAP ${f(sa.mean)})   PA ${f(pa.min)}/${f(pa.max)} (mean ${f(pa.mean)})`);
  console.log(`LA mean ${f(pla.mean)}  RA mean ${f(pra.mean)}  CO ${f(co, 2)} L/min  Vtot ${f(totalVol)} mL`);
  return { lv, rv, la, ra, co, sa, pa };
}

const arg = process.argv[2];
if (arg === 'all') {
  run();
  for (const k of Object.keys(presets)) run(k);
} else {
  run(arg);
}
