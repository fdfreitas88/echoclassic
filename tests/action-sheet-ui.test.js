const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function source() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
}

test('action sheet groups playback, library, and information actions', function () {
  const text = source();
  assert.match(text, /class="action-play-group"/);
  assert.match(text, /class="action-sheet-group"/);
  assert.match(text, /class="action-sheet-group action-info-group"/);
  assert.match(text, /class="action-sheet-art"/);
});

test('playlist choice is a separate searchable view with explicit back navigation', function () {
  const text = source();
  assert.match(text, /view === 'playlists'/);
  assert.match(text, /placeholder="Search playlists"/);
  assert.match(text, /openPlaylists: function \(\) \{ this\.view = 'playlists'; \}/);
  assert.match(text, /backToActions: function \(\) \{ this\.view = 'actions';/);
  assert.doesNotMatch(text, /showPlaylists/);
});

test('playlist choice remembers recent destinations and Escape returns before closing', function () {
  const text = source();
  assert.match(text, /echoRecentPlaylists/);
  assert.match(text, /if \(this\.view === 'playlists'\) this\.backToActions\(\)/);
  assert.match(text, /recentPlaylists/);
});

test('modal action sheets support swipe-down dismissal without changing anchored menus', function () {
  const text = source();
  assert.match(text, /v-if="!anchor" class="action-sheet-handle"/);
  assert.match(text, /@pointerdown="startSwipe"/);
  assert.match(text, /if \(this\.anchor \|\| event\.button > 0\) return/);
  assert.match(text, /var dismiss = this\.swipeOffset >= 90/);
  assert.match(text, /if \(dismiss\) this\.close\(\)/);
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.action-sheet:not\(\.anchored\)\.swiping\{transition:none;touch-action:none\}/);
});
