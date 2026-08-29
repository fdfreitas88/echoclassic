const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const album = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/js/albumblock.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/css/ios9.css'), 'utf8');

test('album detail exposes direct Play and Shuffle actions', function () {
  assert.match(album, /class="album-primary-actions"/);
  assert.match(album, /class="album-play-command" @click="playAlbum"/);
  assert.match(album, /class="album-shuffle-command" @click="shuffle"/);
  assert.match(album, /playAlbum: function \(\) \{\s*return LmsStore\.playContainer\('album_id', this\.album\.id, 0\);/);
  assert.doesNotMatch(album, /class="shufflerow/);
});

test('album tools remain visible, grouped, and touch sized', function () {
  assert.match(album, /class="album-secondary-tools"/);
  assert.match(album, /tr\('Album information'\)/);
  assert.match(album, /albumEqualizerRule \? tr\('custom'\) : tr\('Default'\)/);
  assert.match(css, /\.album-primary-actions button\{[^}]*min-height:44px/);
  assert.match(css, /\.album-info-disclosure\{[^}]*min-height:44px/);
  assert.match(css, /\.album-equalizer-disclosure\{[^}]*min-height:44px/);
});
