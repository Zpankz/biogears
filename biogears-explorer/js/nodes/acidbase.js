/*
 * acidbase.js — CO₂ / acid–base control loop.
 * Production → carriage → elimination → chemoreceptor ventilatory drive.
 * Grounded in BioGears BloodChemistry.cpp + Respiratory.cpp RespiratoryDriver.
 */
(function (root) {
  'use strict';

  var K = root.BGX.kernel;
  var COLORS = root.BGX.schematic.COLORS;

  function defaultParams() {
    return {
      VCO2: 200,          // mL/min CO2 production
      VA: 4.2,            // L/min alveolar ventilation
      HCO3: 24,           // mEq/L plasma bicarbonate
      metabolicRate: 1.0, // ×
      chemoGain: 1.0
    };
  }

  function createModel() {
    var params = defaultParams();
    var state = {
      t: 0,
      PaCO2: 40,     // mmHg
      pH: 7.40,
      ventDrive: 1.0,
      bicarbFrac: 0.65,
      carbamateFrac: 0.25,
      dissolvedFrac: 0.10
    };
    var series = {
      PaCO2: new K.Series(240),
      pH: new K.Series(240),
      VA: new K.Series(240)
    };
    var sampleAcc = 0;
    var dt = 0.05;

    function hh(hco3, paco2) {
      // pH = 6.1 + log10(HCO3 / (0.03 * PaCO2))
      var denom = 0.03 * Math.max(1, paco2);
      return 6.1 + Math.log(hco3 / denom) / Math.LN10;
    }

    function evaluate() {
      var vco2 = params.VCO2 * params.metabolicRate; // mL/min
      // Steady relation: PaCO2 ≈ 863 * VCO2(L/min) / VA(L/min)
      var target = 863 * (vco2 / 1000) / Math.max(0.5, params.VA);
      state.pH = hh(params.HCO3, state.PaCO2);
      // Chemoreceptor drive (Respiratory.cpp inspired): rises when PaCO2 > 40
      var err = state.PaCO2 - 40;
      state.ventDrive = K.clamp(1 + params.chemoGain * 0.06 * err, 0.4, 3.0);
      return { target: target, vco2: vco2 };
    }

    return {
      params: params,
      state: state,
      reset: function () {
        Object.assign(params, defaultParams());
        state.PaCO2 = 40;
        state.pH = 7.40;
        state.t = 0;
        evaluate();
      },
      setParam: function (k, v) { params[k] = v; },
      advance: function (sec) {
        // Optional cross-link: gas exchange sets PaCO2
        var reg = root.BGX.registry;
        var n = Math.max(1, Math.round(sec / dt));
        for (var i = 0; i < n; i++) {
          var e = evaluate();
          // first-order approach to alveolar target
          var tau = 8; // s
          state.PaCO2 += dt * (e.target - state.PaCO2) / tau;
          // closed-loop: vent drive modulates VA unless user locked
          if (reg.isLinkEnabled('acidbase', 'gasexchange', 'ventDrive')) {
            // published below; gasexchange consumes
          }
          // mild metabolic compensation placeholder (slow)
          state.t += dt;
        }
        evaluate();
        sampleAcc += sec;
        if (sampleAcc >= 0.2) {
          sampleAcc = 0;
          series.PaCO2.push(state.PaCO2);
          series.pH.push(state.pH);
          series.VA.push(params.VA * state.ventDrive);
        }
        root.BGX.registry.publish('acidbase', 'ventDrive', state.ventDrive);
        root.BGX.registry.publish('acidbase', 'PaCO2', state.PaCO2);
      },
      settle: function (sec) { this.advance(sec || 60); },
      evaluate: evaluate,
      getSeries: function () { return series; },
      getFluxes: function () {
        return { ventDrive: state.ventDrive, PaCO2: state.PaCO2 };
      }
    };
  }

  function schematic(ctx, kit, model, t, layout) {
    var s = model.state, p = model.params;
    var w = layout.w, h = layout.h;
    kit.clear(w, h);

    kit.label('CO₂  ·  ACID–BASE CONTROL LOOP', w / 2, 22, { size: 12, color: COLORS.lime });
    kit.label('Production → Carriage → Elimination → Chemoreflex', w / 2, 40, {
      size: 9, color: COLORS.dim, weight: '400'
    });

    var prod = kit.node(w * 0.15, h * 0.4, 120, 70, {
      color: COLORS.cyan, title: '1 PRODUCTION', subtitle: (p.VCO2 * p.metabolicRate).toFixed(0) + ' mL/min'
    });
    var carr = kit.node(w * 0.4, h * 0.4, 120, 70, {
      color: COLORS.orange, title: '2 CARRIAGE', subtitle: 'HCO₃⁻ ' + (s.bicarbFrac * 100).toFixed(0) + '%'
    });
    var elim = kit.node(w * 0.65, h * 0.4, 120, 70, {
      color: COLORS.lime, title: '3 ELIMINATION', subtitle: 'VA ' + p.VA.toFixed(1) + ' L/min'
    });
    var ctrl = kit.node(w * 0.5, h * 0.72, 140, 70, {
      color: COLORS.magenta, title: '4 CONTROL', subtitle: 'drive ×' + s.ventDrive.toFixed(2)
    });

    kit.edge(prod, carr, { color: COLORS.cyan, arrow: true });
    kit.flowParticles(prod, carr, t, { color: COLORS.cyan, rate: p.metabolicRate });
    kit.edge(carr, elim, { color: COLORS.orange, arrow: true });
    kit.flowParticles(carr, elim, t, { color: COLORS.orange, rate: 1 });
    kit.edge(elim, ctrl, { color: COLORS.lime, arrow: true });
    kit.edge(ctrl, elim, { color: COLORS.magenta, arrow: true, curve: -40 });
    kit.flowParticles(ctrl, elim, t, { color: COLORS.magenta, rate: s.ventDrive });

    kit.gauge(w * 0.88, h * 0.35, 36, s.PaCO2, 20, 80, {
      color: COLORS.orange, label: 'PaCO₂', valueText: s.PaCO2.toFixed(0)
    });
    kit.gauge(w * 0.88, h * 0.7, 36, s.pH, 7.0, 7.8, {
      color: s.pH < 7.36 || s.pH > 7.45 ? COLORS.red : COLORS.lime,
      label: 'pH', valueText: s.pH.toFixed(2)
    });

    kit.label('pH = 6.1 + log([HCO₃⁻]/(0.03·PaCO₂))', w / 2, h * 0.92, {
      size: 9, color: COLORS.faint, weight: '400'
    });
  }

  function metrics(model) {
    var s = model.state, p = model.params, fmt = K.fmt;
    var tone = s.pH < 7.36 ? 'bad' : s.pH > 7.45 ? 'warn' : 'good';
    return [
      { label: 'PaCO₂', value: fmt(s.PaCO2, 1), unit: 'mmHg' },
      { label: 'pH', value: fmt(s.pH, 2), unit: '', tone: tone },
      { label: 'HCO₃⁻', value: fmt(p.HCO3, 1), unit: 'mEq/L' },
      { label: 'VCO₂', value: fmt(p.VCO2 * p.metabolicRate, 0), unit: 'mL/min' },
      { label: 'VA', value: fmt(p.VA, 2), unit: 'L/min' },
      { label: 'Vent drive', value: fmt(s.ventDrive, 2), unit: '×' }
    ];
  }

  root.BGX.registry.register({
    meta: {
      id: 'acidbase',
      title: 'CO₂ / Acid–Base',
      tier: 'process',
      parents: ['chemistry'],
      children: [],
      blurb: 'Four-phase CO₂ lifecycle with Henderson–Hasselbalch pH and chemoreceptor ventilatory drive. Event thresholds follow BioGears BloodChemistry (acidosis <7.36, alkalosis >7.45).',
      color: COLORS.lime
    },
    createModel: createModel,
    schematic: schematic,
    controls: [
      {
        title: 'Production & Elimination', open: true, items: [
          { key: 'VCO2', label: 'CO₂ production', min: 80, max: 800, step: 10, unit: 'mL/min' },
          { key: 'VA', label: 'Alveolar ventilation', min: 1, max: 20, step: 0.1, unit: 'L/min', dec: 1 },
          { key: 'metabolicRate', label: 'Metabolic rate', min: 0.5, max: 5, step: 0.1, unit: '×', dec: 1 }
        ]
      },
      {
        title: 'Acid–Base', open: true, items: [
          { key: 'HCO3', label: 'Plasma HCO₃⁻', min: 10, max: 40, step: 0.5, unit: 'mEq/L', dec: 1 },
          { key: 'chemoGain', label: 'Chemoreflex gain', min: 0, max: 3, step: 0.1, unit: '×', dec: 1 }
        ]
      }
    ],
    metrics: metrics,
    links: {
      outputs: [{ id: 'ventDrive', label: 'Ventilatory drive' }, { id: 'PaCO2', label: 'PaCO₂' }],
      inputs: [{ id: 'PaCO2', label: 'PaCO₂ from gas exchange' }]
    },
    references: ['biogears_bc', 'biogears_resp', 'hh_equation']
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
