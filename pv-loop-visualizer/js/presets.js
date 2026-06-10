/*
 * presets.js — Physiological and pathological scenarios for the PV-loop visualiser.
 * Each preset supplies parameter overrides on top of the healthy defaults defined
 * in model.js. Values were tuned against the closed-loop model (see tools/tune.js)
 * to reproduce the characteristic loop morphology of each condition.
 */
(function (root) {
  'use strict';

  var presets = {
    normal: {
      label: 'Normal',
      group: 'Physiology',
      blurb: 'Healthy resting adult. LV ~120/8 mmHg, EF ~60%, CO ~5 L/min.',
      params: {}
    },

    exercise: {
      label: 'Exercise',
      group: 'Physiology',
      blurb: 'Sympathetic drive: faster rate, stronger contraction, vasodilated muscle beds. CO rises sharply.',
      params: {
        heartRate: 145, lvEes: 4.0, rvEes: 1.7, laEes: 0.8, raEes: 0.7,
        systemicResistance: 0.55, pulmonaryResistance: 0.08, bloodVolume: 5200
      }
    },

    hfref: {
      label: 'Systolic HF (HFrEF)',
      group: 'Failure',
      blurb: 'Dilated, weak LV: low contractility, volume overload, compensatory tachycardia. EF falls, loop shifts right.',
      params: {
        lvEes: 0.7, rvEes: 0.8, lvStiffness: 0.8, heartRate: 95,
        systemicResistance: 1.35, bloodVolume: 5600
      }
    },

    hfpef: {
      label: 'Diastolic HF (HFpEF)',
      group: 'Failure',
      blurb: 'Stiff, non-compliant LV: preserved EF but high filling pressures and a tall, steep diastolic limb.',
      params: {
        lvStiffness: 2.2, lvEes: 2.7, laStiffness: 1.3,
        heartRate: 82, bloodVolume: 5300
      }
    },

    hypertension: {
      label: 'Hypertension',
      group: 'Loading',
      blurb: 'High afterload and stiff arteries. LV generates higher pressure; the loop grows taller and narrower.',
      params: {
        systemicResistance: 1.55, arterialCompliance: 0.85, lvEes: 3.0, bloodVolume: 5100
      }
    },

    hemorrhage: {
      label: 'Hemorrhage / Hypovolemia',
      group: 'Loading',
      blurb: 'Acute blood loss reduces preload. Loops shrink and shift left, CO and pressures fall, reflex tachycardia.',
      params: {
        bloodVolume: 4350, heartRate: 112, systemicResistance: 1.35, lvEes: 2.7
      }
    },

    aorticStenosis: {
      label: 'Aortic Stenosis',
      group: 'Valves',
      blurb: 'Narrowed aortic valve: large LV–aortic systolic gradient and a tall, square LV loop from concentric hypertrophy.',
      params: {
        aorticStenosis: 0.86, lvEes: 4.5, lvStiffness: 1.6, bloodVolume: 5200
      }
    },

    aorticRegurg: {
      label: 'Aortic Regurgitation',
      group: 'Valves',
      blurb: 'Leaky aortic valve: diastolic backflow into the LV. Wide pulse pressure, large EDV, loss of isovolumic relaxation.',
      params: {
        aorticRegurg: 0.55, bloodVolume: 5400, arterialCompliance: 1.7, lvEes: 2.2
      }
    },

    mitralRegurg: {
      label: 'Mitral Regurgitation',
      group: 'Valves',
      blurb: 'Leaky mitral valve: systolic backflow into the LA. Giant v-wave, volume-overloaded LV, no true isovolumic phase.',
      params: {
        mitralRegurg: 0.52, bloodVolume: 5300, lvEes: 2.1, laStiffness: 1.2
      }
    },

    mitralStenosis: {
      label: 'Mitral Stenosis',
      group: 'Valves',
      blurb: 'Narrowed mitral valve impedes LV filling. High LA pressure, small underfilled LV, reduced CO.',
      params: {
        mitralStenosis: 0.8, bloodVolume: 5400, heartRate: 88, laEes: 0.6
      }
    },

    pulmHypertension: {
      label: 'Pulmonary Hypertension',
      group: 'Loading',
      blurb: 'High pulmonary vascular resistance loads the RV. RV pressure and volume rise; the RV loop enlarges markedly.',
      params: {
        pulmonaryResistance: 0.42, rvEes: 1.9, rvStiffness: 1.4, bloodVolume: 5300
      }
    }
  };

  root.PVLoop = root.PVLoop || {};
  root.PVLoop.presets = presets;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { presets: presets };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
