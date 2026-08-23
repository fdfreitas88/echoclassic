const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const src = fs.readFileSync('EchoClassic/HTML/echoclassic/html/js/settings.js', 'utf8');

test('advanced equalizer exposes every SqueezeDSP control represented by the current settings document', function () {
  [
    'Q factor', 'Balance', 'Stereo width', 'Delay', 'Loudness',
    'ReplayGain in DSP', 'Headphone crossfeed', 'Room correction impulse',
    'Impulse strength', 'Low shelf / Dynamic bass',
    'High shelf / Treble enhance', 'Low pass', 'High pass', 'Notch'
  ].forEach(function (label) { assert.match(src, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); });
});

test('advanced equalizer supports complete preset lifecycle and staged full reset', function () {
  ['saveEqualizerPreset', 'deleteEqualizerPreset', 'resetEqualizerAll',
   'squeezeDspSavePreset', 'squeezeDspDeletePreset', 'equalizerPresetDisplayName',
   'equalizerSelectedServerPreset'].forEach(function (token) {
    assert.match(src, new RegExp(token));
  });
  assert.match(src, /Reset all DSP settings/);
  assert.match(src, /Delete equalizer preset/);
});

test('fresh and legacy SqueezeDSP documents receive UI-safe nested defaults without dropping the original document', function () {
  assert.match(src, /draft = JSON\.parse\(JSON\.stringify\(settings \|\| \{ Client: \{\} \}\)\)/);
  ['Delay', 'Loudness', 'ReplayGain', 'Filters', 'FIRWavFile', 'FIRStrength', 'Crossfeed'].forEach(function (field) {
    assert.match(src, new RegExp('client\\.' + field));
  });
});
