/*
 * model.js — Closed-loop cardiovascular model for the BioGears PV-Loop Visualiser.
 *
 * A four-chamber (LV, RV, LA, RA) time-varying-elastance heart coupled to lumped
 * systemic and pulmonary circulations through four diode-like valves. The model is
 * written as a plain ES5-compatible script so it runs unchanged in the browser
 * (attached to the global `PVLoop` namespace) and under Node.js for headless tuning.
 *
 * Physiology
 * ----------
 * Each cardiac chamber develops pressure through a time-varying elastance that
 * blends an active end-systolic relation with a passive (exponential) end-diastolic
 * relation, following Burkhoff/Smith minimal-model conventions:
 *
 *     P(V, t) = a(t)·Ees·(V − Vd) + (1 − a(t))·P0·(exp(λ·(V − V0)) − 1)
 *
 * The ventricular activation a(t) uses the same normalised double-Hill waveform that
 * BioGears applies to its left/right heart elastance (Cardiovascular.cpp,
 * CalculateHeartElastance): α1 = 0.303, α2 = 0.508, n1 = 1.32, n2 = 21.9. The default
 * ventricular Ees values (LV 2.5, RV 1.1 mmHg/mL) match the BioGears configuration
 * (LeftHeartElastanceMaximum 2.49, RightHeartElastanceMaximum 1.08). Atria use the
 * same waveform shifted earlier in the cycle to reproduce the atrial "kick".
 *
 * Units: pressure mmHg, volume mL, time s, flow mL/s,
 *        elastance mmHg/mL, compliance mL/mmHg, resistance mmHg·s/mL.
 */
(function (root) {
  'use strict';

  // ---- double-Hill ventricular activation (BioGears parameters) ---------------
  var HILL = { a1: 0.303, a2: 0.508, n1: 1.32, n2: 21.9, maxShape: 0.598 };

  function ventricularActivation(tau) {
    // tau is the fraction of the cardiac cycle elapsed in [0, 1).
    var g1 = Math.pow(tau / HILL.a1, HILL.n1);
    var rising = g1 / (1 + g1);
    var falling = 1 / (1 + Math.pow(tau / HILL.a2, HILL.n2));
    var shape = (rising * falling) / HILL.maxShape;
    return shape < 0 ? 0 : shape;
  }

  // Periodic Gaussian bump used for atrial activation (the atrial "kick").
  function atrialActivation(tau, peak, width) {
    var d = tau - peak;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    return Math.exp(-(d * d) / (2 * width * width));
  }

  // ---- default parameter set (healthy ~70 kg adult) ---------------------------
  function defaultParams() {
    return {
      // Pacing & filling
      heartRate: 72, // beats / min
      bloodVolume: 5000, // total circulating volume, mL (preload reservoir)

      // Chamber contractility — end-systolic elastance (mmHg/mL)
      lvEes: 2.5, // BioGears LeftHeartElastanceMaximum = 2.49
      rvEes: 0.95, // BioGears RightHeartElastanceMaximum = 1.08
      laEes: 0.5,
      raEes: 0.45,

      // Passive (end-diastolic) stiffness scaling per chamber (× baseline λ)
      lvStiffness: 1.0,
      rvStiffness: 1.0,
      laStiffness: 1.0,
      raStiffness: 1.0,

      // Afterload / vascular tone
      systemicResistance: 1.05, // SVR, mmHg·s/mL
      pulmonaryResistance: 0.11, // PVR, mmHg·s/mL
      arterialCompliance: 1.2, // systemic arterial compliance, mL/mmHg
      pulmonaryCompliance: 4.3, // pulmonary arterial compliance, mL/mmHg

      // Valves: stenosis 0..1 (raises forward resistance),
      //         regurgitation 0..1 (opens a backflow leak).
      mitralStenosis: 0, mitralRegurg: 0,
      aorticStenosis: 0, aorticRegurg: 0,
      tricuspidStenosis: 0, tricuspidRegurg: 0,
      pulmonicStenosis: 0, pulmonicRegurg: 0
    };
  }

  // Fixed structural constants not exposed as primary sliders.
  var STRUCT = {
    // Unstressed volumes (mL)
    v0: { lv: 8, rv: 12, la: 3, ra: 3, sa: 130, sv: 3320, pa: 40, pv: 200 },

    // Venous / capacitance compliances (mL/mmHg) — arterial ones live in params.
    cSv: 130.0, // systemic venous compliance
    cPv: 14.0, // pulmonary venous compliance

    // Non-valvular resistances (mmHg·s/mL)
    rVc: 0.05, // systemic venous return (SV -> RA)
    rPv: 0.012, // pulmonary venous (PV -> LA)

    // Base valve forward resistance (mmHg·s/mL)
    rValve: 0.0045,
    rValveClosed: 1.0e6, // competent (closed) valve leak resistance

    // ESPVR volume-axis intercepts Vd (mL)
    vd: { lv: 5, rv: 8, la: 3, ra: 3 },

    // Passive EDPVR: P0 (mmHg) and baseline lambda (1/mL); curve uses v0 above.
    edp: {
      lv: { p0: 0.5, lambda: 0.026 },
      rv: { p0: 0.28, lambda: 0.011 },
      la: { p0: 0.4, lambda: 0.055 },
      ra: { p0: 0.35, lambda: 0.050 }
    },

    // Atrial activation timing (fraction of cycle) and width.
    atrialPeak: 0.86,
    atrialWidth: 0.045
  };

  function chamberPressure(kind, V, act, params) {
    var vd = STRUCT.vd[kind];
    var edp = STRUCT.edp[kind];
    var ees;
    var stiff;
    switch (kind) {
      case 'lv': ees = params.lvEes; stiff = params.lvStiffness; break;
      case 'rv': ees = params.rvEes; stiff = params.rvStiffness; break;
      case 'la': ees = params.laEes; stiff = params.laStiffness; break;
      case 'ra': ees = params.raEes; stiff = params.raStiffness; break;
      default: ees = 1; stiff = 1;
    }
    var pes = ees * (V - vd);
    var lambda = edp.lambda * stiff;
    var ped = edp.p0 * (Math.exp(lambda * (V - STRUCT.v0[kind])) - 1);
    return act * pes + (1 - act) * ped;
  }

  // Valve flow (upstream -> downstream) as a smoothed diode.
  function valveFlow(pUp, pDown, stenosis, regurg) {
    var dp = pUp - pDown;
    var rFwd = STRUCT.rValve * (1 + 55 * stenosis * stenosis);
    if (dp >= 0) {
      return dp / rFwd; // open, forward flow
    }
    // closed: tiny competent leak, or a regurgitant orifice when regurg > 0
    var rBack = regurg > 1e-4
      ? STRUCT.rValve * (1.2 / regurg)
      : STRUCT.rValveClosed;
    return dp / rBack; // negative (backflow)
  }

  function CVModel(params) {
    this.params = Object.assign(defaultParams(), params || {});
    this.t = 0; // absolute simulation time (s)
    this.cycleTime = 0; // time within current cardiac cycle (s)
    this.beat = 0; // completed-beat counter
    this.dt = 2.0e-5; // integrator step (s)
    this.reset();
  }

  CVModel.prototype.reset = function () {
    // Initial volumes (mL) chosen close to steady state to speed convergence.
    this.V = { lv: 120, rv: 130, la: 45, ra: 45, sa: 250, sv: 3300, pa: 110, pv: 230 };
    this.t = 0;
    this.cycleTime = 0;
    this.beat = 0;
    this.act = { lv: 0, rv: 0, la: 0, ra: 0 };
    this.flow = { mv: 0, av: 0, tv: 0, pv: 0, sys: 0, vc: 0, pul: 0, pvv: 0 };
    this.P = { lv: 0, rv: 0, la: 0, ra: 0, sa: 0, sv: 0, pa: 0, pv: 0 };
    this._rescaleToBloodVolume();
  };

  // Adjust the venous reservoir so total volume matches params.bloodVolume.
  CVModel.prototype._rescaleToBloodVolume = function () {
    var total = 0, k;
    for (k in this.V) total += this.V[k];
    var delta = this.params.bloodVolume - total;
    this.V.sv = Math.max(STRUCT.v0.sv * 0.4, this.V.sv + delta);
  };

  CVModel.prototype.setBloodVolume = function (mL) {
    this.params.bloodVolume = mL;
    this._rescaleToBloodVolume();
  };

  CVModel.prototype.period = function () {
    return 60 / this.params.heartRate;
  };

  // Compute pressures & activations for the current state without integrating.
  CVModel.prototype._evaluate = function () {
    var p = this.params;
    var T = this.period();
    var tau = this.cycleTime / T;
    var av = ventricularActivation(tau);
    var aa = atrialActivation(tau, STRUCT.atrialPeak, STRUCT.atrialWidth);
    this.act.lv = av; this.act.rv = av; this.act.la = aa; this.act.ra = aa;

    var V = this.V, P = this.P;
    P.lv = chamberPressure('lv', V.lv, av, p);
    P.rv = chamberPressure('rv', V.rv, av, p);
    P.la = chamberPressure('la', V.la, aa, p);
    P.ra = chamberPressure('ra', V.ra, aa, p);
    P.sa = (V.sa - STRUCT.v0.sa) / p.arterialCompliance;
    P.sv = (V.sv - STRUCT.v0.sv) / STRUCT.cSv;
    P.pa = (V.pa - STRUCT.v0.pa) / p.pulmonaryCompliance;
    P.pv = (V.pv - STRUCT.v0.pv) / STRUCT.cPv;
  };

  // One explicit-Euler sub-step.
  CVModel.prototype._step = function () {
    var p = this.params, V = this.V, P = this.P, F = this.flow, dt = this.dt;
    this._evaluate();

    F.mv = valveFlow(P.la, P.lv, p.mitralStenosis, p.mitralRegurg);
    F.av = valveFlow(P.lv, P.sa, p.aorticStenosis, p.aorticRegurg);
    F.tv = valveFlow(P.ra, P.rv, p.tricuspidStenosis, p.tricuspidRegurg);
    F.pv = valveFlow(P.rv, P.pa, p.pulmonicStenosis, p.pulmonicRegurg);

    F.sys = (P.sa - P.sv) / p.systemicResistance;
    F.vc = (P.sv - P.ra) / STRUCT.rVc;
    F.pul = (P.pa - P.pv) / p.pulmonaryResistance;
    F.pvv = (P.pv - P.la) / STRUCT.rPv;

    V.lv += dt * (F.mv - F.av);
    V.sa += dt * (F.av - F.sys);
    V.sv += dt * (F.sys - F.vc);
    V.ra += dt * (F.vc - F.tv);
    V.rv += dt * (F.tv - F.pv);
    V.pa += dt * (F.pv - F.pul);
    V.pv += dt * (F.pul - F.pvv);
    V.la += dt * (F.pvv - F.mv);

    // Numerical floor: compartments cannot hold negative volume. This keeps
    // severe states (e.g. profound hypovolemia) bounded and stable.
    if (V.lv < 0.5) V.lv = 0.5;
    if (V.rv < 0.5) V.rv = 0.5;
    if (V.la < 0.5) V.la = 0.5;
    if (V.ra < 0.5) V.ra = 0.5;
    if (V.sa < STRUCT.v0.sa * 0.2) V.sa = STRUCT.v0.sa * 0.2;
    if (V.pa < STRUCT.v0.pa * 0.2) V.pa = STRUCT.v0.pa * 0.2;
    if (V.pv < STRUCT.v0.pv * 0.2) V.pv = STRUCT.v0.pv * 0.2;
    if (V.sv < STRUCT.v0.sv * 0.2) V.sv = STRUCT.v0.sv * 0.2;

    this.cycleTime += dt;
    this.t += dt;
    if (this.cycleTime >= this.period()) {
      this.cycleTime -= this.period();
      this.beat += 1;
    }
  };

  // Advance the model by `seconds` of simulated time.
  CVModel.prototype.advance = function (seconds) {
    var n = Math.max(1, Math.round(seconds / this.dt));
    for (var i = 0; i < n; i++) this._step();
    this._evaluate();
  };

  // End-systolic (maximally active) pressure for a chamber at volume V — the ESPVR.
  CVModel.prototype.endSystolicP = function (kind, V) {
    return chamberPressure(kind, V, 1, this.params);
  };

  // End-diastolic (fully relaxed) pressure for a chamber at volume V — the EDPVR.
  CVModel.prototype.endDiastolicP = function (kind, V) {
    return chamberPressure(kind, V, 0, this.params);
  };

  // Run silently to a near-steady state (used on init / parameter changes).
  CVModel.prototype.settle = function (beats) {
    var target = this.beat + (beats || 12);
    var guard = 0;
    while (this.beat < target && guard < 5e7) {
      this._step();
      guard++;
    }
    this._evaluate();
  };

  root.PVLoop = root.PVLoop || {};
  root.PVLoop.CVModel = CVModel;
  root.PVLoop.defaultParams = defaultParams;
  root.PVLoop.STRUCT = STRUCT;
  root.PVLoop.ventricularActivation = ventricularActivation;
  root.PVLoop.atrialActivation = atrialActivation;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.PVLoop;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
