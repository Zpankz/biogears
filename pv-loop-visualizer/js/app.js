/*
 * app.js — Application glue. Owns the model, runs the animation loop, records
 * per-beat loop / waveform buffers, computes hemodynamic metrics, smooths the
 * plot axes, and wires the UI controls to the model.
 */
(function (root) {
  'use strict';

  var PV = root.PVLoop;
  var CHAMBERS = ['lv', 'rv', 'la', 'ra'];

  // ---- shared sampling helpers ------------------------------------------------
  function emptyCycle() { return { lv: [], rv: [], la: [], ra: [], saMin: Infinity, saMax: -Infinity, saSum: 0, paMin: Infinity, paMax: -Infinity, paSum: 0, n: 0 }; }

  // Sample exactly one cardiac cycle (aligned to a beat boundary) without disturbing
  // the caller's expectations — used to seed initial loops and the "Normal" ghost.
  function sampleOneCycle(model, n) {
    n = n || 600;
    var startBeat = model.beat;
    while (model.beat === startBeat) model._step();
    var T = model.period();
    var dtS = T / n;
    var cyc = emptyCycle();
    for (var i = 0; i < n; i++) {
      model.advance(dtS);
      for (var ci = 0; ci < CHAMBERS.length; ci++) {
        var k = CHAMBERS[ci];
        cyc[k].push({ v: model.V[k], p: model.P[k] });
      }
      accum(cyc, model);
    }
    return cyc;
  }

  function accum(cyc, model) {
    var sa = model.P.sa, pa = model.P.pa;
    if (sa < cyc.saMin) cyc.saMin = sa;
    if (sa > cyc.saMax) cyc.saMax = sa;
    if (pa < cyc.paMin) cyc.paMin = pa;
    if (pa > cyc.paMax) cyc.paMax = pa;
    cyc.saSum += sa; cyc.paSum += pa; cyc.n++;
  }

  function chamberStats(arr) {
    var edv = -Infinity, esv = Infinity, pMax = -Infinity, pMin = Infinity, pSum = 0;
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      if (s.v > edv) edv = s.v;
      if (s.v < esv) esv = s.v;
      if (s.p > pMax) pMax = s.p;
      if (s.p < pMin) pMin = s.p;
      pSum += s.p;
    }
    var sv = edv - esv;
    return { edv: edv, esv: esv, sv: sv, ef: edv > 0 ? (sv / edv) * 100 : 0, pMax: pMax, pMin: pMin, pMean: pSum / arr.length };
  }

  function metricsFromCycle(cyc, hr) {
    var lv = chamberStats(cyc.lv), rv = chamberStats(cyc.rv);
    var la = chamberStats(cyc.la), ra = chamberStats(cyc.ra);
    var map = cyc.n ? cyc.saSum / cyc.n : 0;
    var pamean = cyc.n ? cyc.paSum / cyc.n : 0;
    return {
      lv: lv, rv: rv, la: la, ra: ra,
      sys: { sbp: cyc.saMax, dbp: cyc.saMin, map: map },
      pulm: { pas: cyc.paMax, pad: cyc.paMin, pamean: pamean },
      co: (lv.sv * hr) / 1000, hr: hr
    };
  }

  // ---- application state ------------------------------------------------------
  var model = new PV.CVModel();
  var baseline = Object.assign({}, model.params); // current preset's params
  var visible = { lv: true, rv: true, la: false, ra: false };
  var opts = { running: true, speed: 1, showRelations: true, autoScale: true, showGhost: false };

  var rec = {
    loop: { lv: [], rv: [], la: [], ra: [] },
    cur: { lv: [], rv: [], la: [], ra: [] },
    cyc: emptyCycle(),
    wave: [],
    span: 4.0,
    lastBeat: 0,
    metrics: null
  };
  var axis = { vMax: 200, pMax: 140 };
  var waveScale = { p: 140, v: 160 };
  var ghost = null;
  var phase = 0;

  // ---- DOM ----
  var el = {
    pv: document.getElementById('pvCanvas'),
    wave: document.getElementById('waveCanvas'),
    heart: document.getElementById('heartCanvas'),
    metrics: document.getElementById('metrics'),
    controls: document.getElementById('controlGroups'),
    toggles: document.getElementById('chamberToggles'),
    preset: document.getElementById('presetSelect'),
    blurb: document.getElementById('scenarioBlurb'),
    beatHint: document.getElementById('beatHint'),
    waveHint: document.getElementById('waveHint'),
    play: document.getElementById('playBtn'),
    reset: document.getElementById('resetBtn'),
    stabilize: document.getElementById('stabilizeBtn'),
    showRelations: document.getElementById('showRelations'),
    autoScale: document.getElementById('autoScale'),
    showGhost: document.getElementById('showGhost')
  };

  var controlsApi = PV.ui.buildControls(el.controls, model.params, baseline, function (key, value) {
    if (key === 'bloodVolume') model.setBloodVolume(value);
    else model.params[key] = value;
  });

  PV.ui.buildChamberToggles(el.toggles, visible, function () {});

  PV.ui.buildPresetSelect(el.preset, PV.presets, applyPreset);

  function computeGhost() {
    var g = new PV.CVModel();
    g.settle(16);
    var cyc = sampleOneCycle(g, 400);
    ghost = { lv: cyc.lv, rv: cyc.rv, la: cyc.la, ra: cyc.ra };
  }

  function seedFromCycle() {
    // jump to steady state and pre-fill loops + metrics so the UI is populated at t=0
    model.settle(14);
    var cyc = sampleOneCycle(model, 400);
    CHAMBERS.forEach(function (k) { rec.loop[k] = cyc[k]; });
    rec.metrics = metricsFromCycle(cyc, model.params.heartRate);
    rec.lastBeat = model.beat;
    rec.cur = { lv: [], rv: [], la: [], ra: [] };
    rec.cyc = emptyCycle();
    rec.wave = [];
    PV.ui.renderMetrics(el.metrics, rec.metrics);
  }

  function applyPreset(name) {
    var preset = PV.presets[name];
    if (!preset) return;
    var params = Object.assign(PV.defaultParams(), preset.params);
    model.params = params;
    model.reset();
    baseline = Object.assign({}, params);
    controlsApi.refresh(model.params, baseline);
    el.blurb.textContent = preset.blurb;
    el.preset.value = name;
    seedFromCycle();
  }

  // ---- recording during live animation ---------------------------------------
  function record() {
    for (var ci = 0; ci < CHAMBERS.length; ci++) {
      var k = CHAMBERS[ci];
      rec.cur[k].push({ v: model.V[k], p: model.P[k] });
    }
    accum(rec.cyc, model);
    rec.wave.push({ t: model.t, plv: model.P.lv, psa: model.P.sa, pla: model.P.la, vlv: model.V.lv });

    if (model.beat !== rec.lastBeat) {
      for (var i = 0; i < CHAMBERS.length; i++) {
        var c = CHAMBERS[i];
        if (rec.cur[c].length > 4) rec.loop[c] = rec.cur[c];
        rec.cur[c] = [];
      }
      // Chamber stats come from the just-completed loops; aortic/PA stats from the
      // per-cycle scalar accumulator (rec.cyc).
      var completed = {
        lv: rec.loop.lv, rv: rec.loop.rv, la: rec.loop.la, ra: rec.loop.ra,
        saMin: rec.cyc.saMin, saMax: rec.cyc.saMax, saSum: rec.cyc.saSum,
        paMin: rec.cyc.paMin, paMax: rec.cyc.paMax, paSum: rec.cyc.paSum, n: rec.cyc.n
      };
      rec.metrics = metricsFromCycle(completed, model.params.heartRate);
      rec.cyc = emptyCycle();
      rec.lastBeat = model.beat;
      PV.ui.renderMetrics(el.metrics, rec.metrics);
      if (el.beatHint) el.beatHint.textContent = 'beat ' + model.beat;
    }

    // trim waveform buffer to the visible span
    var cutoff = model.t - rec.span;
    while (rec.wave.length && rec.wave[0].t < cutoff) rec.wave.shift();
  }

  // ---- axis smoothing ---------------------------------------------------------
  function updateAxes() {
    var vTarget, pTarget;
    if (opts.autoScale) {
      var vm = 0, pm = 0;
      CHAMBERS.forEach(function (k) {
        if (!visible[k]) return;
        var arrs = [rec.loop[k], rec.cur[k]];
        if (opts.showGhost && ghost && ghost[k]) arrs.push(ghost[k]);
        arrs.forEach(function (arr) {
          for (var i = 0; i < arr.length; i++) {
            if (arr[i].v > vm) vm = arr[i].v;
            if (arr[i].p > pm) pm = arr[i].p;
          }
        });
      });
      vTarget = Math.max(80, Math.ceil((vm * 1.12) / 20) * 20);
      pTarget = Math.max(30, Math.ceil((pm * 1.14) / 10) * 10);
    } else {
      var ventricle = visible.lv || visible.rv;
      vTarget = ventricle ? 260 : 120;
      pTarget = ventricle ? 220 : 45;
    }
    axis.vMax += (vTarget - axis.vMax) * 0.10;
    axis.pMax += (pTarget - axis.pMax) * 0.10;
  }

  function updateWaveScale() {
    var pm = 60, vm = 100;
    for (var i = 0; i < rec.wave.length; i++) {
      if (rec.wave[i].psa > pm) pm = rec.wave[i].psa;
      if (rec.wave[i].plv > pm) pm = rec.wave[i].plv;
      if (rec.wave[i].vlv > vm) vm = rec.wave[i].vlv;
    }
    var pT = Math.ceil((pm * 1.1) / 20) * 20;
    var vT = Math.ceil((vm * 1.15) / 20) * 20;
    waveScale.p += (pT - waveScale.p) * 0.08;
    waveScale.v += (vT - waveScale.v) * 0.08;
  }

  // ---- main loop --------------------------------------------------------------
  var lastTs = 0;
  function frame(ts) {
    var dtReal = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;
    phase = (phase + dtReal * 1.4) % 1;

    if (opts.running) {
      var simSeconds = Math.min(0.05, opts.speed * dtReal); // clamp jumps
      var sampleDt = 0.004;
      var remaining = simSeconds;
      var guard = 0;
      while (remaining > 1e-6 && guard < 400) {
        var step = Math.min(sampleDt, remaining);
        model.advance(step);
        record();
        remaining -= step;
        guard++;
      }
    } else {
      model._evaluate();
    }

    updateAxes();
    updateWaveScale();

    PV.plots.drawPVLoops(el.pv, {
      model: model, axis: axis, visible: visible,
      loop: rec.loop, cur: rec.cur,
      head: { lv: peek(rec.cur.lv, rec.loop.lv), rv: peek(rec.cur.rv, rec.loop.rv), la: peek(rec.cur.la, rec.loop.la), ra: peek(rec.cur.ra, rec.loop.ra) },
      showRelations: opts.showRelations,
      ghost: opts.showGhost ? ghost : null
    });
    PV.plots.drawWaves(el.wave, {
      wave: rec.wave, span: rec.span, tNow: model.t,
      pScale: waveScale.p, vScale: waveScale.v
    });
    PV.plots.drawHeart(el.heart, { model: model, phase: phase });

    requestAnimationFrame(frame);
  }

  function peek(cur, loop) {
    if (cur && cur.length) return cur[cur.length - 1];
    if (loop && loop.length) return loop[loop.length - 1];
    return null;
  }

  // ---- control wiring ---------------------------------------------------------
  el.play.addEventListener('click', function () {
    opts.running = !opts.running;
    el.play.textContent = opts.running ? 'Pause' : 'Play';
    el.play.classList.toggle('btn-primary', opts.running);
  });
  el.reset.addEventListener('click', function () { applyPreset(el.preset.value); });
  el.stabilize.addEventListener('click', function () { seedFromCycle(); });
  el.showRelations.addEventListener('change', function () { opts.showRelations = el.showRelations.checked; });
  el.autoScale.addEventListener('change', function () { opts.autoScale = el.autoScale.checked; });
  el.showGhost.addEventListener('change', function () { opts.showGhost = el.showGhost.checked; });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
      e.preventDefault();
      el.play.click();
    }
  });

  // ---- boot -------------------------------------------------------------------
  el.blurb.textContent = PV.presets.normal.blurb;
  el.preset.value = 'normal';
  if (el.waveHint) el.waveHint.textContent = 'last ' + rec.span.toFixed(0) + ' s';
  computeGhost();
  seedFromCycle();
  requestAnimationFrame(frame);

  root.PVLoop.app = { model: model, state: rec, opts: opts };
})(typeof globalThis !== 'undefined' ? globalThis : this);
