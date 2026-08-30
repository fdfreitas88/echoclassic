const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('alphabetical rail fits the full alphabet and highlights one letter only', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.rail\{[^}]*grid-template-rows:repeat\(27,minmax\(0,1fr\)\)/);
  assert.match(css, /\.rail span\{[^}]*min-height:0/);
  assert.match(css, /\.rail span\.active\{[^}]*background:var\(--accent\)/);
  assert.doesNotMatch(css, /\.rail span\.active,\.rail span:active/,
    'pressing an adjacent letter must not create a second highlighted state');
});

test('touch scrubbing maps the whole rail instead of requiring a tiny letter hit', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const body = src.split('scrubRail: function (e)')[1].split('\n    },')[0];
  assert.match(body, /getBoundingClientRect/);
  assert.match(body, /touch\.clientY - rect\.top/);
  assert.match(body, /this\.RAIL\[Math\.floor/);
  assert.doesNotMatch(body, /elementFromPoint/);
});

test('alphabetic index capability is shared by name-sorted My Music roots without reserving an empty gutter', function () {
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  const browse = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  ['artists','albumartists','composers','conductors','ensembles','works','albums','genres','musicfolders','releasetypes'].forEach(function (key) {
    assert.match(ui, new RegExp("key: '" + key + "', label: '[^']+', alphabeticIndex: true"), key + ' uses the shared A–Z capability');
  });
  assert.match(ui, /key: 'years', label: 'Years' \}/, 'Years deliberately has no alphabet capability');
  assert.match(browse, /this\.viewUsesAlphabeticIndex/);
  assert.match(browse, /this\.rows\.length > 0/, 'Music Folder keeps A–Z even when it has fewer than 30 visible entries');
  assert.doesNotMatch(browse, /this\.view === 'artists' \|\| this\.view === 'albums' \|\| this\.view === 'recent'/);
  assert.match(browse, /class="pane-left" :class="\{'no-rail':!hasRail\}"/);
  assert.match(css, /\.pane-left\.no-rail\{grid-template-columns:minmax\(0,1fr\) 0\}/);
});

test('artist artwork grows without changing virtualized row height', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.pane-left \.row\.artistrow \.art\{width:52px;height:52px;flex-basis:52px\}/);
  assert.match(css, /--row-artist:72px/);
});
