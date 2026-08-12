/*
 * membrane.js — Membrane signalling pathways (schematic-first).
 * Ligand-gated, GPCR, intrinsic enzyme (RTK), enzyme-associated (JAK-STAT).
 * Educational mass-action occupancy kinetics.
 */
(function (root) {
  'use strict';

  var K = root.BGX.kernel;
  var COLORS = root.BGX.schematic.COLORS;

  function defaultParams() {
    return {
      ligand: 0.3,      // relative 0..1
      Kd: 0.25,         // dissociation constant
      pathway: 1,       // 0 LIGAND-GATED, 1 GPCR, 2 RTK, 3 JAK-STAT
      ampGain: 1.0
    };
  }

  function createModel() {
    var params = defaultParams();
    var state = {
      t: 0,
      occupancy: 0,
      secondMessenger: 0,
      cascade: 0,
      transcription: 0
    };
    var series = {
      occupancy: new K.Series(200),
      cascade: new K.Series(200)
    };
    var sampleAcc = 0;
    var dt = 0.02;

    function evaluate() {
      // Langmuir occupancy
      state.occupancy = params.ligand / (params.ligand + params.Kd);
      return state.occupancy;
    }

    return {
      params: params,
      state: state,
      reset: function () {
        Object.assign(params, defaultParams());
        state.secondMessenger = 0;
        state.cascade = 0;
        state.transcription = 0;
        state.t = 0;
        evaluate();
      },
      setParam: function (k, v) { params[k] = v; },
      advance: function (sec) {
        var n = Math.max(1, Math.round(sec / dt));
        for (var i = 0; i < n; i++) {
          evaluate();
          var targetSM = state.occupancy * params.ampGain;
          var path = Math.round(params.pathway);
          // pathway-specific time constants
          var tauSM = path === 0 ? 0.05 : path === 1 ? 0.4 : 0.8;
          var tauCas = path === 0 ? 0.08 : path === 3 ? 2.0 : 1.0;
          state.secondMessenger += dt * (targetSM - state.secondMessenger) / tauSM;
          state.cascade += dt * (state.secondMessenger - state.cascade) / tauCas;
          state.transcription += dt * ((path === 3 ? state.cascade : 0) - state.transcription) / 3;
          state.t += dt;
        }
        evaluate();
        sampleAcc += sec;
        if (sampleAcc >= 0.1) {
          sampleAcc = 0;
          series.occupancy.push(state.occupancy);
          series.cascade.push(state.cascade);
        }
        root.BGX.registry.publish('membrane', 'occupancy', state.occupancy);
      },
      settle: function (sec) { this.advance(sec || 10); },
      evaluate: evaluate,
      getSeries: function () { return series; },
      getFluxes: function () {
        return { occupancy: state.occupancy, cascade: state.cascade };
      }
    };
  }

  var PATH_META = [
    { name: 'LIGAND-GATED', color: COLORS.cyan, out: 'ION FLOW / DEPOLARISE' },
    { name: 'GPCR', color: COLORS.yellow, out: 'cAMP → PKA' },
    { name: 'INTRINSIC ENZYME', color: COLORS.lime, out: 'IRS → PI3K → Akt' },
    { name: 'ENZYME ASSOCIATED', color: COLORS.magenta, out: 'JAK2 → STAT → DNA' }
  ];

  function schematic(ctx, kit, model, t, layout) {
    var s = model.state, p = model.params;
    var w = layout.w, h = layout.h;
    kit.clear(w, h);

    kit.label('MEMBRANE SIGNALLING', w / 2, 20, { size: 12, color: COLORS.white });
    kit.band(h * 0.38, 28, 'rgba(80,90,120,0.35)');
    kit.label('PHOSPHOLIPID BILAYER', w / 2, h * 0.38 + 14, { size: 9, color: COLORS.dim });

    var path = PATH_META[K.clamp(Math.round(p.pathway), 0, 3)];
    kit.label(path.name, w / 2, 38, { size: 11, color: path.color });

    var lig = kit.circle(w * 0.2, h * 0.22, 16, { color: path.color, title: 'L', titleSize: 10 });
    var rec = kit.node(w * 0.5, h * 0.4, 120, 40, {
      color: path.color, title: 'RECEPTOR', subtitle: 'θ=' + s.occupancy.toFixed(2)
    });
    var intra = kit.node(w * 0.5, h * 0.62, 140, 50, {
      color: path.color, title: 'CASCADE', subtitle: s.cascade.toFixed(2)
    });
    var out = kit.node(w * 0.5, h * 0.84, 180, 44, {
      color: COLORS.white, title: path.out, subtitle: ''
    });

    kit.edge(lig, rec, { color: path.color, arrow: true });
    kit.flowParticles(lig, rec, t, { color: path.color, rate: p.ligand });
    kit.edge(rec, intra, { color: path.color, arrow: true });
    kit.flowParticles(rec, intra, t, { color: path.color, rate: s.occupancy });
    kit.edge(intra, out, { color: path.color, arrow: true });

    // four pathway selectors as small columns
    PATH_META.forEach(function (pm, i) {
      var x = w * (0.15 + i * 0.23);
      kit.label(pm.name.split(' ')[0], x, h * 0.08, {
        size: 8, color: Math.round(p.pathway) === i ? pm.color : COLORS.faint
      });
    });
  }

  function metrics(model) {
    var s = model.state, p = model.params, fmt = K.fmt;
    var path = PATH_META[K.clamp(Math.round(p.pathway), 0, 3)];
    return [
      { label: 'Pathway', value: path.name, unit: '' },
      { label: 'Ligand', value: fmt(p.ligand, 2), unit: '' },
      { label: 'Occupancy', value: fmt(s.occupancy, 2), unit: '' },
      { label: '2nd messenger', value: fmt(s.secondMessenger, 2), unit: '' },
      { label: 'Cascade', value: fmt(s.cascade, 2), unit: '' },
      { label: 'Transcription', value: fmt(s.transcription, 2), unit: '' }
    ];
  }

  root.BGX.registry.register({
    meta: {
      id: 'membrane',
      title: 'Membrane Signalling',
      tier: 'process',
      parents: ['cell'],
      children: [],
      blurb: 'Four canonical receptor classes with ligand occupancy and pathway-specific cascade timing. Schematic-first educational module; occupancy feeds PK/PD gain when cross-linked.',
      color: COLORS.cyan
    },
    createModel: createModel,
    schematic: schematic,
    controls: [
      {
        title: 'Ligand / Receptor', open: true, items: [
          { key: 'ligand', label: 'Ligand level', min: 0, max: 2, step: 0.01, unit: '', dec: 2 },
          { key: 'Kd', label: 'K_d', min: 0.05, max: 1.5, step: 0.01, unit: '', dec: 2 },
          { key: 'pathway', label: 'Pathway (0–3)', min: 0, max: 3, step: 1, unit: '' },
          { key: 'ampGain', label: 'Amplification', min: 0.2, max: 3, step: 0.1, unit: '×', dec: 1 }
        ]
      }
    ],
    metrics: metrics,
    links: {
      outputs: [{ id: 'occupancy', label: 'Receptor occupancy' }],
      inputs: []
    },
    references: ['receptor_pd']
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
