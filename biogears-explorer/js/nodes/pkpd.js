/*
 * pkpd.js — One-compartment PK + effect-site PD (EC50 Emax).
 * Mirrors BioGears Drugs.cpp CalculateDrugEffects / EffectSiteRateConstant /
 * CalculateSubstanceClearance (educational reduction).
 */
(function (root) {
  'use strict';

  var K = root.BGX.kernel;
  var COLORS = root.BGX.schematic.COLORS;

  function defaultParams() {
    return {
      dose: 0,              // mg bolus into central
      infusion: 0,          // mg/min
      Vd: 50,               // L
      clearance: 0.5,       // L/min
      ke0: 0.1,             // 1/min effect-site rate (BioGears EffectSiteRateConstant)
      EC50: 0.2,            // mg/L
      Emax: 0.4,            // fractional HR / Ees depression
      hillN: 1.5,
      receptorGain: 1.0     // from membrane cross-link
    };
  }

  function createModel() {
    var params = defaultParams();
    var state = {
      t: 0,
      plasma: 0,     // mg/L
      effect: 0,     // mg/L effect-site
      response: 0,   // 0..Emax
      hrScale: 1,
      eesScale: 1
    };
    var series = {
      plasma: new K.Series(240),
      effect: new K.Series(240),
      response: new K.Series(240)
    };
    var sampleAcc = 0;
    var pendingBolus = 0;
    var dt = 0.05; // s  — convert rates /min carefully

    function evaluate() {
      var gain = params.receptorGain;
      state.response = K.emax(state.effect, params.Emax * gain, params.EC50, params.hillN);
      state.hrScale = 1 - state.response;
      state.eesScale = 1 - 0.7 * state.response;
      return state.response;
    }

    return {
      params: params,
      state: state,
      reset: function () {
        Object.assign(params, defaultParams());
        state.plasma = 0;
        state.effect = 0;
        state.t = 0;
        pendingBolus = 0;
        evaluate();
      },
      setParam: function (k, v) {
        if (k === 'dose') {
          // interpret slider change as administering a bolus of `v` mg (absolute)
          // better: dedicated button — here rising edge adds delta
          var prev = params.dose;
          params.dose = v;
          if (v > prev) pendingBolus += (v - prev);
          return;
        }
        params[k] = v;
      },
      administerBolus: function (mg) {
        pendingBolus += mg;
      },
      advance: function (sec) {
        var reg = root.BGX.registry;
        if (reg.isLinkEnabled('membrane', 'pkpd', 'occupancy') && this._occ != null) {
          params.receptorGain = K.clamp(0.4 + 1.2 * this._occ, 0.2, 2);
        }
        var n = Math.max(1, Math.round(sec / dt));
        for (var i = 0; i < n; i++) {
          if (pendingBolus > 0) {
            state.plasma += pendingBolus / Math.max(1, params.Vd);
            pendingBolus = 0;
          }
          // rates are per minute → convert to per second
          var elim = (params.clearance / Math.max(1, params.Vd)) / 60; // 1/s
          var inf = (params.infusion / Math.max(1, params.Vd)) / 60;   // (mg/L)/s
          state.plasma += dt * (inf - elim * state.plasma);
          if (state.plasma < 0) state.plasma = 0;
          var ke0 = params.ke0 / 60;
          state.effect += dt * ke0 * (state.plasma - state.effect);
          state.t += dt;
        }
        evaluate();
        sampleAcc += sec;
        if (sampleAcc >= 0.2) {
          sampleAcc = 0;
          series.plasma.push(state.plasma);
          series.effect.push(state.effect);
          series.response.push(state.response);
        }
        root.BGX.registry.publish('pkpd', 'hrEffect', {
          hrScale: state.hrScale,
          eesScale: state.eesScale
        });
      },
      settle: function (sec) { this.advance(sec || 30); },
      evaluate: evaluate,
      getSeries: function () { return series; },
      getFluxes: function () {
        return { response: state.response, hrScale: state.hrScale };
      },
      _occ: null
    };
  }

  function schematic(ctx, kit, model, t, layout) {
    var s = model.state, p = model.params;
    var w = layout.w, h = layout.h;
    kit.clear(w, h);

    kit.label('PHARMACOLOGY · PK / PD', w / 2, 22, { size: 12, color: COLORS.magenta });
    kit.label('Central → Effect-site → EC₅₀ Eₘₐₓ  (Drugs.cpp)', w / 2, 40, {
      size: 9, color: COLORS.dim, weight: '400'
    });

    var dose = kit.node(w * 0.15, h * 0.35, 100, 60, {
      color: COLORS.yellow, title: 'DOSE', subtitle: p.infusion.toFixed(1) + ' mg/min'
    });
    var central = kit.node(w * 0.4, h * 0.35, 120, 70, {
      color: COLORS.cyan, title: 'PLASMA', subtitle: s.plasma.toFixed(2) + ' mg/L'
    });
    var effect = kit.node(w * 0.68, h * 0.35, 120, 70, {
      color: COLORS.magenta, title: 'EFFECT SITE', subtitle: s.effect.toFixed(2) + ' mg/L'
    });
    var pd = kit.node(w * 0.5, h * 0.68, 160, 70, {
      color: COLORS.orange, title: 'PD RESPONSE', subtitle: 'E=' + s.response.toFixed(2)
    });
    var clr = kit.node(w * 0.4, h * 0.88, 110, 44, {
      color: COLORS.lime, title: 'CLEARANCE', subtitle: p.clearance.toFixed(2) + ' L/min'
    });

    kit.edge(dose, central, { color: COLORS.yellow, arrow: true });
    kit.flowParticles(dose, central, t, { color: COLORS.yellow, rate: 0.3 + p.infusion / 5 });
    kit.edge(central, effect, { color: COLORS.cyan, arrow: true });
    kit.flowParticles(central, effect, t, { color: COLORS.magenta, rate: 0.4 + p.ke0 });
    kit.edge(effect, pd, { color: COLORS.magenta, arrow: true });
    kit.edge(central, clr, { color: COLORS.lime, arrow: true });

    kit.label('E = Emax · Cⁿ / (EC50ⁿ + Cⁿ)', w * 0.82, h * 0.68, {
      size: 9, color: COLORS.faint, weight: '400'
    });
    kit.gauge(w * 0.88, h * 0.35, 34, s.response, 0, Math.max(0.1, p.Emax), {
      color: COLORS.magenta, label: 'E', valueText: s.response.toFixed(2)
    });
  }

  function metrics(model) {
    var s = model.state, p = model.params, fmt = K.fmt;
    return [
      { label: 'Plasma conc', value: fmt(s.plasma, 3), unit: 'mg/L' },
      { label: 'Effect-site', value: fmt(s.effect, 3), unit: 'mg/L' },
      { label: 'PD response', value: fmt(s.response, 3), unit: '' },
      { label: 'HR scale', value: fmt(s.hrScale, 2), unit: '×', tone: s.hrScale < 0.85 ? 'warn' : 'good' },
      { label: 'Ees scale', value: fmt(s.eesScale, 2), unit: '×' },
      { label: 'EC₅₀', value: fmt(p.EC50, 2), unit: 'mg/L' },
      { label: 'kₑ₀', value: fmt(p.ke0, 2), unit: '/min' }
    ];
  }

  root.BGX.registry.register({
    meta: {
      id: 'pkpd',
      title: 'PK / PD',
      tier: 'process',
      parents: ['pharmacology'],
      children: [],
      blurb: 'One-compartment pharmacokinetics with effect-site equilibration and sigmoid Emax pharmacodynamics. Cross-link into cardiovascular to depress HR and contractility.',
      color: COLORS.magenta
    },
    createModel: createModel,
    schematic: schematic,
    controls: [
      {
        title: 'Dosing', open: true, items: [
          { key: 'dose', label: 'Bolus cumulative', min: 0, max: 100, step: 1, unit: 'mg' },
          { key: 'infusion', label: 'Infusion rate', min: 0, max: 10, step: 0.1, unit: 'mg/min', dec: 1 }
        ]
      },
      {
        title: 'PK', open: true, items: [
          { key: 'Vd', label: 'Volume of distribution', min: 5, max: 200, step: 1, unit: 'L' },
          { key: 'clearance', label: 'Clearance', min: 0.05, max: 2, step: 0.05, unit: 'L/min', dec: 2 },
          { key: 'ke0', label: 'Effect-site kₑ₀', min: 0.01, max: 1, step: 0.01, unit: '/min', dec: 2 }
        ]
      },
      {
        title: 'PD', open: true, items: [
          { key: 'EC50', label: 'EC₅₀', min: 0.02, max: 2, step: 0.02, unit: 'mg/L', dec: 2 },
          { key: 'Emax', label: 'Eₘₐₓ', min: 0, max: 0.8, step: 0.02, unit: '', dec: 2 },
          { key: 'hillN', label: 'Hill n', min: 0.5, max: 4, step: 0.1, unit: '', dec: 1 }
        ]
      }
    ],
    metrics: metrics,
    links: {
      outputs: [{ id: 'hrEffect', label: 'HR / Ees effect' }],
      inputs: [{ id: 'occupancy', label: 'Receptor occupancy gain' }]
    },
    references: ['biogears_drugs']
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
