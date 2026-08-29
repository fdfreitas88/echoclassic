const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function source() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/js/playlists.js');
}

test('playlist editing separates playback, bulk tools, and permanent deletion', function () {
  const text = source();
  assert.match(text, /playlist-primary-actions/);
  assert.match(text, /playlist-edit-bar/);
  assert.match(text, /playlist-danger-zone/);
  assert.match(text, /Remove selected/);
  assert.match(text, /Delete playlist…/);
  assert.doesNotMatch(text, />#<\/button>/, 'the unexplained move-to-position symbol is removed');
});

test('each playlist row has clear reordering, removal, and keyboard controls', function () {
  const text = source();
  assert.match(text, />↑<\/button>/);
  assert.match(text, />↓<\/button>/);
  assert.match(text, />×<\/button>/);
  assert.match(text, /@keydown\.alt\.up\.prevent/);
  assert.match(text, /@keydown\.alt\.down\.prevent/);
  assert.match(text, /@keydown\.delete\.prevent/);
  assert.match(text, /@keydown\.esc\.prevent/);
  assert.match(text, /@keydown\.space\.prevent/);
});

test('single-row removal confirms before calling the LMS playlist API', function () {
  const text = source();
  assert.match(text, /LmsUi\.confirmAction\(\{/);
  assert.match(text, /title: 'Remove “' \+ t\.title \+ '”\?'/);
  assert.match(text, /The song leaves this playlist but remains in your library\./);
  assert.match(text, /editPlaylist\(self\.frame\.id, 'delete', \{ index: t\.index \}\)/);
});
