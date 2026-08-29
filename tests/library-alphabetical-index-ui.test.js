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

test('artist artwork grows without changing virtualized row height', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.pane-left \.row\.artistrow \.art\{width:52px;height:52px;flex-basis:52px\}/);
  assert.match(css, /--row-artist:72px/);
});
