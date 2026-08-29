const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('compact navigation exposes five primary destinations and groups Apps and Settings under More', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/tabbar.js');
  assert.match(src, /\['favourites', 'radio', 'playlists', 'music', 'more'\]/);
  assert.match(src, /ui\.tab === 'apps' \|\| this\.ui\.tab === 'settings'/);
  assert.match(src, /Vue\.component\('lms-more'/);
  assert.match(src, />Apps<small>Music services and plugins<\/small>/);
  assert.match(src, />Settings<small>Player, appearance and server<\/small>/);
  assert.match(src, />Server information<small>LMS/);
});

test('wide navigation restores all six direct destinations without More', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/tabbar.js');
  assert.match(src, /if \(!this\.compact\) return this\.tabs\.filter\(function \(tab\) \{ return tab\.key !== 'more'; \}\)/);
  assert.match(src, /if \(!this\.compact && this\.ui\.tab === 'more'\) LmsUi\.setTab\('music'\)/);
});

test('reselecting an active tab returns its navigation stack and scroller to the root', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/tabbar.js');
  assert.match(src, /if \(key === this\.ui\.tab\)[\s\S]*LmsNav\.reset\(key\)[\s\S]*scroller\.scrollTop = 0/);
});

test('global chrome uses safe areas and navbar title occupies a real middle grid column', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /--safe-top:env\(safe-area-inset-top,0px\)/);
  assert.match(css, /--safe-bottom:env\(safe-area-inset-bottom,0px\)/);
  assert.match(css, /\.navbar\{[^}]*display:grid;grid-template-columns:minmax\(44px,1fr\) minmax\(0,2fr\) minmax\(44px,1fr\)/);
  assert.doesNotMatch(css, /\.navbar \.center\{position:absolute/);
  assert.match(css, /\.tabbar\{[^}]*padding-bottom:var\(--safe-bottom\)/);
});
