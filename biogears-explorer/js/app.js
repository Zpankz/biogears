/*
 * app.js — Boot, parent hierarchy registration, animation loop, cross-link bus,
 * and hash routing for BioGears Explorer.
 */
(function (root) {
  'use strict';

  var reg = root.BGX.registry;
  var COLORS = root.BGX.schematic.COLORS;
  var nav = root.BGX.navigator;
  var ctl = root.BGX.controls;

  // ---- Parent / overview nodes (no ODE; schematic lists children) ------------
  function registerParent(id, title, color, parents, blurb) {
    reg.register({
      meta: {
        id: id,
        title: title,
        tier: parents.length ? 'system' : 'organism',
        parents: parents,
        children: [],
        blurb: blurb,
        color: color
      },
      createModel: function () {
        return {
          params: {},
          state: { t: 0 },
          reset: function () {},
          setParam: function () {},
          advance: function (sec) { this.state.t += sec; },
          settle: function () {},
          evaluate: function () {},
          getSeries: function () { return {}; },
          getFluxes: function () { return {}; }
        };
      },
      schematic: function (ctx, kit, model, t, layout) {
        var kids = reg.childrenOf(id);
        var w = layout.w, h = layout.h;
        kit.clear(w, h);
        kit.label(title.toUpperCase(), w / 2, 28, { size: 14, color: color });
        kit.label('Click a child node to descend  ·  Esc to ascend', w / 2, 48, {
          size: 10, color: COLORS.dim, weight: '400'
        });
        if (!kids.length) {
          kit.label('No child modules registered', w / 2, h / 2, { size: 12, color: COLORS.faint });
          return;
        }
        var cols = Math.min(3, kids.length);
        var rows = Math.ceil(kids.length / cols);
        kids.forEach(function (k, i) {
          var col = i % cols;
          var row = Math.floor(i / cols);
          var x = w * (0.2 + col * 0.3);
          var y = h * (0.35 + row * (0.45 / Math.max(1, rows)));
          kit.node(x, y, 140, 64, {
            color: k.meta.color || color,
            title: k.meta.title,
            subtitle: k.meta.tier
          });
          kit.edge({ x: w / 2, y: 70 }, { x: x, y: y - 32 }, {
            color: k.meta.color || color, width: 1, glow: 4
          });
        });
        // store hit targets on model for click-to-descend
        model._hits = kids.map(function (k, i) {
          var col = i % cols;
          var row = Math.floor(i / cols);
          return {
            id: k.meta.id,
            x: w * (0.2 + col * 0.3),
            y: h * (0.35 + row * (0.45 / Math.max(1, rows))),
            w: 140, h: 64
          };
        });
      },
      controls: [],
      metrics: function () {
        return reg.childrenOf(id).map(function (k) {
          return { label: 'Child', value: k.meta.title, unit: '' };
        });
      },
      links: { outputs: [], inputs: [] },
      references: []
    });
  }

  registerParent('organism', 'Organism', COLORS.white, [],
    'Whole-body root. Descend into a physiological system to explore nested, evidence-based models.');
  registerParent('energy', 'Energy / Thermal', COLORS.yellow, ['organism'],
    'Metabolic heat production, thermoregulation and environmental exchange.');
  registerParent('respiratory', 'Respiratory', COLORS.cyan, ['organism'],
    'Ventilation, gas exchange and O₂/CO₂ transport.');
  registerParent('chemistry', 'Blood Chemistry', COLORS.lime, ['organism'],
    'Acid–base balance, CO₂ carriage and chemoreflex coupling.');
  registerParent('cell', 'Cell Signalling', COLORS.cyan, ['organism'],
    'Membrane receptor classes and intracellular cascades.');
  registerParent('pharmacology', 'Pharmacology', COLORS.magenta, ['organism'],
    'Pharmacokinetics and pharmacodynamics with cross-links into physiology.');

  // Cardiovascular is both a system leaf (has a model) — already registered.
  // Ensure it appears under organism (its meta.parents already says so).

  // ---- App state ------------------------------------------------------------
  var activeId = 'thermoregulation';
  var activeNode = null;
  var activeModel = null;
  var baseline = null;
  var playing = true;
  var controlApi = null;
  var lastTs = 0;
  var simTime = 0;

  var els = {
    tree: document.getElementById('tree'),
    crumbs: document.getElementById('breadcrumbs'),
    blurb: document.getElementById('nodeBlurb'),
    stageTitle: document.getElementById('stageTitle'),
    stageHint: document.getElementById('stageHint'),
    stageCanvas: document.getElementById('stageCanvas'),
    sparkCanvas: document.getElementById('sparkCanvas'),
    miniCanvas: document.getElementById('miniCanvas'),
    controlGroups: document.getElementById('controlGroups'),
    metrics: document.getElementById('metrics'),
    crossLinks: document.getElementById('crossLinks'),
    evidence: document.getElementById('evidenceStrip'),
    playBtn: document.getElementById('playBtn'),
    stabilizeBtn: document.getElementById('stabilizeBtn'),
    resetBtn: document.getElementById('resetBtn'),
    upBtn: document.getElementById('upBtn')
  };

  var stageKit = root.BGX.schematic.createKit(els.stageCanvas.getContext('2d'));
  var sparkKit = root.BGX.schematic.createKit(els.sparkCanvas.getContext('2d'));

  function selectNode(id) {
    var node = reg.get(id);
    if (!node) return;
    activeId = id;
    activeNode = node;
    activeModel = node.createModel();
    baseline = root.BGX.kernel.copy(activeModel.params);
    activeModel.settle && activeModel.settle(8);
    location.hash = id;

    els.blurb.textContent = node.meta.blurb || '';
    els.stageTitle.textContent = node.meta.title;
    els.stageHint.textContent = node.meta.tier + (node.controls && node.controls.length ? ' · live model' : ' · overview');
    els.evidence.textContent = ctl.evidenceText(node);

    nav.buildTree(els.tree, activeId, selectNode);
    nav.buildBreadcrumbs(els.crumbs, activeId, selectNode);
    nav.drawMiniMap(els.miniCanvas, activeId, selectNode);
    ctl.buildCrossLinks(els.crossLinks);

    if (node.controls && node.controls.length) {
      controlApi = ctl.buildControls(
        els.controlGroups,
        node.controls,
        activeModel.params,
        baseline,
        onParamChange
      );
    } else {
      els.controlGroups.innerHTML = '<p class="hint" style="padding:6px">Overview node — select a child process to interact with parameters.</p>';
      controlApi = null;
    }
    refreshMetrics();
  }

  function onParamChange(key, value) {
    if (!activeModel) return;
    activeModel.setParam(key, value);
  }

  function refreshMetrics() {
    if (!activeNode || !activeModel) return;
    ctl.buildMetrics(els.metrics, activeNode.metrics(activeModel));
  }

  function ascend() {
    var parents = reg.parentsOf(activeId);
    if (parents.length) selectNode(parents[0].meta.id);
    else selectNode('organism');
  }

  // ---- Cross-link bus -------------------------------------------------------
  var signalCache = Object.create(null);

  reg.subscribe(function (evt) {
    if (evt.type === 'signal') {
      signalCache[evt.from + ':' + evt.signal] = evt.value;
      applyCrossLinks();
    }
  });

  function applyCrossLinks() {
    if (!activeModel) return;

    // PK/PD → Cardiovascular
    if (reg.isLinkEnabled('pkpd', 'cardiovascular', 'hrEffect')) {
      var hr = signalCache['pkpd:hrEffect'];
      if (hr && activeId === 'cardiovascular' && activeModel.params) {
        // scale from baseline
        if (baseline && baseline.heartRate) {
          activeModel.setParam('heartRate', Math.round(baseline.heartRate * hr.hrScale));
          activeModel.setParam('lvEes', baseline.lvEes * hr.eesScale);
          if (controlApi) controlApi.refresh(activeModel.params, baseline);
        }
      }
    }

    // Thermo → CV (skin flow as mild SVR drop when vasodilated)
    if (reg.isLinkEnabled('thermoregulation', 'cardiovascular', 'skinFlow')) {
      var sf = signalCache['thermoregulation:skinFlow'];
      if (sf != null && activeId === 'cardiovascular' && baseline) {
        var svr = baseline.systemicResistance / Math.max(0.5, 0.7 + 0.3 * sf);
        activeModel.setParam('systemicResistance', svr);
      }
    }

    // Gas exchange ← CO (when visiting gasexchange, pull a nominal CO)
    if (reg.isLinkEnabled('cardiovascular', 'gasexchange', 'cardiacOutput')) {
      if (activeId === 'gasexchange' && activeModel.params) {
        // without a live CV instance, leave slider-driven; optional future: shared world state
      }
    }

    // Acid-base vent drive → gas exchange VA
    if (reg.isLinkEnabled('acidbase', 'gasexchange', 'ventDrive')) {
      var vd = signalCache['acidbase:ventDrive'];
      if (vd != null && activeId === 'gasexchange' && baseline && baseline.VA) {
        activeModel.setParam('VA', baseline.VA * vd);
        if (controlApi) controlApi.refresh(activeModel.params, baseline);
      }
    }

    // Gas exchange PaCO2 → acidbase
    if (reg.isLinkEnabled('gasexchange', 'acidbase', 'PaCO2')) {
      var paco2 = signalCache['gasexchange:PaCO2'];
      if (paco2 != null && activeId === 'acidbase' && activeModel.state) {
        // gently blend
        activeModel.state.PaCO2 = activeModel.state.PaCO2 * 0.9 + paco2 * 0.1;
      }
    }

    // Membrane occupancy → PK/PD gain
    if (reg.isLinkEnabled('membrane', 'pkpd', 'occupancy')) {
      var occ = signalCache['membrane:occupancy'];
      if (occ != null && activeId === 'pkpd') {
        activeModel._occ = occ;
      }
    }
  }

  // ---- Stage click (overview descend) ---------------------------------------
  els.stageCanvas.addEventListener('click', function (ev) {
    if (!activeModel || !activeModel._hits) return;
    var r = els.stageCanvas.getBoundingClientRect();
    var x = ev.clientX - r.left;
    var y = ev.clientY - r.top;
    activeModel._hits.forEach(function (hit) {
      if (Math.abs(x - hit.x) <= hit.w / 2 && Math.abs(y - hit.y) <= hit.h / 2) {
        selectNode(hit.id);
      }
    });
  });

  // ---- Transport ------------------------------------------------------------
  els.playBtn.addEventListener('click', function () {
    playing = !playing;
    els.playBtn.textContent = playing ? 'Pause' : 'Play';
  });
  els.stabilizeBtn.addEventListener('click', function () {
    if (activeModel && activeModel.settle) activeModel.settle(60);
    refreshMetrics();
  });
  els.resetBtn.addEventListener('click', function () {
    if (!activeNode) return;
    selectNode(activeId);
  });
  els.upBtn.addEventListener('click', ascend);

  window.addEventListener('keydown', function (ev) {
    if (ev.code === 'Space' && ev.target === document.body) {
      ev.preventDefault();
      els.playBtn.click();
    } else if (ev.code === 'Escape') {
      ascend();
    }
  });

  // ---- Draw helpers ---------------------------------------------------------
  function resizeAndDraw(ts) {
    var stageRect = els.stageCanvas.parentElement.getBoundingClientRect();
    var sparkRect = els.sparkCanvas.parentElement.getBoundingClientRect();
    var stageLayout = stageKit.fitCanvas(els.stageCanvas, stageRect.width, stageRect.height);
    var sparkLayout = sparkKit.fitCanvas(els.sparkCanvas, sparkRect.width, sparkRect.height);

    if (playing && activeModel && lastTs) {
      var dt = Math.min(0.05, (ts - lastTs) / 1000);
      // thermal / acidbase are slow — run faster than wall clock for feel
      var rate = activeId === 'thermoregulation' ? 8
        : activeId === 'acidbase' || activeId === 'gasexchange' ? 4
        : activeId === 'pkpd' ? 3
        : 1;
      activeModel.advance(dt * rate);
      simTime += dt * rate;
      applyCrossLinks();
    }
    lastTs = ts;

    if (activeNode && activeModel) {
      activeNode.schematic(stageKit.ctx, stageKit, activeModel, simTime, stageLayout);
      drawSparks(sparkLayout);
      refreshMetrics();
    }
    // refresh minimap occasionally
    if (Math.floor(simTime * 2) % 5 === 0) {
      nav.drawMiniMap(els.miniCanvas, activeId, selectNode);
    }

    requestAnimationFrame(resizeAndDraw);
  }

  function drawSparks(layout) {
    sparkKit.clear(layout.w, layout.h);
    if (!activeModel || !activeModel.getSeries) return;
    var series = activeModel.getSeries();
    var keys = Object.keys(series);
    if (!keys.length) {
      sparkKit.label('No live traces on overview nodes', layout.w / 2, layout.h / 2, {
        size: 10, color: COLORS.faint
      });
      return;
    }
    var colors = [COLORS.cyan, COLORS.magenta, COLORS.yellow, COLORS.lime];
    var bandH = (layout.h - 8) / keys.length;
    keys.forEach(function (k, i) {
      var arr = series[k].toArray ? series[k].toArray() : [];
      sparkKit.sparkline(arr, 8, 4 + i * bandH, layout.w - 16, bandH - 4, {
        color: colors[i % colors.length],
        label: k
      });
    });
  }

  // ---- Boot -----------------------------------------------------------------
  function boot() {
    var fromHash = (location.hash || '').replace(/^#/, '');
    if (fromHash && reg.get(fromHash)) activeId = fromHash;
    else if (!reg.get(activeId)) activeId = 'organism';

    // Enable a couple of didactic cross-links by default
    reg.setLinkEnabled('pkpd', 'cardiovascular', 'hrEffect', true);
    reg.setLinkEnabled('acidbase', 'gasexchange', 'ventDrive', true);

    selectNode(activeId);
    requestAnimationFrame(resizeAndDraw);
  }

  window.addEventListener('hashchange', function () {
    var id = (location.hash || '').replace(/^#/, '');
    if (id && reg.get(id) && id !== activeId) selectNode(id);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
