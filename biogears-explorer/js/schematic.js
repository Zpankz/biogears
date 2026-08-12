/*
 * schematic.js — Neon schematic rendering kit.
 * Codifies the dark neon-HUD aesthetic of the reference physiology diagrams:
 * glow strokes, labelled nodes, animated flow particles, gauges, mono annotations.
 */
(function (root) {
  'use strict';

  var COLORS = {
    cyan: '#38bdf8',
    magenta: '#f472b6',
    lime: '#a3e635',
    yellow: '#fbbf24',
    orange: '#fb923c',
    red: '#fb7185',
    white: '#e8edf6',
    dim: '#9aa7bf',
    faint: '#66728c',
    panel: 'rgba(21, 28, 44, 0.55)'
  };

  function createKit(ctx) {
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

    function clear(w, h, bg) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bg || '#05080f';
      ctx.fillRect(0, 0, w, h);
      // subtle vignette
      var g = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(56,189,248,0.04)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    function glowStroke(color, width, blur) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width == null ? 1.5 : width;
      ctx.shadowColor = color;
      ctx.shadowBlur = blur == null ? 10 : blur;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    function label(text, x, y, opts) {
      opts = opts || {};
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = opts.color || COLORS.white;
      ctx.font = (opts.weight || '600') + ' ' + (opts.size || 11) + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
      ctx.textAlign = opts.align || 'center';
      ctx.textBaseline = opts.baseline || 'middle';
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    function node(x, y, w, h, opts) {
      opts = opts || {};
      var color = opts.color || COLORS.cyan;
      var r = opts.radius == null ? 10 : opts.radius;
      ctx.save();
      glowStroke(color, opts.lineWidth || 1.6, opts.glow == null ? 14 : opts.glow);
      ctx.fillStyle = opts.fill || 'rgba(8,12,22,0.85)';
      roundRect(x - w / 2, y - h / 2, w, h, r);
      ctx.fill();
      ctx.stroke();
      if (opts.title) label(opts.title, x, y - (opts.subtitle ? 6 : 0), { size: opts.titleSize || 11, color: color });
      if (opts.subtitle) label(opts.subtitle, x, y + 10, { size: 9, color: COLORS.dim, weight: '400' });
      ctx.restore();
      return { x: x, y: y, w: w, h: h };
    }

    function circle(x, y, r, opts) {
      opts = opts || {};
      var color = opts.color || COLORS.cyan;
      ctx.save();
      glowStroke(color, opts.lineWidth || 1.6, opts.glow == null ? 12 : opts.glow);
      ctx.fillStyle = opts.fill || 'rgba(8,12,22,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (opts.title) label(opts.title, x, y, { size: opts.titleSize || 10, color: color });
      ctx.restore();
      return { x: x, y: y, r: r };
    }

    function edge(a, b, opts) {
      opts = opts || {};
      var color = opts.color || COLORS.cyan;
      ctx.save();
      glowStroke(color, opts.width || 1.4, opts.glow == null ? 8 : opts.glow);
      if (opts.dashed) ctx.setLineDash([5, 5]);
      ctx.beginPath();
      if (opts.curve) {
        var mx = (a.x + b.x) / 2;
        var my = (a.y + b.y) / 2 + (opts.curve || 0);
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
      } else {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      if (opts.arrow) {
        var ang = Math.atan2(b.y - a.y, b.x - a.x);
        var s = 7;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - s * Math.cos(ang - 0.4), b.y - s * Math.sin(ang - 0.4));
        ctx.lineTo(b.x - s * Math.cos(ang + 0.4), b.y - s * Math.sin(ang + 0.4));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }

    /** Animated particles along a straight edge. rate in [0,1+] controls density/speed. */
    function flowParticles(a, b, t, opts) {
      opts = opts || {};
      var color = opts.color || COLORS.cyan;
      var rate = Math.max(0, opts.rate == null ? 0.5 : opts.rate);
      var count = Math.max(1, Math.round(3 + rate * 5));
      var speed = 0.15 + rate * 0.35;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      for (var i = 0; i < count; i++) {
        var u = (t * speed + i / count) % 1;
        if (opts.reverse) u = 1 - u;
        var x = a.x + (b.x - a.x) * u;
        var y = a.y + (b.y - a.y) * u;
        ctx.beginPath();
        ctx.arc(x, y, opts.size || 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function gauge(x, y, r, value, min, max, opts) {
      opts = opts || {};
      var color = opts.color || COLORS.cyan;
      var frac = (value - min) / (max - min);
      frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
      var start = -Math.PI * 0.75;
      var end = Math.PI * 0.75;
      ctx.save();
      glowStroke(COLORS.faint, 3, 0);
      ctx.beginPath();
      ctx.arc(x, y, r, start, end);
      ctx.stroke();
      glowStroke(color, 3.5, 12);
      ctx.beginPath();
      ctx.arc(x, y, r, start, start + (end - start) * frac);
      ctx.stroke();
      if (opts.label) label(opts.label, x, y + r + 14, { size: 9, color: COLORS.dim });
      if (opts.valueText) label(opts.valueText, x, y, { size: 11, color: color });
      ctx.restore();
    }

    function band(y, h, color) {
      ctx.save();
      ctx.fillStyle = color || 'rgba(42,54,80,0.45)';
      ctx.shadowBlur = 0;
      ctx.fillRect(0, y, ctx.canvas.width / dpr, h);
      ctx.restore();
    }

    function sparkline(seriesArr, x, y, w, h, opts) {
      opts = opts || {};
      if (!seriesArr || seriesArr.length < 2) return;
      var color = opts.color || COLORS.cyan;
      var min = Infinity, max = -Infinity, i;
      for (i = 0; i < seriesArr.length; i++) {
        if (seriesArr[i] < min) min = seriesArr[i];
        if (seriesArr[i] > max) max = seriesArr[i];
      }
      if (max - min < 1e-9) { min -= 1; max += 1; }
      ctx.save();
      glowStroke(color, 1.4, 6);
      ctx.beginPath();
      for (i = 0; i < seriesArr.length; i++) {
        var px = x + (i / (seriesArr.length - 1)) * w;
        var py = y + h - ((seriesArr[i] - min) / (max - min)) * h;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (opts.label) label(opts.label, x + 4, y + 8, { size: 9, color: color, align: 'left' });
      ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function fitCanvas(canvas, cssW, cssH) {
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: cssW, h: cssH, dpr: dpr };
    }

    return {
      COLORS: COLORS,
      clear: clear,
      glowStroke: glowStroke,
      label: label,
      node: node,
      circle: circle,
      edge: edge,
      flowParticles: flowParticles,
      gauge: gauge,
      band: band,
      sparkline: sparkline,
      fitCanvas: fitCanvas,
      ctx: ctx
    };
  }

  root.BGX = root.BGX || {};
  root.BGX.schematic = { createKit: createKit, COLORS: COLORS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.BGX.schematic;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
