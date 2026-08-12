/*
 * navigator.js — Hierarchy tree + mini overview map.
 */
(function (root) {
  'use strict';

  function buildTree(container, activeId, onSelect) {
    var reg = root.BGX.registry;
    container.innerHTML = '';

    function renderNode(node, depth) {
      var kids = reg.childrenOf(node.meta.id);
      var el = document.createElement('div');
      el.className = 'tree-node' + (node.meta.id === activeId ? ' active' : '');
      el.style.paddingLeft = (8 + depth * 12) + 'px';
      el.setAttribute('role', 'treeitem');
      el.setAttribute('aria-selected', node.meta.id === activeId ? 'true' : 'false');

      var swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = node.meta.color || '#38bdf8';
      el.appendChild(swatch);

      var label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = node.meta.title;
      el.appendChild(label);

      if (kids.length) {
        var badge = document.createElement('span');
        badge.className = 'tree-badge';
        badge.textContent = String(kids.length);
        el.appendChild(badge);
      }

      el.addEventListener('click', function () { onSelect(node.meta.id); });
      container.appendChild(el);
      kids.forEach(function (k) { renderNode(k, depth + 1); });
    }

    var rootNode = reg.get('organism');
    if (rootNode) renderNode(rootNode, 0);
  }

  function buildBreadcrumbs(container, activeId, onSelect) {
    var trail = root.BGX.registry.breadcrumbs(activeId);
    container.innerHTML = '';
    trail.forEach(function (n, i) {
      if (i > 0) {
        var sep = document.createElement('span');
        sep.className = 'crumb-sep';
        sep.textContent = '›';
        container.appendChild(sep);
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crumb' + (i === trail.length - 1 ? ' current' : '');
      btn.textContent = n.meta.title;
      btn.addEventListener('click', function () { onSelect(n.meta.id); });
      container.appendChild(btn);
    });
  }

  function drawMiniMap(canvas, activeId, onSelect) {
    var reg = root.BGX.registry;
    var kit = root.BGX.schematic.createKit(canvas.getContext('2d'));
    var rect = canvas.getBoundingClientRect();
    var layout = kit.fitCanvas(canvas, rect.width || 280, rect.height || 180);
    kit.clear(layout.w, layout.h);

    var systems = reg.childrenOf('organism');
    var positions = Object.create(null);
    var cx = layout.w / 2;
    var cy = layout.h / 2;
    var R = Math.min(layout.w, layout.h) * 0.34;

    kit.circle(cx, cy, 18, {
      color: '#e8edf6',
      title: 'ORG',
      titleSize: 8,
      glow: 8
    });
    positions.organism = { x: cx, y: cy };

    systems.forEach(function (sys, i) {
      var ang = -Math.PI / 2 + (i / systems.length) * Math.PI * 2;
      var x = cx + Math.cos(ang) * R;
      var y = cy + Math.sin(ang) * R;
      positions[sys.meta.id] = { x: x, y: y };
      kit.edge(positions.organism, { x: x, y: y }, { color: sys.meta.color, width: 1, glow: 4 });
      kit.circle(x, y, sys.meta.id === activeId || isDescendant(activeId, sys.meta.id) ? 14 : 11, {
        color: sys.meta.color,
        title: sys.meta.title.slice(0, 3).toUpperCase(),
        titleSize: 7,
        glow: 10
      });
    });

    // Hit testing
    canvas.onclick = function (ev) {
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left;
      var y = ev.clientY - r.top;
      var best = null, bestD = 22;
      Object.keys(positions).forEach(function (id) {
        var p = positions[id];
        var d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) { bestD = d; best = id; }
      });
      if (best) onSelect(best);
    };

    function isDescendant(id, ancestorId) {
      var trail = reg.breadcrumbs(id);
      return trail.some(function (n) { return n.meta.id === ancestorId; });
    }
  }

  root.BGX = root.BGX || {};
  root.BGX.navigator = {
    buildTree: buildTree,
    buildBreadcrumbs: buildBreadcrumbs,
    drawMiniMap: drawMiniMap
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
