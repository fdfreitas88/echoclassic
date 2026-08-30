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

test('native DSP controls expose switch and radio state to assistive technology', function () {
  [
    'Automatic response headroom', 'Apply LMS ReplayGain inside DSP',
    'Reserve positive ReplayGain headroom', '4× true-peak protection',
    'True-peak limiter', 'Graphic stage', 'Parametric stage', 'Spatial stage',
    'Mono', 'Convolution stage'
  ].forEach(function (label) {
    assert.match(src, new RegExp('role="switch"[^>]*aria-label="' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"|aria-label="' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*role="switch"'));
  });
  ['DSP owner', 'Crossfeed', 'Polarity'].forEach(function (label) {
    const group = src.slice(src.indexOf('aria-label="' + label + '"'), src.indexOf('aria-label="' + label + '"') + 1800);
    assert.match(group, /role="radio"/);
    assert.match(group, /:aria-checked=/);
    assert.match(group, /radioKey\(/);
  });
});

test('Compare hold is a real keyboard-operable button and always releases bypass', function () {
  const start = src.indexOf('<button v-if="dspOwner === \'squeezedsp\'" type="button" class="eq-hold-button"');
  const row = src.slice(start, start + 1400);
  assert.match(row, /<button[^>]*type="button" class="eq-hold-button"/);
  assert.match(row, /@keydown\.space\.prevent="holdEqualizerBypass\(true\)"/);
  assert.match(row, /@keyup\.space\.prevent="holdEqualizerBypass\(false\)"/);
  assert.match(row, /@blur="holdEqualizerBypass\(false\)"/);
  assert.doesNotMatch(row, /<button[^>]*>[^<]*<button/);
});
