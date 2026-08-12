#!/usr/bin/env node
/*
 * Headless steady-state checks for BioGears Explorer educational models.
 * Usage: node biogears-explorer/tools/verify.js
 */
'use strict';

var path = require('path');
var fs = require('fs');
var vm = require('vm');

function load(file) {
  var code = fs.readFileSync(file, 'utf8');
  vm.runInThisContext(code, { filename: file });
}

var root = path.resolve(__dirname, '..');
var workspace = path.resolve(root, '..');

// Minimal DOM-less bootstrap of the shared namespace + models
global.BGX = {};
load(path.join(root, 'js/kernel.js'));
load(path.join(root, 'js/schematic.js'));
// schematic needs nothing from canvas for model tests
load(path.join(root, 'js/registry.js'));
load(path.join(root, 'data/references.js'));
load(path.join(workspace, 'pv-loop-visualizer/js/model.js'));
load(path.join(root, 'js/nodes/cardiovascular.js'));
load(path.join(root, 'js/nodes/thermoregulation.js'));
load(path.join(root, 'js/nodes/acidbase.js'));
load(path.join(root, 'js/nodes/pkpd.js'));
load(path.join(root, 'js/nodes/membrane.js'));
load(path.join(root, 'js/nodes/gasexchange.js'));

var pass = 0;
var fail = 0;

function assert(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  OK  ' + name);
  } else {
    fail++;
    console.log('  FAIL  ' + name + (detail ? ' — ' + detail : ''));
  }
}

function run(id, settleSec, checks) {
  console.log('\n[' + id + ']');
  var node = BGX.registry.get(id);
  assert('registered', !!node);
  if (!node) return;
  var m = node.createModel();
  m.settle(settleSec);
  checks(m);
}

run('thermoregulation', 180, function (m) {
  assert('core near 37', Math.abs(m.state.Tcore - 37) < 1.5, 'Tcore=' + m.state.Tcore);
  assert('skin below core', m.state.Tskin < m.state.Tcore, 'Tskin=' + m.state.Tskin);
  m.setParam('ambientT', 5);
  m.setParam('metabolicMult', 1);
  m.advance(120);
  assert('cold cools skin or induces shiver', m.state.shiver > 0 || m.state.Tskin < 34,
    'shiver=' + m.state.shiver + ' Tskin=' + m.state.Tskin);
});

run('acidbase', 60, function (m) {
  assert('PaCO2 near 40', Math.abs(m.state.PaCO2 - 40) < 8, 'PaCO2=' + m.state.PaCO2);
  assert('pH near 7.4', Math.abs(m.state.pH - 7.4) < 0.08, 'pH=' + m.state.pH);
  m.setParam('VA', 2.0);
  m.advance(40);
  assert('hypoventilation raises PaCO2', m.state.PaCO2 > 45, 'PaCO2=' + m.state.PaCO2);
});

run('pkpd', 5, function (m) {
  m.setParam('dose', 50);
  m.advance(1);
  assert('bolus raises plasma', m.state.plasma > 0.1, 'plasma=' + m.state.plasma);
  m.advance(60);
  assert('effect-site tracks', m.state.effect > 0, 'effect=' + m.state.effect);
  assert('response in range', m.state.response >= 0 && m.state.response <= m.params.Emax + 0.05);
});

run('gasexchange', 10, function (m) {
  assert('PaO2 physiologic', m.state.PaO2 > 70 && m.state.PaO2 < 130, 'PaO2=' + m.state.PaO2);
  assert('CaO2 ~20', m.state.CaO2 > 15 && m.state.CaO2 < 25, 'CaO2=' + m.state.CaO2);
  assert('DO2 positive', m.state.DO2 > 500, 'DO2=' + m.state.DO2);
});

run('membrane', 5, function (m) {
  m.setParam('ligand', 1.0);
  m.setParam('Kd', 0.25);
  m.advance(2);
  assert('occupancy rises', m.state.occupancy > 0.5, 'θ=' + m.state.occupancy);
});

run('cardiovascular', 5, function (m) {
  assert('has PVLoop volumes', m.state.V && m.state.V.lv > 0, 'V.lv=' + (m.state.V && m.state.V.lv));
  assert('aortic pressure positive', m.state.P.sa > 20, 'P.sa=' + m.state.P.sa);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
