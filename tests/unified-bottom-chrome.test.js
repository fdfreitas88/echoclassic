const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('bottom chrome owns one shared appearance boundary', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  const mini = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/miniplayer.js');

  assert.equal((app.match(/<footer class="app-footer"/g) || []).length, 1);
  assert.equal((app.match(/<lms-miniplayer/g) || []).length, 1);
  assert.equal((app.match(/<lms-tabbar/g) || []).length, 1);
  assert.match(app, /<footer class="app-footer" v-bind="bottomChromeAttrs">/);
  assert.match(app, /bottomChromeAttrs:\s*function \(\) \{ return LmsUi\.surfaceAttrs\('mini'\); \}/);
  assert.doesNotMatch(mini, /v-bind="surfaceAttrs"|surfaceAttrs:\s*function/,
    'appearance belongs to the persistent footer, not only the mini-player row');
});

test('bottom chrome remains a compact, responsive two-row flex boundary', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.app-header\{display:contents\}/);
  assert.match(css, /\.app-footer\{display:flex;flex:0 0 auto;flex-direction:column;min-width:0\}/);
  assert.doesNotMatch(css, /\.app-header,\.app-footer\{display:contents\}/);
  assert.match(css, /\.mini\{height:var\(--mini\);flex:0 0 auto/);
  assert.match(css, /\.tabbar\{height:var\(--tabbar\);flex:0 0 auto/);
});

test('empty mini-player has one canonical centered rule at every breakpoint', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.equal((css.match(/\.mini\.is-empty,\.mini\.inactive\{height:58px\}/g) || []).length, 1);
  assert.equal((css.match(/\.mini\.is-empty \.np\{/g) || []).length, 1);
  assert.match(css, /\.mini\.is-empty \.np\{[^}]*position:relative;inset:auto;[^}]*align-items:center/);
  assert.match(css, /\.mini\.is-empty \.np \.t\{font-size:13px;line-height:16px;color:var\(--text2\)\}/);
});

test('Bottom bar settings explain that appearance also covers navigation tabs', function () {
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  const strings = helpers.read('EchoClassic/strings.txt');
  const phrase = 'Applies to the mini-player and navigation tabs.';

  assert.match(settings, /\{\{ tr\('Applies to the mini-player and navigation tabs\.'\) \}\}/);
  const at = strings.indexOf('\tEN\t' + phrase + '\n');
  assert.ok(at > 0, 'missing English translation');
  const block = strings.slice(at, at + 360);
  ['DE', 'FR', 'PT'].forEach(function (language) {
    assert.match(block, new RegExp('\\n\\t' + language + '\\t\\S'));
  });
});
