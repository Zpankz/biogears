/*
 * plots.js — Canvas rendering for the PV-Loop Explorer.
 * Three renderers: pressure–volume loops, scrolling Wiggers waveforms, and a
 * live cardiac schematic. All renderers are pure functions of the supplied state
 * and the current model, so the animation loop in app.js can simply re-call them.
 */
(function (root) {
  'use strict';

  var COL = {
    lv: '#f43f5e', rv: '#38bdf8', la: '#f59e0b', ra: '#2dd4bf',
    aorta: '#fb923c', pa: '#60a5fa',
    grid: '#202a40', gridStrong: '#2c3a57', axis: '#3a4a6a',
    text: '#8a98b4', textDim: '#5d6982', ghost: '#5b6b86'
  };
  var CHAMBERS = ['lv', 'rv', 'la', 'ra'];
  var NAME = { lv: 'LV', rv: 'RV', la: 'LA', ra: 'RA' };

  // Prepare a canvas backing store for the device pixel ratio; returns ctx + CSS size.
  function fit(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function niceStep(range, targetTicks) {
    var raw = range / targetTicks;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
    return step * mag;
  }

  function roundUpTo(v, step) { return Math.ceil(v / step) * step; }

  // ----------------------------------------------------------------- PV loops
  function drawPVLoops(canvas, s) {
    var f = fit(canvas), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);

    var ml = 56, mr = 16, mt = 14, mb = 40;
    var pw = w - ml - mr, ph = h - mt - mb;
    var vMax = s.axis.vMax, pMax = s.axis.pMax;

    function X(v) { return ml + (v / vMax) * pw; }
    function Y(p) { return mt + ph - (p / pMax) * ph; }

    // grid
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    var pStep = niceStep(pMax, 6);
    for (var p = 0; p <= pMax + 0.1; p += pStep) {
      var yy = Y(p);
      ctx.strokeStyle = p === 0 ? COL.axis : COL.grid;
      ctx.beginPath(); ctx.moveTo(ml, yy); ctx.lineTo(ml + pw, yy); ctx.stroke();
      ctx.fillStyle = COL.textDim;
      ctx.fillText(String(Math.round(p)), ml - 8, yy);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var vStep = niceStep(vMax, 6);
    for (var v = 0; v <= vMax + 0.1; v += vStep) {
      var xx = X(v);
      ctx.strokeStyle = v === 0 ? COL.axis : COL.grid;
      ctx.beginPath(); ctx.moveTo(xx, mt); ctx.lineTo(xx, mt + ph); ctx.stroke();
      ctx.fillStyle = COL.textDim;
      ctx.fillText(String(Math.round(v)), xx, mt + ph + 6);
    }

    // axis titles
    ctx.fillStyle = COL.text;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Volume  (mL)', ml + pw / 2, h - 16);
    ctx.save();
    ctx.translate(15, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pressure  (mmHg)', 0, 0);
    ctx.restore();

    // reference ESPVR / EDPVR relations for each visible chamber
    if (s.showRelations && s.model) {
      for (var ci = 0; ci < CHAMBERS.length; ci++) {
        var k = CHAMBERS[ci];
        if (!s.visible[k]) continue;
        ctx.strokeStyle = COL[k];
        ctx.globalAlpha = 0.32;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.4;
        // EDPVR (passive)
        ctx.beginPath();
        var started = false;
        for (var vv = 0; vv <= vMax; vv += vMax / 120) {
          var pe = s.model.endDiastolicP(k, vv);
          if (pe < 0) pe = 0;
          if (pe > pMax * 1.3) break;
          var px = X(vv), py = Y(pe);
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        // ESPVR (active end-systolic relation, straight line P = Ees·(V − Vd))
        ctx.beginPath();
        ctx.moveTo(X(0), Y(Math.max(0, s.model.endSystolicP(k, 0))));
        ctx.lineTo(X(vMax), Y(Math.min(pMax * 1.2, s.model.endSystolicP(k, vMax))));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // ghost (normal) comparison loops
    if (s.ghost) {
      for (var gi = 0; gi < CHAMBERS.length; gi++) {
        var gk = CHAMBERS[gi];
        if (!s.visible[gk] || !s.ghost[gk] || s.ghost[gk].length < 3) continue;
        strokeLoop(ctx, s.ghost[gk], X, Y, COL.ghost, 1.3, 0.5, true);
      }
    }

    // completed loops (filled) + live partial
    for (var li = 0; li < CHAMBERS.length; li++) {
      var c = CHAMBERS[li];
      if (!s.visible[c]) continue;
      var loop = s.loop[c];
      if (loop && loop.length > 3) {
        // fill
        ctx.beginPath();
        ctx.moveTo(X(loop[0].v), Y(loop[0].p));
        for (var i = 1; i < loop.length; i++) ctx.lineTo(X(loop[i].v), Y(loop[i].p));
        ctx.closePath();
        ctx.fillStyle = hexA(COL[c], 0.10);
        ctx.fill();
        strokeLoop(ctx, loop, X, Y, COL[c], 2.0, 0.85, false);
      }
      // live partial (brighter leading trace)
      var cur = s.cur[c];
      if (cur && cur.length > 1) strokeLoop(ctx, cur, X, Y, COL[c], 2.4, 1, false);
      // head marker
      var head = s.head[c];
      if (head) {
        ctx.beginPath();
        ctx.fillStyle = COL[c];
        ctx.arc(X(head.v), Y(head.p), 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0a0e17';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // legend
    var lx = ml + 10, ly = mt + 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Inter, sans-serif';
    for (var le = 0; le < CHAMBERS.length; le++) {
      var lk = CHAMBERS[le];
      if (!s.visible[lk]) continue;
      ctx.fillStyle = COL[lk];
      ctx.fillRect(lx, ly - 4, 14, 8);
      ctx.fillStyle = COL.text;
      ctx.fillText(NAME[lk], lx + 20, ly);
      lx += 52;
    }
  }

  function strokeLoop(ctx, pts, X, Y, color, width, alpha, dashed) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    if (dashed) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(X(pts[0].v), Y(pts[0].p));
    for (var i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i].v), Y(pts[i].p));
    ctx.stroke();
    ctx.restore();
  }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // --------------------------------------------------------------- Wiggers
  function drawWaves(canvas, s) {
    var f = fit(canvas), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    var ml = 42, mr = 10, mt = 10, mb = 18, gap = 10;
    var pw = w - ml - mr;
    var pPlotH = (h - mt - mb - gap) * 0.66;
    var vPlotH = (h - mt - mb - gap) * 0.34;
    var pTop = mt, vTop = mt + pPlotH + gap;

    var wave = s.wave;
    if (!wave.length) return;
    var t1 = s.tNow, t0 = t1 - s.span;
    function X(t) { return ml + ((t - t0) / s.span) * pw; }

    // pressure sub-plot
    var pMax = s.pScale;
    function YP(p) { return pTop + pPlotH - (p / pMax) * pPlotH; }
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = COL.textDim;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    var pst = niceStep(pMax, 4);
    for (var p = 0; p <= pMax + 0.1; p += pst) {
      ctx.strokeStyle = p === 0 ? COL.axis : COL.grid;
      ctx.beginPath(); ctx.moveTo(ml, YP(p)); ctx.lineTo(ml + pw, YP(p)); ctx.stroke();
      ctx.fillText(String(Math.round(p)), ml - 6, YP(p));
    }

    drawTrace(ctx, wave, 'pla', X, YP, COL.la, 1.6);
    drawTrace(ctx, wave, 'psa', X, YP, COL.aorta, 1.8);
    drawTrace(ctx, wave, 'plv', X, YP, COL.lv, 2.0);

    // volume sub-plot
    var vMax = s.vScale;
    function YV(v) { return vTop + vPlotH - (v / vMax) * vPlotH; }
    ctx.strokeStyle = COL.grid;
    ctx.textAlign = 'right';
    for (var vk = 0; vk <= vMax + 0.1; vk += niceStep(vMax, 2)) {
      ctx.strokeStyle = vk === 0 ? COL.axis : COL.grid;
      ctx.beginPath(); ctx.moveTo(ml, YV(vk)); ctx.lineTo(ml + pw, YV(vk)); ctx.stroke();
      ctx.fillStyle = COL.textDim;
      ctx.fillText(String(Math.round(vk)), ml - 6, YV(vk));
    }
    drawTrace(ctx, wave, 'vlv', X, YV, COL.lv, 1.8);

    // labels
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '10.5px Inter, sans-serif';
    ctx.fillStyle = COL.lv; ctx.fillText('LV P', ml + 4, pTop + 2);
    ctx.fillStyle = COL.aorta; ctx.fillText('Aortic P', ml + 46, pTop + 2);
    ctx.fillStyle = COL.la; ctx.fillText('LA P', ml + 110, pTop + 2);
    ctx.fillStyle = COL.lv; ctx.fillText('LV volume (mL)', ml + 4, vTop + 2);
  }

  function drawTrace(ctx, wave, key, X, Y, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < wave.length; i++) {
      var pt = wave[i];
      var x = X(pt.t), y = Y(pt[key]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // --------------------------------------------------------------- Heart schematic
  function drawHeart(canvas, s) {
    var f = fit(canvas), ctx = f.ctx, w = f.w, h = f.h;
    ctx.clearRect(0, 0, w, h);
    var m = s.model;
    var phase = s.phase || 0;

    // layout: RA top-left, RV bottom-left, LA top-right, LV bottom-right
    var cw = w * 0.27, chh = h * 0.32;
    var gapx = w * 0.16, gapy = h * 0.10;
    var leftx = w * 0.5 - gapx / 2 - cw;
    var rightx = w * 0.5 + gapx / 2;
    var topy = h * 0.16, boty = topy + chh + gapy;

    var disp = {
      ra: { x: leftx, y: topy, w: cw, h: chh, col: COL.ra, max: 95, label: 'RA' },
      rv: { x: leftx, y: boty, w: cw, h: chh, col: COL.rv, max: 200, label: 'RV' },
      la: { x: rightx, y: topy, w: cw, h: chh, col: COL.la, max: 95, label: 'LA' },
      lv: { x: rightx, y: boty, w: cw, h: chh, col: COL.lv, max: 200, label: 'LV' }
    };

    // vessels behind chambers
    // vena cava -> RA
    vessel(ctx, leftx + cw * 0.5, topy - h * 0.13, leftx + cw * 0.5, topy, COL.rv, 'IVC/SVC');
    // RV -> PA
    vessel(ctx, leftx + cw * 0.5, boty + chh, leftx + cw * 0.5, boty + chh + h * 0.12, COL.pa, 'PA');
    // pulm veins -> LA
    vessel(ctx, rightx + cw * 0.5, topy - h * 0.13, rightx + cw * 0.5, topy, COL.la, 'Pulm v.');
    // LV -> aorta
    vessel(ctx, rightx + cw * 0.5, boty + chh, rightx + cw * 0.5, boty + chh + h * 0.12, COL.aorta, 'Aorta');

    for (var k in disp) drawChamber(ctx, disp[k], m.V[k], m.P[k], phase);

    // valves (open if forward flow > small threshold)
    valve(ctx, disp.ra, disp.rv, m.flow.tv, 'TV', phase);   // tricuspid
    valve(ctx, disp.la, disp.lv, m.flow.mv, 'MV', phase);   // mitral
    valveVessel(ctx, disp.rv, m.flow.pv, 'PV', phase);      // pulmonic (to PA)
    valveVessel(ctx, disp.lv, m.flow.av, 'AV', phase);      // aortic (to aorta)
  }

  function drawChamber(ctx, d, V, P, phase) {
    var r = 12;
    // shell
    roundRect(ctx, d.x, d.y, d.w, d.h, r);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    // fill level by volume
    var frac = Math.max(0.04, Math.min(1, V / d.max));
    var fh = d.h * frac;
    ctx.save();
    roundRect(ctx, d.x, d.y, d.w, d.h, r);
    ctx.clip();
    var grad = ctx.createLinearGradient(0, d.y + d.h - fh, 0, d.y + d.h);
    grad.addColorStop(0, hexA(d.col, 0.85));
    grad.addColorStop(1, hexA(d.col, 0.45));
    ctx.fillStyle = grad;
    ctx.fillRect(d.x, d.y + d.h - fh, d.w, fh);
    ctx.restore();
    // outline
    roundRect(ctx, d.x, d.y, d.w, d.h, r);
    ctx.strokeStyle = hexA(d.col, 0.9);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // labels
    ctx.fillStyle = '#fff';
    ctx.font = '600 15px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.label, d.x + d.w / 2, d.y + 16);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(Math.round(P) + ' mmHg', d.x + d.w / 2, d.y + d.h / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(Math.round(V) + ' mL', d.x + d.w / 2, d.y + d.h / 2 + 15);
  }

  function valve(ctx, a, b, flow, label, phase) {
    // AV valve sits in the gap between the same-side atrium (a) and ventricle (b)
    var cx = a.x + a.w / 2;
    var y = (a.y + a.h + b.y) / 2;
    var open = flow > 1;
    ctx.strokeStyle = open ? '#34d399' : '#41506e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (open) {
      ctx.moveTo(cx - 13, y); ctx.lineTo(cx - 5, y - 9);
      ctx.moveTo(cx + 13, y); ctx.lineTo(cx + 5, y - 9);
    } else {
      ctx.moveTo(cx - 13, y - 7); ctx.lineTo(cx, y + 2);
      ctx.moveTo(cx + 13, y - 7); ctx.lineTo(cx, y + 2);
    }
    ctx.stroke();
    if (open) drawFlowArrow(ctx, cx, a.y + a.h, cx, b.y, '#34d399', phase, Math.min(1, flow / 400));
    ctx.fillStyle = COL.textDim; ctx.font = '9px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + 16, y);
  }

  function valveVessel(ctx, d, flow, label, phase) {
    var cx = d.x + d.w / 2;
    var y = d.y + d.h + 6;
    var open = flow > 1;
    ctx.strokeStyle = open ? '#34d399' : '#41506e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (open) {
      ctx.moveTo(cx - 11, y); ctx.lineTo(cx - 4, y + 8);
      ctx.moveTo(cx + 11, y); ctx.lineTo(cx + 4, y + 8);
    } else {
      ctx.moveTo(cx - 11, y + 8); ctx.lineTo(cx, y);
      ctx.moveTo(cx + 11, y + 8); ctx.lineTo(cx, y);
    }
    ctx.stroke();
    ctx.fillStyle = COL.textDim; ctx.font = '9px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + 14, y + 4);
  }

  function vessel(ctx, x1, y1, x2, y2, color, label) {
    ctx.strokeStyle = hexA(color, 0.5);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = COL.textDim; ctx.font = '9px Inter';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var labelY = y1 < y2 ? y1 - 7 : y1 + 7; // place label on the outer end of the vessel
    ctx.fillText(label, x1, labelY);
  }

  function drawFlowArrow(ctx, x1, y1, x2, y2, color, phase, intensity) {
    var n = 3;
    ctx.fillStyle = hexA(color, 0.35 + 0.5 * intensity);
    for (var i = 0; i < n; i++) {
      var t = ((phase + i / n) % 1);
      var x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  root.PVLoop = root.PVLoop || {};
  root.PVLoop.plots = {
    drawPVLoops: drawPVLoops,
    drawWaves: drawWaves,
    drawHeart: drawHeart,
    COL: COL
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
