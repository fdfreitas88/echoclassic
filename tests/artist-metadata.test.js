const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('ARTMETA-01: artist-only overlay keeps local navigation authoritative', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  assert.match(detail, /v-if="frame\.kind === 'artist'" class="artist-detail-compact"/);
  assert.match(detail, /LmsApi\.musicArtistInfo\(this\.store\.playerId \|\| '', this\.frame\.id, this\.frame\.label\)/);
  assert.match(detail, /kind: 'artist', id: this\.artist\.id, ids: this\.artist\.ids/,
    'canonical LMS artist navigation remains unchanged');
  assert.doesNotMatch(detail, /this\.frame\.(?:id|label)\s*=(?!=)/,
    'the enrichment overlay must not rewrite the canonical frame');
  assert.doesNotMatch(detail, /class="opml-new-label"/,
    'the restored Artist information card does not carry the rejected New badge');
});

test('artist detail defaults to a compact sidecar with small controls and responsive alternatives', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const ui = helpers.read('EchoClassic/HTML/echoclassic/html/js/ui.js');
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(detail, /artist-layout-'\+ui\.artistDetailLayout/);
  assert.match(detail, /artist-controls-'\+ui\.artistDetailControls/);
  assert.match(detail, /class="artist-compact-controls"/);
  assert.match(css, /\.artist-detail-compact\{display:grid;grid-template-columns:/);
  assert.match(css, /\.artist-compact-photo\{[^}]*width:44px;height:44px/);
  assert.match(css, /\.artist-compact-controls button\{[^}]*min-height:38px/);
  assert.match(ui, /artistDetailLayout: saved\.artistDetailLayout === 'under' \? 'under' : 'sidecar'/);
  assert.match(ui, /artistDetailControls: saved\.artistDetailControls === 'icons' \? 'icons' : 'buttons'/);
  assert.match(settings, /Artist detail <span class="opml-new-label settings-new-label">NEW<\/span>/);
  assert.match(detail, /Read biography/);
  assert.match(detail, /class="artist-enrichment-links"/);
});

test('artist primary album opens Equalizer with album rule context on the Settings tab', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const method = detail.match(/openPrimaryEqualizer: function \(\) \{[\s\S]*?\n    \},/);
  assert.ok(method, 'openPrimaryEqualizer method is present');
  assert.match(method[0], /type: 'album', albumKey: String\(this\.primaryAlbum\.id\), albumTitle: this\.primaryAlbum\.title \|\| ''/);
  assert.match(method[0], /artist: this\.primaryAlbum\.artist \|\| '', artistLabel: this\.primaryAlbum\.artist \|\| ''/);
  assert.match(method[0], /year: this\.primaryAlbum\.originalYear \|\| this\.primaryAlbum\.year \|\| ''/);
  assert.match(method[0], /LmsUi\.setTab\('settings'\);[\s\S]*LmsNav\.push\('settings', \{ label:'Equalizer', screen:'equalizer' \}\)/,
    'the Settings tab must be active before its Equalizer frame is pushed');
  assert.doesNotMatch(method[0], /\bkey:String|\bvalue:|\blabel:this\.primaryAlbum/,
    'generic context fields cannot substitute for the album rule schema');
});

test('ARTMETA-01: artist cache is persistent, bounded and refuses remote or query-bearing photo URLs', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  assert.match(detail, /ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT = 40/);
  assert.doesNotMatch(detail, /ARTIST_INFO_CACHE_TTL|now - Number\(item\.retrievedAt/,
    'cached artist information must remain until an explicit refresh');
  assert.match(detail, /rows\.slice\(0, ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT\)/);
  assert.match(detail, /String\(value\.photoUrl\)\.indexOf\('\?'\) < 0/);
  assert.doesNotMatch(detail, /removeEnrichment:[\s\S]*?localStorage\.setItem[\s\S]*?enrichmentStatus = 'removed'/,
    'Hide for now must not discard the persistent artist cache');
});

test('ARTMETA-01: album information is loaded once and refreshed only on request', function () {
  const album = helpers.read('EchoClassic/HTML/echoclassic/html/js/albumblock.js');
  assert.match(album, /ECHOCLASSIC_ALBUM_INFO_CACHE_KEY = 'echoclassic\.album-info\.v1'/);
  assert.match(album, /ECHOCLASSIC_ALBUM_INFO_CACHE_LIMIT = 60/);
  assert.match(album, /albumInfoCacheGet: function/);
  assert.match(album, /var cached = !force && this\.albumInfoCacheGet\(\)/);
  assert.match(album, /this\.albumInfoCachePut\(this\.albumInfo\)/);
  assert.match(album, /rows\.slice\(0, ECHOCLASSIC_ALBUM_INFO_CACHE_LIMIT\)/);
  assert.match(album, /@click="loadAlbumInfo\(true\)"[^>]*>\{\{ tr\('Refresh'\) \}\}/);
  assert.match(album, /created: function \(\) \{ this\.load\(\); if \(this\.enrich\) this\.loadAlbumInfo\(\); \}/,
    'automatic album loads must consult the cache instead of forcing a request');
});

test('ARTMETA-01: unavailable plugin hands off to the native filtered plugin manager', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const album = helpers.read('EchoClassic/HTML/echoclassic/html/js/albumblock.js');
  const settings = helpers.read('EchoClassic/HTML/echoclassic/html/js/settings.js');
  assert.match(detail, />\{\{ tr\('Install plugin'\) \}\}<\/button>/);
  assert.doesNotMatch(detail, /github\.com|View on GitHub/i);
  assert.match(detail, /echoclassic\.plugin-search\.v1', 'MusicArtistInfo'/);
  assert.match(detail, /advancedSettingsPage = '\/echoclassic\/settings\/server\/plugins\.html'/);
  assert.match(album, /v-else-if="albumInfoStatus === 'unavailable'"/);
  assert.match(album, /Album information requires MusicArtistInfo\./);
  assert.match(album, /openPluginManager/);
  assert.match(settings, /search\.value = requested/);
  assert.match(settings, /menu\.setAttribute\('data-ec-plugin-filter', 'all'\)/);
});

test('ARTMETA-01: original Artist information surface and states are translated in EN/PT', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const strings = helpers.read('EchoClassic/strings.txt');
  assert.doesNotMatch(detail, /Provided by MusicArtistInfo from Wikipedia, Last\.fm, Discogs and MusicBrainz\./);
  [
    'Artist information', 'Finding artist information…', 'Install plugin',
    'No artist biography was found.', 'Read biography', 'Refresh', 'Hide for now'
  ].forEach(function (text) {
    assert.ok(strings.indexOf('\tEN\t' + text) >= 0, 'missing EN: ' + text);
  });
  assert.ok(strings.indexOf('\tPT\tInformações do artista') >= 0);
  assert.ok(strings.indexOf('\tPT\tInstalar plugin') >= 0);
});

test('ARTMETA-01: progressive album information and refresh are explicit', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const album = helpers.read('EchoClassic/HTML/echoclassic/html/js/albumblock.js');
  assert.match(detail, /frame\.id == null && !this\.nameMatchAccepted/);
  assert.match(detail, /Review match: only the artist name is available/);
  assert.doesNotMatch(detail, /Matched by stable local artist identity/);
  assert.match(detail, /localAlbums\.length/);
  assert.match(detail, /Also on connected services/);
  assert.match(detail, /removeEnrichment/);
  assert.match(album, /musicAlbumInfo\(this\.store\.playerId \|\| '', this\.album\.id\)/);
  assert.match(album, /albumInfoStatus && albumInfoVisible/);
  assert.match(album, /tr\('Album information'\)/);
  assert.match(album, /tr\(albumInfoVisible \? 'Hide' : 'Show'\)/);
  assert.match(album, /albumReviewExpanded \? 'Show less' : 'Show more'/);
  assert.match(album, /album-review" :class="\{expanded: albumReviewExpanded\}"/);
  assert.match(helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css'),
    /\.album-review\{[^}]*-webkit-line-clamp:3\}/,
    'opening album information must reveal a three-line review preview');
  assert.match(helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css'),
    /\.album-enrichment \.retry-command\{margin:4px 0;[^}]*text-align:left\}/,
    'album information disclosures must stay left aligned');
  assert.match(album, /albumSourceVisible \? 'Hide source' : 'Show source'/);
  assert.match(album, /v-if="albumSourceVisible" class="artist-enrichment-source"/);
  assert.match(album, /:enrich="a\.id === frame\.id"|if \(this\.enrich\) this\.loadAlbumInfo/);
  assert.match(album, /<strong>\{\{ tr\('Local library'\) \}\}<\/strong>/);
  assert.doesNotMatch(album, /setArtwork|writeTags|discography|externalRelated/);
  assert.match(detail, /retryEnrichment: function \(\) \{ this\.requestToken\+\+;/,
    'refresh must invalidate any older enrichment response');
  assert.match(detail, /removeEnrichment: function \(\) \{\s*this\.requestToken\+\+;/,
    'hide must prevent an in-flight response from restoring the panel');
  assert.match(album, /var token = \+\+this\.albumInfoRequestToken;/);
  assert.match(album, /if \(token !== this\.albumInfoRequestToken\) return;/);
  assert.match(album, /Reference artwork/);
});
