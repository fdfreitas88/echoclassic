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
  assert.match(album, /playAlbum: function \(\) \{[\s\S]*?return LmsStore\.playContainer\('album_id', this\.album\.id, 0\);/);
  assert.doesNotMatch(album, /class="shufflerow/);
});

test('album tools remain visible, grouped, and touch sized', function () {
  assert.match(album, /class="album-primary-actions"/);
  assert.match(album, /tr\('Album information'\)/);
  assert.match(album, /class="album-config-cog"/);
  assert.match(album, /class="album-equalizer-command" @click="openAlbumEqualizer"/);
  assert.match(css, /\.album-primary-actions button\{[^}]*min-height:44px/);
  assert.match(css, /\.album-summary-inline button,\.album-config-cog\{[^}]*min-height:44px/);
  assert.match(css, /\.album-enrichment \.album-config-cog\{float:none/);
});

test('SACD album detail exposes every cache state, action transition, degrade line and ready marker', function () {
  assert.match(album, /\.iso#\(2ch\|mch\)-\\d\{2,3\}\$\/i/);
  ['Cached','Preparing…','Not cached','Partially cached','Extraction failed','Prepare album','Remove from cache','SACD cache status requires the SACDPlayer plugin'].forEach(function (label) {
    assert.match(album, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(album, /v-if="isSacdAlbum" class="sacd-cache-line"/);
  assert.match(album, /v-if="sacdTrackReady\(t\)" class="sacd-track-ready"/);
  assert.match(album, /if\(!this\.isSacdAlbum\)return/);
  assert.match(album, /setTimeout\(function\(\)\{self\.loadSacdCache\(\);\},5000\)/);
});
