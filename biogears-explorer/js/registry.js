/*
 * registry.js — Concept-node graph, breadcrumbs, and cross-link bus.
 */
(function (root) {
  'use strict';

  var nodes = Object.create(null);
  var linkState = Object.create(null); // enabled flags keyed by "from->to:signal"
  var subscribers = [];

  function register(nodeDef) {
    if (!nodeDef || !nodeDef.meta || !nodeDef.meta.id) {
      throw new Error('BGX.register: node requires meta.id');
    }
    nodes[nodeDef.meta.id] = nodeDef;
    return nodeDef;
  }

  function get(id) {
    return nodes[id] || null;
  }

  function all() {
    return Object.keys(nodes).map(function (k) { return nodes[k]; });
  }

  function childrenOf(id) {
    return all().filter(function (n) {
      return n.meta.parents && n.meta.parents.indexOf(id) !== -1;
    });
  }

  function parentsOf(id) {
    var n = get(id);
    if (!n || !n.meta.parents) return [];
    return n.meta.parents.map(get).filter(Boolean);
  }

  /** Breadcrumb trail from organism root to the given node. */
  function breadcrumbs(id) {
    var trail = [];
    var cur = get(id);
    var guard = 0;
    while (cur && guard++ < 20) {
      trail.unshift(cur);
      var parents = parentsOf(cur.meta.id);
      cur = parents.length ? parents[0] : null;
      if (cur && cur.meta.id === 'organism') {
        trail.unshift(cur);
        break;
      }
    }
    if (!trail.length || trail[0].meta.id !== 'organism') {
      var root = get('organism');
      if (root) trail.unshift(root);
    }
    return trail;
  }

  function linkKey(from, to, signal) {
    return from + '->' + to + ':' + signal;
  }

  function setLinkEnabled(from, to, signal, on) {
    linkState[linkKey(from, to, signal)] = !!on;
    notify({ type: 'link', from: from, to: to, signal: signal, on: !!on });
  }

  function isLinkEnabled(from, to, signal) {
    var k = linkKey(from, to, signal);
    return linkState[k] === true;
  }

  /** Default cross-link catalogue used by the Controls rail. */
  var CROSS_LINKS = [
    { from: 'cardiovascular', to: 'gasexchange', signal: 'cardiacOutput', label: 'CO → O₂ delivery' },
    { from: 'gasexchange', to: 'acidbase', signal: 'PaCO2', label: 'PaCO₂ → acid–base' },
    { from: 'acidbase', to: 'gasexchange', signal: 'ventDrive', label: 'Vent drive → VA' },
    { from: 'pkpd', to: 'cardiovascular', signal: 'hrEffect', label: 'Drug → HR / Ees' },
    { from: 'thermoregulation', to: 'cardiovascular', signal: 'skinFlow', label: 'Thermo → skin flow' },
    { from: 'membrane', to: 'pkpd', signal: 'occupancy', label: 'Receptor → PD gain' }
  ];

  function crossLinks() {
    return CROSS_LINKS.slice();
  }

  function subscribe(fn) {
    subscribers.push(fn);
    return function () {
      subscribers = subscribers.filter(function (f) { return f !== fn; });
    };
  }

  function notify(evt) {
    subscribers.forEach(function (fn) {
      try { fn(evt); } catch (e) { /* keep bus alive */ }
    });
  }

  /** Publish a named signal value from an active node. */
  function publish(from, signal, value) {
    notify({ type: 'signal', from: from, signal: signal, value: value });
  }

  root.BGX = root.BGX || {};
  root.BGX.registry = {
    register: register,
    get: get,
    all: all,
    childrenOf: childrenOf,
    parentsOf: parentsOf,
    breadcrumbs: breadcrumbs,
    setLinkEnabled: setLinkEnabled,
    isLinkEnabled: isLinkEnabled,
    crossLinks: crossLinks,
    subscribe: subscribe,
    publish: publish
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.BGX.registry;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
