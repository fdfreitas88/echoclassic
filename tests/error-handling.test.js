const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('guarded Equalizer failures stop dependent success paths', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /var saved = await LmsStore\.saveEqualizer[\s\S]*?if \(saved === false\) return;/);
  assert.match(settings, /var removed = await LmsStore\.removeEqualizerRule\(ruleId\);\s*if \(removed === false\) return;/);
});

test('Equalizer comparison never silently loses its restore snapshot', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.doesNotMatch(settings, /squeezeDspSave\([^\n]+\.catch\(function \(\) \{\}\)/);
  assert.match(settings, /Could not start equalizer comparison\./);
  assert.match(settings, /Could not restore equalizer processing\./);
  assert.match(settings, /await LmsStore\.refreshEqualizer\(true\)/);
});

test('settings import requires a backup and rolls back failed writes before reload', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(settings, /var snapshot = this\.backupCurrentSettings\(\);\s*if \(!snapshot\) return;/);
  assert.match(settings, /Could not import preferences; previous values were restored\./);
  assert.match(settings, /localStorage\.removeItem\(key\)/);
  assert.match(settings, /catch \(rollbackError\)/);
});

test('authoritative API reads propagate errors instead of inventing empty data', function () {
  const api = helpers.read('EchoClassic/HTML/echoclassic/html/js/api.js');
  const libraries = api.match(/async function libraries[\s\S]*?\n  \}/)[0];
  const folders = api.match(/async function musicFolders[\s\S]*?\n  \}/)[0];
  assert.doesNotMatch(libraries, /catch/);
  assert.doesNotMatch(folders, /catch/);
});

test('background failures retain diagnostics or explicit UI error state', function () {
  const store = helpers.read('EchoClassic/HTML/echoclassic/html/js/store.js');
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const actions = helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
  const album = helpers.read('EchoClassic/HTML/echoclassic/html/js/albumblock.js');
  assert.match(store, /auxiliaryErrors: \{ queue:'', playerSettings:'', sync:'', trackInfo:'', playbackIntelligence:'' \}/);
  assert.match(store, /function backgroundError/);
  assert.match(settings, /telemetryError/);
  assert.match(actions, /playlistError/);
  assert.match(actions, /favoriteError/);
  assert.match(album, /relatedError/);
});
