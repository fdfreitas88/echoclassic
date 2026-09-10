const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const album = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/js/albumblock.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/css/ios9.css'), 'utf8');
const sacdLogo = path.join(root, 'EchoClassic/HTML/echoclassic/html/images/SACDlogo.svg');

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
  assert.doesNotMatch(album, /class="album-config-cog"[\s\S]*?<span>\{\{ tr\('Display'\) \}\}<\/span>/,
    'the approved compact Display control has no visible text label');
  assert.match(album, /class="album-equalizer-command" @click="openAlbumEqualizer"/);
  assert.match(css, /\.album-primary-actions button\{[^}]*min-height:44px/);
  assert.match(css, /\.album-config-cog\{[^}]*min-height:44px/);
  assert.match(css, /\.album-enrichment \.album-config-cog\{float:none/);
});

test('album detail places the display sliders at the metadata panel top-right', function () {
  assert.match(album, /<div class="albummeta">[\s\S]*?class="album-display-tool"[\s\S]*?class="display-sliders-icon"/);
  assert.match(album, /<path d="M4 6h16M4 12h16M4 18h16"\/>/);
  assert.match(css, /\.album-detail-approved \.reviewed-albumhead \.album-display-tool\{position:absolute;top:-5px;right:0;width:48px;margin-top:0;justify-content:flex-end\}/);
  assert.match(css, /\.album-detail-approved \.reviewed-albumhead \.album-config-cog\{border:0;background:transparent;border-radius:0\}/);
  assert.match(css, /\.album-detail-approved \.reviewed-albumhead \.albummeta\{position:relative;grid-column:2;grid-row:2;padding:0 48px 0 0\}/);
  assert.match(css, /@media\(max-width:700px\)\{[\s\S]*?\.album-detail-approved \.reviewed-albumhead \.album-display-tool\{top:-5px;right:0;width:48px\}/);
});

test('album detail keeps More immediately after one truncated information line', function () {
  assert.match(album, /tr\(albumInfoVisible \? 'Less' : 'More'\)/);
  assert.match(css, /\.album-detail-approved \.album-summary-inline\{display:flex;align-items:baseline;min-width:0/);
  assert.match(css, /\.album-detail-approved \.album-summary-inline>span\{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/);
  assert.match(css, /\.album-detail-approved \.album-summary-inline \.album-summary-more\{flex:0 0 auto;margin-left:4px\}/);
});

test('SACD album detail exposes every preparation state, action transition, plugin path and ready marker', function () {
  assert.match(album, /\.iso#\(2ch\|mch\)-\\d\{2,3\}\$\/i/);
  ['Cached','Preparing…','Not cached','Partially cached','Extraction failed','Prepare album','Remove from cache','SACD cache status requires the SACDPlayer plugin'].forEach(function (label) {
    assert.match(album, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(album, /v-if="isSacdAlbum" ref="sacdControl" class="sacd-album-unit"/);
  assert.match(album, /class="sacd-install-command" @click="openSacdPluginManager"/);
  assert.match(album, /class="sacd-control-menu" role="menu"/);
  assert.match(album, /role="progressbar"/);
  assert.match(album, /sacdProgressPercent/);
  assert.match(album, /v-if="sacdTrackReady\(t\)" class="sacd-track-ready"/);
  assert.match(album, /if \(!this\.isSacdAlbum\) return;/);
  assert.match(album, /setTimeout\(function\(\)\{self\.loadSacdCache\(\);\},5000\)/);
});

test('SACD album detail uses the approved responsive logo slot', function () {
  assert.equal(fs.existsSync(sacdLogo), true);
  assert.match(album, /class="sacd-media-logo sacd-media-logo-detail"/);
  assert.match(album, /src="html\/images\/SACDlogo\.svg"/);
  assert.match(css, /\.sacd-album-unit\{position:relative;display:flex;align-items:center/);
  assert.match(css, /\.sacd-media-logo-detail\{width:clamp\(/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.sacd-album-unit\{align-items:flex-start;flex-direction:column/);
});
