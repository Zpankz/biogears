/*
 * thermoregulation.js — "Human Thermostat" two-node (core–skin) model.
 * Grounded in BioGears Energy.cpp (core 37°C, skin ~34.4°C, sweat/shiver)
 * and Environment.cpp heat-exchange pathways; educational Gagge scaffold.
 */
(function (root) {
  'use strict';

  var K = root.BGX.kernel;
  var COLORS = root.BGX.schematic.COLORS;

  function defaultParams() {
    return {
      ambientT: 22,       // °C
      humidity: 0.5,      // 0..1
      metabolicMult: 1.0, // × basal
      clothingClo: 0.6,   // clo
      wind: 0.2,          // m/s
      setPoint: 37.0      // °C hypothalamic set-point
    };
  }

  function createModel() {
    var params = defaultParams();
    var state = {
      t: 0,
      Tcore: 37.0,
      Tskin: 34.4,
      heatProd: 80,   // W
      evaporative: 0, // W
      convective: 0,
      radiative: 0,
      shiver: 0,
      sweat: 0,
      skinFlow: 1.0,  // relative
      vasomotor: 0    // -1 cold .. +1 hot
    };
    var series = {
      Tcore: new K.Series(240),
      Tskin: new K.Series(240)
    };
    var sampleAcc = 0;
    var dt = 0.05; // s — thermal is slow

    function evaluate() {
      var Ta = params.ambientT;
      var clo = Math.max(0.05, params.clothingClo);
      var basal = 80 * params.metabolicMult; // W ~ resting adult
      var err = state.Tcore - params.setPoint;

      // Effectors (simplified BioGears Energy.cpp logic)
      state.shiver = err < -0.2 ? K.clamp((-err - 0.2) * 120, 0, 200) : 0;
      state.sweat = err > 0.1 ? K.clamp((err - 0.1) * 180, 0, 250) : 0;
      state.vasomotor = K.clamp(err * 2.5, -1, 1);
      state.skinFlow = K.clamp(1 + state.vasomotor * 0.8, 0.2, 2.2);

      state.heatProd = basal + state.shiver;

      // Heat losses (Environment-inspired)
      var hConv = (3.5 + 6.5 * Math.sqrt(params.wind)) / clo; // W/°C
      state.convective = hConv * (state.Tskin - Ta);
      state.radiative = (4.5 / clo) * (state.Tskin - Ta);
      var evapMax = 180 * (1 - params.humidity) * (0.5 + params.wind);
      state.evaporative = Math.min(state.sweat, evapMax);

      return {
        heatProd: state.heatProd,
        loss: state.convective + state.radiative + state.evaporative,
        skinFlow: state.skinFlow
      };
    }

    return {
      params: params,
      state: state,
      reset: function () {
        params = Object.assign(params, defaultParams());
        state.Tcore = 37.0;
        state.Tskin = 34.4;
        state.t = 0;
        evaluate();
      },
      setParam: function (k, v) { params[k] = v; },
      advance: function (sec) {
        var n = Math.max(1, Math.round(sec / dt));
        for (var i = 0; i < n; i++) {
          var e = evaluate();
          // Two-node heat capacities (approx): core 0.9·mc, skin 0.1·mc; mc≈3.5e5 J/°C
          var Ccore = 2.6e5;
          var Cskin = 0.9e5;
          var kCoreSkin = 5.3 * state.skinFlow; // conductance W/°C
          var Qcs = kCoreSkin * (state.Tcore - state.Tskin);
          state.Tcore += dt * (e.heatProd - Qcs) / Ccore;
          state.Tskin += dt * (Qcs - e.loss) / Cskin;
          state.t += dt;
        }
        evaluate();
        sampleAcc += sec;
        if (sampleAcc >= 0.25) {
          sampleAcc = 0;
          series.Tcore.push(state.Tcore);
          series.Tskin.push(state.Tskin);
        }
        root.BGX.registry.publish('thermoregulation', 'skinFlow', state.skinFlow);
      },
      settle: function (sec) {
        this.advance(sec || 120);
      },
      evaluate: evaluate,
      getSeries: function () { return series; },
      getFluxes: function () {
        return {
          heatProd: state.heatProd,
          evaporative: state.evaporative,
          skinFlow: state.skinFlow
        };
      }
    };
  }

  function schematic(ctx, kit, model, t, layout) {
    var s = model.state, p = model.params;
    var w = layout.w, h = layout.h;
    kit.clear(w, h);

    kit.label('HUMAN THERMOSTAT', w / 2, 22, { size: 13, color: COLORS.yellow });
    kit.label('CORE ' + s.Tcore.toFixed(2) + '°C   ·   SET ' + p.setPoint.toFixed(1) + '°C', w / 2, 40, {
      size: 10, color: COLORS.dim, weight: '400'
    });

    var cold = kit.node(w * 0.18, h * 0.35, 110, 70, {
      color: COLORS.cyan, title: 'COLD', subtitle: 'shiver / vaso↓'
    });
    var hypo = kit.circle(w * 0.5, h * 0.38, 48, {
      color: COLORS.yellow, title: 'HYPO-\nTHAL.', titleSize: 10, glow: 18
    });
    // redraw label cleanly
    kit.label('HYPOTHALAMUS', w * 0.5, h * 0.38, { size: 10, color: COLORS.yellow });

    var hot = kit.node(w * 0.82, h * 0.35, 110, 70, {
      color: COLORS.magenta, title: 'WARM', subtitle: 'sweat / vaso↑'
    });
    var core = kit.node(w * 0.5, h * 0.68, 130, 56, {
      color: COLORS.orange, title: 'CORE', subtitle: s.Tcore.toFixed(2) + ' °C'
    });
    var skin = kit.node(w * 0.5, h * 0.88, 130, 48, {
      color: COLORS.cyan, title: 'SKIN', subtitle: s.Tskin.toFixed(2) + ' °C'
    });
    var amb = kit.node(w * 0.85, h * 0.78, 100, 56, {
      color: COLORS.white, title: 'AMBIENT', subtitle: p.ambientT.toFixed(0) + ' °C'
    });

    var err = s.Tcore - p.setPoint;
    kit.edge(cold, { x: hypo.x, y: hypo.y }, { color: COLORS.cyan, arrow: true });
    kit.edge(hot, { x: hypo.x, y: hypo.y }, { color: COLORS.magenta, arrow: true });
    kit.edge({ x: hypo.x, y: hypo.y }, core, { color: COLORS.yellow, arrow: true });
    kit.edge(core, skin, { color: COLORS.orange, arrow: true });
    kit.flowParticles(core, skin, t, {
      color: COLORS.orange,
      rate: s.skinFlow
    });
    kit.edge(skin, amb, { color: COLORS.cyan, arrow: true });
    kit.flowParticles(skin, amb, t, {
      color: COLORS.cyan,
      rate: Math.min(2, (s.convective + s.radiative + s.evaporative) / 100)
    });

    kit.label(err < -0.1 ? 'SHIVERING ' + s.shiver.toFixed(0) + ' W' : 'NO SHIVER', w * 0.18, h * 0.52, {
      size: 9, color: COLORS.cyan
    });
    kit.label(err > 0.1 ? 'SWEAT ' + s.sweat.toFixed(0) + ' W' : 'NO SWEAT', w * 0.82, h * 0.52, {
      size: 9, color: COLORS.magenta
    });

    kit.gauge(w * 0.15, h * 0.78, 32, p.ambientT, 0, 45, {
      color: COLORS.cyan, label: 'Ta', valueText: p.ambientT.toFixed(0)
    });
  }

  function metrics(model) {
    var s = model.state, p = model.params, fmt = K.fmt;
    var tone = Math.abs(s.Tcore - p.setPoint) > 0.5 ? 'warn' : 'good';
    return [
      { label: 'Core temp', value: fmt(s.Tcore, 2), unit: '°C', tone: tone },
      { label: 'Skin temp', value: fmt(s.Tskin, 2), unit: '°C' },
      { label: 'Heat production', value: fmt(s.heatProd, 0), unit: 'W' },
      { label: 'Evaporative loss', value: fmt(s.evaporative, 0), unit: 'W' },
      { label: 'Convective loss', value: fmt(s.convective, 0), unit: 'W' },
      { label: 'Skin blood flow', value: fmt(s.skinFlow, 2), unit: '×' },
      { label: 'Shiver power', value: fmt(s.shiver, 0), unit: 'W' },
      { label: 'Sweat demand', value: fmt(s.sweat, 0), unit: 'W' }
    ];
  }

  root.BGX.registry.register({
    meta: {
      id: 'thermoregulation',
      title: 'Human Thermostat',
      tier: 'process',
      parents: ['energy'],
      children: [],
      blurb: 'Two-node core–skin thermostat with hypothalamic set-point, shivering, sweating and vasomotor effectors. Constants follow BioGears Energy/Environment.',
      color: COLORS.yellow
    },
    createModel: createModel,
    schematic: schematic,
    controls: [
      {
        title: 'Environment', open: true, items: [
          { key: 'ambientT', label: 'Ambient temperature', min: 0, max: 45, step: 0.5, unit: '°C', dec: 1 },
          { key: 'humidity', label: 'Humidity', min: 0, max: 1, step: 0.01, unit: '', dec: 2 },
          { key: 'wind', label: 'Air movement', min: 0, max: 3, step: 0.05, unit: 'm/s', dec: 2 },
          { key: 'clothingClo', label: 'Clothing', min: 0.05, max: 2, step: 0.05, unit: 'clo', dec: 2 }
        ]
      },
      {
        title: 'Physiology', open: true, items: [
          { key: 'metabolicMult', label: 'Metabolic rate', min: 0.6, max: 6, step: 0.1, unit: '×', dec: 1 },
          { key: 'setPoint', label: 'Set-point', min: 35, max: 39, step: 0.1, unit: '°C', dec: 1 }
        ]
      }
    ],
    metrics: metrics,
    links: {
      outputs: [{ id: 'skinFlow', label: 'Skin blood flow' }],
      inputs: []
    },
    references: ['biogears_energy', 'biogears_env', 'gagge']
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
