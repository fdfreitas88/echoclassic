const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function src() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
}

test('Settings home exposes the chosen shortcuts and keeps structural destinations fixed', function () {
  const text = src();
  assert.match(text, /v-for="key in ui\.frequentSettings"/);
  assert.match(text, /Edit frequent settings/);
  ['Player settings', 'Playback settings', 'Equalizer settings', 'Appearance', 'Queue', 'Interface &amp; access', 'Backup', 'About'].forEach(function (label) {
    assert.match(text, new RegExp(label));
  });
});

test('eligible submenu controls expose contextual Add or Remove actions', function () {
  const text = src();
  ['volumeStep', 'stopAtEnd', 'crossfade', 'replayGain', 'sleepTimer', 'theme', 'accentColor', 'queueArtwork', 'showBadges', 'markHires'].forEach(function (key) {
    assert.match(text, new RegExp("frequentActionLabel\\('" + key + "'\\)"), key);
  });
  assert.match(text, /Add to frequent settings/);
  assert.match(text, /Remove from frequent settings/);
});

test('frequent setting methods add, remove, reorder and reset through the persisted UI state', function () {
  const instance = helpers.settingsInstance();
  const self = instance.self;
  self.ui.frequentSettings = ['equalizer', 'crossfade'];

  self.addFrequent('theme');
  assert.deepEqual(Array.from(self.ui.frequentSettings), ['equalizer', 'crossfade', 'theme']);
  self.moveFrequent(2, -1);
  assert.deepEqual(Array.from(self.ui.frequentSettings), ['equalizer', 'theme', 'crossfade']);
  self.removeFrequent('equalizer');
  assert.deepEqual(Array.from(self.ui.frequentSettings), ['theme', 'crossfade']);
  self.resetFrequent();
  assert.deepEqual(Array.from(self.ui.frequentSettings), ['equalizer', 'soundPreset', 'crossfade', 'replayGain', 'sleepTimer']);
});
