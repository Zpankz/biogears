/*
 * gasexchange.js — Lung / tissue O₂–CO₂ exchange (schematic-first).
 * Content equation CaO₂ and simplified alveolar gas / Fick exchange.
 * Grounded in BioGears Respiratory + Diffusion concepts; Bohr/Haldane noted.
 */
(function (root) {
  'use strict';

  var K = root.BGX.kernel;
  var COLORS = root.BGX.schematic.COLORS;

  function defaultParams() {
    return {
      FiO2: 0.21,
      VA: 4.2,          // L/min
      VCO2: 200,        // mL/min
      VO2: 250,         // mL/min
      Hb: 15,           // g/dL
      SaO2: 0.975,
      cardiacOutput: 5.0, // L/min
      shunt: 0.02
    };
  }

  function createModel() {
    var params = defaultParams();
    var state = {
      t: 0,
      PaO2: 100,
      PaCO2: 40,
      PvO2: 40,
      PvCO2: 46,
      CaO2: 20,   // mL/dL
      CvO2: 15,
      DO2: 1000,  // mL/min
      RQ: 0.8
    };
    var series = {
      PaO2: new K.Series(200),
      PaCO2: new K.Series(200),
      DO2: new K.Series(200)
    };
    var sampleAcc = 0;
    var dt = 0.05;

    function evaluate() {
      // Alveolar gas equation (simplified, dry)
      var PACO2 = 863 * (params.VCO2 / 1000) / Math.max(0.5, params.VA);
      var PAO2 = params.FiO2 * (760 - 47) - PACO2 / 0.8;
      var shunt = K.clamp(params.shunt, 0, 0.5);
      state.PaO2 = PAO2 * (1 - shunt) + 40 * shunt;
      state.PaCO2 = PACO2;
      // Content: CaO₂ = 1.34·Hb·SaO₂ + 0.003·PaO₂  (mL/dL)
      var sat = K.clamp(params.SaO2 - shunt * 0.15, 0.5, 1);
      state.CaO2 = 1.34 * params.Hb * sat + 0.003 * state.PaO2;
      state.CvO2 = state.CaO2 - (params.VO2 / 10) / Math.max(1, params.cardiacOutput); // mL/dL
      state.PvO2 = 40;
      state.PvCO2 = 46;
      state.DO2 = state.CaO2 * 10 * params.cardiacOutput; // mL/min
      state.RQ = params.VCO2 / Math.max(1, params.VO2);
      return state;
    }

    return {
      params: params,
      state: state,
      reset: function () {
        Object.assign(params, defaultParams());
        state.t = 0;
        evaluate();
      },
      setParam: function (k, v) { params[k] = v; },
      advance: function (sec) {
        var reg = root.BGX.registry;
        // Cross-links
        // (cardiac output & vent drive applied in app.js bus handler for clarity)
        var n = Math.max(1, Math.round(sec / dt));
        for (var i = 0; i < n; i++) {
          evaluate();
          state.t += dt;
        }
        evaluate();
        sampleAcc += sec;
        if (sampleAcc >= 0.2) {
          sampleAcc = 0;
          series.PaO2.push(state.PaO2);
          series.PaCO2.push(state.PaCO2);
          series.DO2.push(state.DO2);
        }
        root.BGX.registry.publish('gasexchange', 'PaCO2', state.PaCO2);
      },
      settle: function (sec) { this.advance(sec || 20); },
      evaluate: evaluate,
      getSeries: function () { return series; },
      getFluxes: function () {
        return { PaO2: state.PaO2, PaCO2: state.PaCO2, DO2: state.DO2 };
      }
    };
  }

  function schematic(ctx, kit, model, t, layout) {
    var s = model.state, p = model.params;
    var w = layout.w, h = layout.h;
    kit.clear(w, h);

    kit.label('GAS EXCHANGE · Hb COOPERATIVITY', w / 2, 20, { size: 12, color: COLORS.cyan });
    kit.label('CaO₂ = 1.34·Hb·SaO₂ + 0.003·PaO₂', w / 2, 38, {
      size: 9, color: COLORS.dim, weight: '400'
    });

    var lung = kit.node(w * 0.2, h * 0.3, 110, 64, {
      color: COLORS.cyan, title: 'LUNG', subtitle: 'PaO₂ ' + s.PaO2.toFixed(0)
    });
    var hb = kit.node(w * 0.5, h * 0.45, 150, 80, {
      color: COLORS.magenta, title: '4 HEME SITES', subtitle: 'COOPERATIVE'
    });
    var tissue = kit.node(w * 0.8, h * 0.3, 110, 64, {
      color: COLORS.orange, title: 'TISSUE', subtitle: 'PvO₂ ' + s.PvO2.toFixed(0)
    });
    var lungR = kit.node(w * 0.2, h * 0.75, 110, 56, {
      color: COLORS.magenta, title: 'LUNG RETURN', subtitle: 'PvCO₂ ' + s.PvCO2.toFixed(0)
    });
    var tissueR = kit.node(w * 0.8, h * 0.75, 110, 56, {
      color: COLORS.red, title: 'TISSUE CO₂', subtitle: 'content ↑'
    });

    kit.edge(lung, hb, { color: COLORS.cyan, arrow: true });
    kit.flowParticles(lung, hb, t, { color: COLORS.cyan, rate: p.FiO2 * 3 });
    kit.edge(hb, tissue, { color: COLORS.cyan, arrow: true });
    kit.flowParticles(hb, tissue, t, { color: COLORS.cyan, rate: s.DO2 / 800 });
    kit.edge(tissueR, hb, { color: COLORS.magenta, arrow: true });
    kit.flowParticles(tissueR, hb, t, { color: COLORS.magenta, rate: 1 });
    kit.edge(hb, lungR, { color: COLORS.magenta, arrow: true });

    kit.label('BOHR ← PCO₂ / H⁺', w * 0.5, h * 0.62, { size: 9, color: COLORS.yellow });
    kit.label('HALDANE → CO₂ carriage', w * 0.5, h * 0.9, { size: 9, color: COLORS.magenta });

    kit.gauge(w * 0.5, h * 0.18, 30, s.DO2, 400, 2000, {
      color: COLORS.lime, label: 'DO₂', valueText: s.DO2.toFixed(0)
    });
  }

  function metrics(model) {
    var s = model.state, p = model.params, fmt = K.fmt;
    return [
      { label: 'PaO₂', value: fmt(s.PaO2, 0), unit: 'mmHg' },
      { label: 'PaCO₂', value: fmt(s.PaCO2, 1), unit: 'mmHg' },
      { label: 'CaO₂', value: fmt(s.CaO2, 1), unit: 'mL/dL' },
      { label: 'DO₂', value: fmt(s.DO2, 0), unit: 'mL/min', tone: s.DO2 < 700 ? 'warn' : 'good' },
      { label: 'Hb', value: fmt(p.Hb, 1), unit: 'g/dL' },
      { label: 'Cardiac output', value: fmt(p.cardiacOutput, 1), unit: 'L/min' },
      { label: 'VA', value: fmt(p.VA, 1), unit: 'L/min' },
      { label: 'RQ', value: fmt(s.RQ, 2), unit: '' }
    ];
  }

  root.BGX.registry.register({
    meta: {
      id: 'gasexchange',
      title: 'Gas Exchange',
      tier: 'process',
      parents: ['respiratory'],
      children: [],
      blurb: 'Lung–Hb–tissue O₂/CO₂ loop with alveolar gas equation, content formula, and delivery (DO₂). Bohr and Haldane effects annotated; couples to acid–base and cardiac output.',
      color: COLORS.cyan
    },
    createModel: createModel,
    schematic: schematic,
    controls: [
      {
        title: 'Ventilation & Metabolism', open: true, items: [
          { key: 'FiO2', label: 'FiO₂', min: 0.15, max: 1, step: 0.01, unit: '', dec: 2 },
          { key: 'VA', label: 'Alveolar ventilation', min: 1, max: 20, step: 0.1, unit: 'L/min', dec: 1 },
          { key: 'VO2', label: 'O₂ consumption', min: 100, max: 2000, step: 10, unit: 'mL/min' },
          { key: 'VCO2', label: 'CO₂ production', min: 80, max: 1800, step: 10, unit: 'mL/min' }
        ]
      },
      {
        title: 'Blood & Flow', open: true, items: [
          { key: 'Hb', label: 'Hemoglobin', min: 6, max: 20, step: 0.1, unit: 'g/dL', dec: 1 },
          { key: 'SaO2', label: 'SaO₂', min: 0.7, max: 1, step: 0.005, unit: '', dec: 3 },
          { key: 'cardiacOutput', label: 'Cardiac output', min: 1, max: 20, step: 0.1, unit: 'L/min', dec: 1 },
          { key: 'shunt', label: 'Shunt fraction', min: 0, max: 0.4, step: 0.01, unit: '', dec: 2 }
        ]
      }
    ],
    metrics: metrics,
    links: {
      outputs: [{ id: 'PaCO2', label: 'PaCO₂' }],
      inputs: [
        { id: 'cardiacOutput', label: 'Cardiac output' },
        { id: 'ventDrive', label: 'Ventilatory drive' }
      ]
    },
    references: ['biogears_diff', 'west_resp', 'bohr_haldane']
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
