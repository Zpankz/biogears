/*
 * cardiovascular.js — Wraps the existing PV-Loop closed-loop elastance model
 * (pv-loop-visualizer/js/model.js) as a BioGears Explorer leaf node.
 */
(function (root) {
  'use strict';

  var COLORS = root.BGX.schematic.COLORS;

  function createModel() {
    if (!root.PVLoop || !root.PVLoop.CVModel) {
      throw new Error('cardiovascular node requires PVLoop.CVModel');
    }
    var model = new root.PVLoop.CVModel();
    model.settle(10);
    var series = {
      lvP: new root.BGX.kernel.Series(200),
      saP: new root.BGX.kernel.Series(200),
      lvV: new root.BGX.kernel.Series(200)
    };
    var sampleAcc = 0;

    return {
      params: model.params,
      state: model,
      reset: function () {
        model.reset();
        model.settle(10);
      },
      setParam: function (k, v) {
        model.params[k] = v;
        if (k === 'bloodVolume') model.setBloodVolume(v);
      },
      advance: function (sec) {
        // Apply optional PK/PD cross-link
        var reg = root.BGX.registry;
        if (reg.isLinkEnabled('pkpd', 'cardiovascular', 'hrEffect') && this._hrScale != null) {
          // scale already applied via setParam from bus — no-op here
        }
        model.advance(sec);
        sampleAcc += sec;
        if (sampleAcc >= 0.02) {
          sampleAcc = 0;
          series.lvP.push(model.P.lv);
          series.saP.push(model.P.sa);
          series.lvV.push(model.V.lv);
        }
      },
      settle: function (sec) {
        model.settle(Math.max(4, Math.round((sec || 8) * model.params.heartRate / 60)));
      },
      evaluate: function () { model._evaluate(); },
      getSeries: function () { return series; },
      getFluxes: function () {
        return {
          aortic: model.flow.av,
          systemic: model.flow.sys,
          cardiacOutput: model.flow.av // instantaneous; metrics use beat-averaged
        };
      },
      _hrScale: 1,
      _eesScale: 1
    };
  }

  function schematic(ctx, kit, model, t, layout) {
    var m = model.state;
    var w = layout.w, h = layout.h;
    kit.clear(w, h);

    kit.label('CARDIOVASCULAR · CLOSED-LOOP ELASTANCE', w / 2, 22, {
      size: 12, color: COLORS.cyan
    });
    kit.label('BioGears double-Hill activation · LV/RV Ees', w / 2, 40, {
      size: 9, color: COLORS.dim, weight: '400'
    });

    // Compartment boxes
    var lv = kit.node(w * 0.32, h * 0.42, 90, 54, {
      color: COLORS.red, title: 'LV', subtitle: m.V.lv.toFixed(0) + ' mL'
    });
    var sa = kit.node(w * 0.55, h * 0.22, 100, 48, {
      color: COLORS.orange, title: 'ARTERIES', subtitle: m.P.sa.toFixed(0) + ' mmHg'
    });
    var sv = kit.node(w * 0.78, h * 0.42, 100, 48, {
      color: COLORS.yellow, title: 'VEINS', subtitle: m.V.sv.toFixed(0) + ' mL'
    });
    var ra = kit.node(w * 0.68, h * 0.68, 80, 48, {
      color: COLORS.cyan, title: 'RA', subtitle: m.P.ra.toFixed(1) + ' mmHg'
    });
    var rv = kit.node(w * 0.45, h * 0.78, 80, 48, {
      color: COLORS.cyan, title: 'RV', subtitle: m.V.rv.toFixed(0) + ' mL'
    });
    var pa = kit.node(w * 0.22, h * 0.68, 90, 48, {
      color: COLORS.magenta, title: 'PA', subtitle: m.P.pa.toFixed(1) + ' mmHg'
    });
    var la = kit.node(w * 0.18, h * 0.42, 80, 48, {
      color: COLORS.yellow, title: 'LA', subtitle: m.P.la.toFixed(1) + ' mmHg'
    });

    kit.edge(lv, sa, { color: COLORS.red, arrow: true });
    kit.flowParticles(lv, sa, t, { color: COLORS.red, rate: Math.min(2, Math.abs(m.flow.av) / 80) });
    kit.edge(sa, sv, { color: COLORS.orange, arrow: true });
    kit.flowParticles(sa, sv, t, { color: COLORS.orange, rate: Math.min(2, Math.abs(m.flow.sys) / 40) });
    kit.edge(sv, ra, { color: COLORS.yellow, arrow: true });
    kit.edge(ra, rv, { color: COLORS.cyan, arrow: true });
    kit.edge(rv, pa, { color: COLORS.cyan, arrow: true });
    kit.flowParticles(rv, pa, t, { color: COLORS.magenta, rate: Math.min(2, Math.abs(m.flow.pv) / 80) });
    kit.edge(pa, la, { color: COLORS.magenta, arrow: true });
    kit.edge(la, lv, { color: COLORS.yellow, arrow: true });

    kit.gauge(w * 0.88, h * 0.78, 34, m.params.heartRate, 40, 180, {
      color: COLORS.cyan,
      label: 'HR',
      valueText: m.params.heartRate.toFixed(0)
    });
  }

  function metrics(model) {
    var m = model.state;
    var fmt = root.BGX.kernel.fmt;
    // Rough CO estimate from aortic flow magnitude scaled — settle metrics from volumes
    var svApprox = Math.max(0, m.V.lv); // display instantaneous LV volume as filling marker
    return [
      { label: 'LV volume', value: fmt(m.V.lv, 0), unit: 'mL' },
      { label: 'LV pressure', value: fmt(m.P.lv, 0), unit: 'mmHg' },
      { label: 'Aortic P', value: fmt(m.P.sa, 0), unit: 'mmHg' },
      { label: 'Heart rate', value: fmt(m.params.heartRate, 0), unit: 'bpm' },
      { label: 'LV Ees', value: fmt(m.params.lvEes, 2), unit: 'mmHg/mL' },
      { label: 'SVR', value: fmt(m.params.systemicResistance, 2), unit: 'mmHg·s/mL' },
      { label: 'Beat', value: String(m.beat), unit: '' },
      { label: 'LV fill', value: fmt(svApprox, 0), unit: 'mL', tone: m.V.lv < 70 ? 'warn' : 'good' }
    ];
  }

  root.BGX.registry.register({
    meta: {
      id: 'cardiovascular',
      title: 'Cardiovascular',
      tier: 'system',
      parents: ['organism'],
      children: [],
      blurb: 'Closed-loop four-chamber time-varying elastance model. Ventricular activation and Ees maxima follow BioGears Cardiovascular.cpp.',
      color: COLORS.red
    },
    createModel: createModel,
    schematic: schematic,
    controls: [
      {
        title: 'Pacing & Preload', open: true, items: [
          { key: 'heartRate', label: 'Heart rate', min: 40, max: 180, step: 1, unit: 'bpm' },
          { key: 'bloodVolume', label: 'Blood volume', min: 3500, max: 6500, step: 50, unit: 'mL' }
        ]
      },
      {
        title: 'Contractility', open: true, items: [
          { key: 'lvEes', label: 'LV Ees', min: 0.2, max: 5, step: 0.05, unit: 'mmHg/mL', dec: 2 },
          { key: 'rvEes', label: 'RV Ees', min: 0.1, max: 3, step: 0.05, unit: 'mmHg/mL', dec: 2 },
          { key: 'systemicResistance', label: 'SVR', min: 0.3, max: 2.5, step: 0.05, unit: 'mmHg·s/mL', dec: 2 }
        ]
      }
    ],
    metrics: metrics,
    links: {
      outputs: [{ id: 'cardiacOutput', label: 'Cardiac output' }],
      inputs: [{ id: 'hrEffect', label: 'Drug HR/Ees effect' }, { id: 'skinFlow', label: 'Skin blood flow' }]
    },
    references: ['biogears_cv', 'burkhoff_pv']
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
