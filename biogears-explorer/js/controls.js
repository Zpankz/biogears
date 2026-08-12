/*
 * controls.js — Data-driven sliders, metrics cards, and cross-link toggles.
 */
(function (root) {
  'use strict';

  var kernel = null;
  function K() {
    if (!kernel) kernel = root.BGX.kernel;
    return kernel;
  }

  function fmtValue(item, v) {
    if (item.fmt) return item.fmt(v);
    var num = item.dec != null ? Number(v).toFixed(item.dec) : String(Math.round(v));
    return num + (item.unit ? ' <span class="unit">' + item.unit + '</span>' : '');
  }

  function buildControls(container, groups, params, baseline, onChange) {
    container.innerHTML = '';
    var refs = {};
    (groups || []).forEach(function (group) {
      var details = document.createElement('details');
      details.className = 'ctl-group';
      if (group.open !== false) details.open = true;
      var summary = document.createElement('summary');
      summary.textContent = group.title;
      details.appendChild(summary);
      var body = document.createElement('div');
      body.className = 'group-body';
      details.appendChild(body);

      (group.items || []).forEach(function (item) {
        var wrap = document.createElement('div');
        wrap.className = 'slider';
        var row = document.createElement('div');
        row.className = 'row';
        var label = document.createElement('label');
        label.textContent = item.label;
        var val = document.createElement('div');
        val.className = 'val';
        val.innerHTML = fmtValue(item, params[item.key]);
        row.appendChild(label);
        row.appendChild(val);

        var input = document.createElement('input');
        input.type = 'range';
        input.min = item.min;
        input.max = item.max;
        input.step = item.step;
        input.value = params[item.key];
        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          val.innerHTML = fmtValue(item, v);
          if (baseline && Math.abs(v - baseline[item.key]) > 1e-9) input.classList.add('mod-changed');
          else input.classList.remove('mod-changed');
          onChange(item.key, v);
        });

        wrap.appendChild(row);
        wrap.appendChild(input);
        body.appendChild(wrap);
        refs[item.key] = { input: input, val: val, item: item };
      });
      container.appendChild(details);
    });

    return {
      refresh: function (p, base) {
        Object.keys(refs).forEach(function (key) {
          var r = refs[key];
          if (p[key] == null) return;
          r.input.value = p[key];
          r.val.innerHTML = fmtValue(r.item, p[key]);
          if (base && Math.abs(p[key] - base[key]) > 1e-9) r.input.classList.add('mod-changed');
          else r.input.classList.remove('mod-changed');
        });
      }
    };
  }

  function buildMetrics(container, rows) {
    container.innerHTML = '';
    (rows || []).forEach(function (m) {
      var card = document.createElement('div');
      card.className = 'metric' + (m.tone ? ' tone-' + m.tone : '');
      card.innerHTML =
        '<div class="m-label">' + m.label + '</div>' +
        '<div class="m-value">' + m.value +
        (m.unit ? ' <span class="unit">' + m.unit + '</span>' : '') +
        '</div>';
      container.appendChild(card);
    });
  }

  function buildCrossLinks(container) {
    var reg = root.BGX.registry;
    container.innerHTML = '';
    reg.crossLinks().forEach(function (link) {
      var row = document.createElement('label');
      row.className = 'cross-row';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = reg.isLinkEnabled(link.from, link.to, link.signal);
      cb.addEventListener('change', function () {
        reg.setLinkEnabled(link.from, link.to, link.signal, cb.checked);
      });
      var text = document.createElement('span');
      text.textContent = link.label;
      row.appendChild(cb);
      row.appendChild(text);
      container.appendChild(row);
    });
  }

  function evidenceText(node) {
    var refs = root.BGX.references.resolve(node.references || []);
    if (!refs.length) return 'Evidence · BioGears-grounded educational models';
    return 'Evidence · ' + refs.map(function (r) { return r.short; }).join(' · ');
  }

  root.BGX = root.BGX || {};
  root.BGX.controls = {
    buildControls: buildControls,
    buildMetrics: buildMetrics,
    buildCrossLinks: buildCrossLinks,
    evidenceText: evidenceText,
    fmtValue: fmtValue
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
