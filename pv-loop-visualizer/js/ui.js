/*
 * ui.js — Builds the control panel (sliders, presets, chamber toggles) and the
 * hemodynamics metrics cards. UI widgets are data-driven from SLIDER_GROUPS and
 * communicate back to app.js purely through callbacks.
 */
(function (root) {
  'use strict';

  var pct = function (v) { return Math.round(v * 100) + '%'; };

  var SLIDER_GROUPS = [
    {
      title: 'Pacing & Preload', open: true, items: [
        { key: 'heartRate', label: 'Heart rate', min: 40, max: 180, step: 1, unit: 'bpm' },
        { key: 'bloodVolume', label: 'Blood volume', min: 3500, max: 6500, step: 50, unit: 'mL' }
      ]
    },
    {
      title: 'Contractility (Ees)', open: true, items: [
        { key: 'lvEes', label: 'LV contractility', min: 0.2, max: 5, step: 0.05, unit: 'mmHg/mL', dec: 2 },
        { key: 'rvEes', label: 'RV contractility', min: 0.1, max: 3, step: 0.05, unit: 'mmHg/mL', dec: 2 },
        { key: 'laEes', label: 'LA contractility', min: 0.1, max: 1.5, step: 0.05, unit: 'mmHg/mL', dec: 2 },
        { key: 'raEes', label: 'RA contractility', min: 0.1, max: 1.5, step: 0.05, unit: 'mmHg/mL', dec: 2 }
      ]
    },
    {
      title: 'Diastolic Stiffness', open: false, items: [
        { key: 'lvStiffness', label: 'LV stiffness', min: 0.4, max: 4, step: 0.05, unit: '×', dec: 2 },
        { key: 'rvStiffness', label: 'RV stiffness', min: 0.4, max: 4, step: 0.05, unit: '×', dec: 2 },
        { key: 'laStiffness', label: 'LA stiffness', min: 0.4, max: 4, step: 0.05, unit: '×', dec: 2 },
        { key: 'raStiffness', label: 'RA stiffness', min: 0.4, max: 4, step: 0.05, unit: '×', dec: 2 }
      ]
    },
    {
      title: 'Afterload & Vasculature', open: true, items: [
        { key: 'systemicResistance', label: 'Systemic resistance (SVR)', min: 0.3, max: 2.5, step: 0.05, unit: 'mmHg·s/mL', dec: 2 },
        { key: 'pulmonaryResistance', label: 'Pulmonary resistance (PVR)', min: 0.03, max: 0.6, step: 0.01, unit: 'mmHg·s/mL', dec: 2 },
        { key: 'arterialCompliance', label: 'Arterial compliance', min: 0.4, max: 3, step: 0.05, unit: 'mL/mmHg', dec: 2 },
        { key: 'pulmonaryCompliance', label: 'Pulmonary compliance', min: 1, max: 10, step: 0.1, unit: 'mL/mmHg', dec: 1 }
      ]
    },
    {
      title: 'Valves — Stenosis / Regurgitation', open: false, items: [
        { key: 'mitralStenosis', label: 'Mitral stenosis', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'mitralRegurg', label: 'Mitral regurgitation', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'aorticStenosis', label: 'Aortic stenosis', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'aorticRegurg', label: 'Aortic regurgitation', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'tricuspidStenosis', label: 'Tricuspid stenosis', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'tricuspidRegurg', label: 'Tricuspid regurgitation', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'pulmonicStenosis', label: 'Pulmonic stenosis', min: 0, max: 1, step: 0.01, fmt: pct },
        { key: 'pulmonicRegurg', label: 'Pulmonic regurgitation', min: 0, max: 1, step: 0.01, fmt: pct }
      ]
    }
  ];

  function fmtValue(item, v) {
    if (item.fmt) return item.fmt(v);
    var num = item.dec != null ? v.toFixed(item.dec) : String(Math.round(v));
    return num + (item.unit ? ' <span class="unit">' + item.unit + '</span>' : '');
  }

  function buildControls(container, params, baseline, onChange) {
    container.innerHTML = '';
    var refs = {};
    SLIDER_GROUPS.forEach(function (group) {
      var details = document.createElement('details');
      details.className = 'ctl-group';
      if (group.open) details.open = true;
      var summary = document.createElement('summary');
      summary.textContent = group.title;
      details.appendChild(summary);
      var body = document.createElement('div');
      body.className = 'group-body';
      details.appendChild(body);

      group.items.forEach(function (item) {
        var wrap = document.createElement('div');
        wrap.className = 'slider';
        var row = document.createElement('div');
        row.className = 'row';
        var label = document.createElement('label');
        label.textContent = item.label;
        var val = document.createElement('div');
        val.className = 'val';
        val.innerHTML = fmtValue(item, params[item.key]);
        row.appendChild(label); row.appendChild(val);

        var input = document.createElement('input');
        input.type = 'range';
        input.min = item.min; input.max = item.max; input.step = item.step;
        input.value = params[item.key];

        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          val.innerHTML = fmtValue(item, v);
          markChanged(input, v, baseline[item.key]);
          onChange(item.key, v);
        });

        wrap.appendChild(row); wrap.appendChild(input);
        body.appendChild(wrap);
        refs[item.key] = { input: input, val: val, item: item };
      });
      container.appendChild(details);
    });

    function markChanged(input, v, base) {
      if (base != null && Math.abs(v - base) > 1e-9) input.classList.add('mod-changed');
      else input.classList.remove('mod-changed');
    }

    return {
      refresh: function (p, base) {
        Object.keys(refs).forEach(function (key) {
          var r = refs[key];
          r.input.value = p[key];
          r.val.innerHTML = fmtValue(r.item, p[key]);
          markChanged(r.input, p[key], base[key]);
        });
      }
    };
  }

  function buildChamberToggles(container, visible, onToggle) {
    container.innerHTML = '';
    var order = [['lv', 'LV'], ['rv', 'RV'], ['la', 'LA'], ['ra', 'RA']];
    order.forEach(function (pair) {
      var key = pair[0];
      var chip = document.createElement('button');
      chip.className = 'chip' + (visible[key] ? ' on' : '');
      chip.setAttribute('data-ch', key);
      chip.innerHTML = '<span class="dot"></span>' + pair[1];
      chip.addEventListener('click', function () {
        visible[key] = !visible[key];
        chip.classList.toggle('on', visible[key]);
        onToggle(key, visible[key]);
      });
      container.appendChild(chip);
    });
  }

  function buildPresetSelect(select, presets, onSelect) {
    select.innerHTML = '';
    var groups = {};
    Object.keys(presets).forEach(function (key) {
      var g = presets[key].group || 'Other';
      (groups[g] = groups[g] || []).push(key);
    });
    Object.keys(groups).forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = g;
      groups[g].forEach(function (key) {
        var opt = document.createElement('option');
        opt.value = key;
        opt.textContent = presets[key].label;
        og.appendChild(opt);
      });
      select.appendChild(og);
    });
    select.addEventListener('change', function () { onSelect(select.value); });
  }

  // ---- metrics ----------------------------------------------------------------
  function flag(value, lo, hi) {
    if (value < lo) return 'flag-bad';
    if (value > hi) return 'flag-bad';
    return '';
  }

  function row(label, value, cls) {
    return '<div class="metric-row"><span>' + label + '</span><span class="' + (cls || '') + '">' + value + '</span></div>';
  }

  function card(title, color, rowsHtml) {
    return '<div class="metric-card"><h3><span class="dot" style="background:' + color + '"></span>' + title + '</h3>' + rowsHtml + '</div>';
  }

  function renderMetrics(container, m) {
    if (!m || !m.lv) { container.innerHTML = '<p class="hint">Collecting first beat…</p>'; return; }
    var C = root.PVLoop.plots.COL;
    var html = '';
    html += card('Left Ventricle', C.lv,
      row('EDV', Math.round(m.lv.edv) + ' mL') +
      row('ESV', Math.round(m.lv.esv) + ' mL') +
      row('Stroke vol', Math.round(m.lv.sv) + ' mL') +
      row('Ejection fraction', Math.round(m.lv.ef) + ' %', m.lv.ef < 50 ? 'flag-bad' : (m.lv.ef < 55 ? 'flag-warn' : 'flag-good')) +
      row('Peak pressure', Math.round(m.lv.pMax) + ' mmHg'));
    html += card('Right Ventricle', C.rv,
      row('EDV', Math.round(m.rv.edv) + ' mL') +
      row('ESV', Math.round(m.rv.esv) + ' mL') +
      row('Stroke vol', Math.round(m.rv.sv) + ' mL') +
      row('Ejection fraction', Math.round(m.rv.ef) + ' %') +
      row('Peak pressure', Math.round(m.rv.pMax) + ' mmHg'));
    html += card('Left Atrium', C.la,
      row('Volume', Math.round(m.la.esv) + '–' + Math.round(m.la.edv) + ' mL') +
      row('Mean pressure', Math.round(m.la.pMean) + ' mmHg', m.la.pMean > 18 ? 'flag-bad' : (m.la.pMean > 14 ? 'flag-warn' : '')) +
      row('Peak (v-wave)', Math.round(m.la.pMax) + ' mmHg'));
    html += card('Right Atrium', C.ra,
      row('Volume', Math.round(m.ra.esv) + '–' + Math.round(m.ra.edv) + ' mL') +
      row('Mean pressure', Math.round(m.ra.pMean) + ' mmHg', m.ra.pMean > 8 ? 'flag-warn' : '') +
      row('Peak pressure', Math.round(m.ra.pMax) + ' mmHg'));
    html += card('Systemic', C.aorta,
      row('Arterial pressure', Math.round(m.sys.sbp) + '/' + Math.round(m.sys.dbp) + ' mmHg') +
      row('Mean (MAP)', Math.round(m.sys.map) + ' mmHg', m.sys.map < 65 ? 'flag-bad' : (m.sys.map > 110 ? 'flag-warn' : 'flag-good')) +
      row('Cardiac output', m.co.toFixed(1) + ' L/min', m.co < 4 ? 'flag-bad' : 'flag-good') +
      row('Heart rate', Math.round(m.hr) + ' bpm'));
    html += card('Pulmonary', C.pa,
      row('PA pressure', Math.round(m.pulm.pas) + '/' + Math.round(m.pulm.pad) + ' mmHg') +
      row('Mean PAP', Math.round(m.pulm.pamean) + ' mmHg', m.pulm.pamean > 20 ? 'flag-warn' : '') +
      row('Cardiac index', (m.co / 1.9).toFixed(1) + ' L/min/m²'));
    container.innerHTML = html;
  }

  root.PVLoop = root.PVLoop || {};
  root.PVLoop.ui = {
    buildControls: buildControls,
    buildChamberToggles: buildChamberToggles,
    buildPresetSelect: buildPresetSelect,
    renderMetrics: renderMetrics,
    SLIDER_GROUPS: SLIDER_GROUPS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
