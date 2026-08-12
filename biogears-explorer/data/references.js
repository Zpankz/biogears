/*
 * references.js — Citation keys used by concept nodes.
 * Each entry surfaces in the evidence strip / References panel.
 */
(function (root) {
  'use strict';

  var REFS = {
    biogears_cv: {
      short: 'BioGears Cardiovascular.cpp · CalculateHeartElastance',
      detail: 'Double-Hill ventricular activation (α1=0.303, α2=0.508, n1=1.32, n2=21.9) and chamber elastance maxima from BioGearsConfiguration.'
    },
    burkhoff_pv: {
      short: 'Burkhoff et al. — Pressure–volume analysis',
      detail: 'Time-varying elastance framework for cardiac PV loops (ESPVR / EDPVR).'
    },
    biogears_energy: {
      short: 'BioGears Energy.cpp · Core/Skin temperatures, Sweat, Shivering',
      detail: 'Core ~37°C, mean skin ~34.4°C; sweat and shivering effector logic under hypothalamic set-point control.'
    },
    biogears_env: {
      short: 'BioGears Environment.cpp · Ambient heat exchange',
      detail: 'Radiation, convection, evaporation and clothing effects on skin heat loss.'
    },
    gagge: {
      short: 'Gagge two-node model (core–skin)',
      detail: 'Classic two-compartment thermoregulation model used as the educational ODE scaffold.'
    },
    biogears_bc: {
      short: 'BioGears BloodChemistry.cpp · Acid–base / CO₂',
      detail: 'Plasma bicarbonate, pH events (acidosis <7.36, alkalosis >7.45) and CO₂ transport fractions.'
    },
    biogears_resp: {
      short: 'BioGears Respiratory.cpp · RespiratoryDriver / chemoreflex',
      detail: 'Arterial CO₂–driven respiratory drive modulating alveolar ventilation.'
    },
    hh_equation: {
      short: 'Henderson–Hasselbalch',
      detail: 'pH = 6.1 + log10([HCO₃⁻] / (0.03 · PaCO₂)) — educational acid–base relation.'
    },
    biogears_drugs: {
      short: 'BioGears Drugs.cpp · CalculateDrugEffects / Clearance',
      detail: 'Effect-site rate constant, EC50 sigmoid Emax PD, hepatic/renal clearance PK.'
    },
    biogears_diff: {
      short: 'BioGears Diffusion.cpp / Respiratory gas exchange',
      detail: 'Alveolar–capillary O₂/CO₂ diffusion and content equations (CaO₂).'
    },
    west_resp: {
      short: 'West — Respiratory Physiology: The Essentials',
      detail: 'Alveolar gas equation, dead-space, and O₂–CO₂ transport fundamentals.'
    },
    receptor_pd: {
      short: 'Receptor occupancy / cascade kinetics (educational)',
      detail: 'Mass-action ligand–receptor binding and simplified GPCR / RTK / JAK-STAT cascade stages.'
    },
    bohr_haldane: {
      short: 'Bohr & Haldane effects',
      detail: 'O₂ affinity shifts with PCO₂/H⁺; deoxy-Hb carries more CO₂/H⁺.'
    }
  };

  function resolve(keys) {
    return (keys || []).map(function (k) {
      return REFS[k] || { short: k, detail: '' };
    });
  }

  root.BGX = root.BGX || {};
  root.BGX.references = { REFS: REFS, resolve: resolve };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.BGX.references;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
