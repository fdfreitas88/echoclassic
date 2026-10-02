const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('navbar theme button is a two-state light/dark switch and never enters legacy', function () {
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  const navbar = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/navbar.js');
  assert.match(ui, /var next = state\.theme === 'light' \? 'dark' : 'light';/);
  assert.doesNotMatch(ui, /'dark' \? 'legacy'/);
  assert.doesNotMatch(navbar, /Legacy theme/);
  assert.match(navbar, /themeTitle: function \(\) \{\s*return this\.ui\.theme === 'light' \? 'Dark theme' : 'Light theme';/);
  assert.match(navbar, /<template v-if="ui\.theme !== 'light'">/);
});

test('empty mini bar centres the Nothing playing label instead of pinning it to the divider', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.mini\.is-empty \.np\{[^}]*align-items:center[^}]*\}/);
  assert.doesNotMatch(css, /\.mini\.is-empty \.np\{[^}]*flex-start/);
  assert.doesNotMatch(css, /\.mini\.is-empty \.np\{[^}]*padding-top:12px/);
  assert.match(css, /\.mini\.is-empty \.np \.t\{font-size:13px[^}]*color:var\(--text2\)\}/);
});

test('release type rows show a localized label and keep the raw token for the filter', function () {
  const browse = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const strings = helpers.read('EchoClassic/strings.txt');
  assert.match(browse, /kind: 'releasetype', id: x\.id, value: x\.name,\s*label: labelOf\(x\.name\)/);
  assert.match(detail, /filter\.releaseType = f\.value \|\| f\.label;/);
  const map = browse.match(/window\.LmsReleaseTypeLabels = Object\.freeze\(\{([\s\S]*?)\}\);/)[1];
  const labels = [...map.matchAll(/'([^']+)'/g)].map(function (m) { return m[1]; });
  assert.ok(labels.indexOf('Best of') >= 0 && labels.indexOf('Box set') >= 0);
  labels.forEach(function (label) {
    assert.ok(strings.indexOf('\tEN\t' + label + '\n') >= 0, 'strings.txt lacks EN key for ' + label);
  });
  // sentence-case fallback for unknown tokens
  const fn = browse.match(/releaseTypeLabel: function \(raw\) \{([\s\S]*?)\n    \},/)[1];
  const impl = new Function('raw', 'LmsReleaseTypeLabels', 'window', fn);
  assert.equal(impl('BESTOF', { BESTOF: 'Best of' }, {}), 'Best of');
  assert.equal(impl('SPOKENWORD', {}, {}), 'Spokenword');
});
