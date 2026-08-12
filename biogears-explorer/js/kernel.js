/*
 * kernel.js — Shared integrator helpers, unit formatting, and the Concept Node
 * contract used by every leaf/parent in BioGears Explorer.
 *
 * Contract (each node module registers an object with Registry.register):
 *   meta:       { id, title, tier, parents[], children[], blurb, color }
 *   createModel(): { params, state, reset(), setParam(k,v), advance(sec),
 *                    settle(sec), evaluate(), getSeries(), getFluxes() }
 *   schematic(ctx, kit, model, t, layout)
 *   controls:   [ { title, open, items:[{key,label,min,max,step,unit,dec}] } ]
 *   metrics(model): [ { label, value, unit, tone? } ]
 *   links:      { outputs:[{id,label}], inputs:[{id,label}] }
 *   references: string[] of citation keys into data/references.js
 */
(function (root) {
  'use strict';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function copy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Explicit-Euler stepper for a state dictionary given a derivative function. */
  function integrate(state, dt, seconds, deriv) {
    var n = Math.max(1, Math.round(seconds / dt));
    var i, k, d;
    for (i = 0; i < n; i++) {
      d = deriv(state);
      for (k in d) {
        if (Object.prototype.hasOwnProperty.call(d, k)) {
          state[k] += d[k] * dt;
        }
      }
    }
  }

  /** Hill / Emax sigmoidoid used by BioGears CalculateDrugEffects. */
  function emax(conc, eMax, ec50, n) {
    n = n == null ? 1 : n;
    if (ec50 <= 0) return 0;
    var cN = Math.pow(Math.max(0, conc), n);
    var eN = Math.pow(ec50, n);
    return eMax * (cN / (cN + eN));
  }

  /** Ring buffer of numeric samples for sparkline traces. */
  function Series(capacity) {
    this.cap = capacity || 240;
    this.buf = new Float64Array(this.cap);
    this.i = 0;
    this.n = 0;
  }
  Series.prototype.push = function (v) {
    this.buf[this.i] = v;
    this.i = (this.i + 1) % this.cap;
    if (this.n < this.cap) this.n++;
  };
  Series.prototype.toArray = function () {
    var out = new Array(this.n);
    var start = this.n === this.cap ? this.i : 0;
    for (var k = 0; k < this.n; k++) out[k] = this.buf[(start + k) % this.cap];
    return out;
  };

  function fmt(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    if (dec == null) dec = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
    return Number(v).toFixed(dec);
  }

  root.BGX = root.BGX || {};
  root.BGX.kernel = {
    clamp: clamp,
    lerp: lerp,
    copy: copy,
    integrate: integrate,
    emax: emax,
    Series: Series,
    fmt: fmt
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.BGX.kernel;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
