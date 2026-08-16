const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('ARTMETA-01: artist-only overlay keeps local navigation authoritative', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  assert.match(detail, /v-if="frame\.kind === 'artist'" class="artist-enrichment"/);
  assert.match(detail, /LmsApi\.musicArtistInfo\(this\.store\.playerId \|\| '', this\.frame\.id, this\.frame\.label\)/);
  assert.match(detail, /kind: 'artist', id: this\.artist\.id, ids: this\.artist\.ids/,
    'canonical LMS artist navigation remains unchanged');
  assert.doesNotMatch(detail, /this\.frame\.(?:id|label)\s*=(?!=)/,
    'the enrichment overlay must not rewrite the canonical frame');
  assert.equal((detail.match(/class="opml-new-label"/g) || []).length, 1,
    'the new feature has exactly one New badge');
});

test('ARTMETA-01: cache is bounded and refuses remote or query-bearing photo URLs', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  assert.match(detail, /ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT = 40/);
  assert.match(detail, /ECHOCLASSIC_ARTIST_INFO_CACHE_TTL = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(detail, /rows\.slice\(0, ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT\)/);
  assert.match(detail, /String\(value\.photoUrl\)\.indexOf\('\?'\) < 0/);
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

test('ARTMETA-01: provenance and user-facing states are translated in EN/PT', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const strings = helpers.read('EchoClassic/strings.txt');
  assert.match(detail, /Provided by MusicArtistInfo from Wikipedia, Last\.fm, Discogs and MusicBrainz\./);
  [
    'Artist information', 'Finding artist information…', 'Install plugin',
    'No artist biography was found.', 'Photo credit', 'Retrieved'
  ].forEach(function (text) {
    assert.ok(strings.indexOf('\tEN\t' + text) >= 0, 'missing EN: ' + text);
  });
  assert.ok(strings.indexOf('\tPT\tInformações do artista') >= 0);
  assert.ok(strings.indexOf('\tPT\tInstalar plugin') >= 0);
});

test('ARTMETA-01: review/remove/refresh and local-versus-connected sections are explicit', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  const album = helpers.read('EchoClassic/HTML/echoclassic/html/js/albumblock.js');
  assert.match(detail, /frame\.id == null && !this\.nameMatchAccepted/);
  assert.match(detail, /Review match: only the artist name is available/);
  assert.match(detail, /Matched by stable local artist identity/);
  assert.match(detail, /localAlbums\.length/);
  assert.match(detail, /Also on connected services/);
  assert.match(detail, /removeEnrichment/);
  assert.match(album, /musicAlbumInfo\(this\.store\.playerId \|\| '', this\.album\.id\)/);
  assert.match(album, /albumInfoStatus === 'removed'.*Find metadata/s);
  assert.match(album, /album-review.*albumReviewExpanded/);
  assert.match(album, /:enrich="a\.id === frame\.id"|if \(this\.enrich\) this\.loadAlbumInfo/);
  assert.match(album, /<strong>\{\{ tr\('Local library'\) \}\}<\/strong>/);
  assert.doesNotMatch(album, /setArtwork|writeTags|discography|externalRelated/);
  assert.match(detail, /retryEnrichment: function \(\) \{ this\.requestToken\+\+;/,
    'refresh must invalidate any older enrichment response');
  assert.match(detail, /removeEnrichment: function \(\) \{\s*this\.requestToken\+\+;/,
    'hide must prevent an in-flight response from restoring the panel');
  assert.match(album, /var token = \+\+this\.albumInfoRequestToken;/);
  assert.match(album, /if \(token !== this\.albumInfoRequestToken\) return;/);
  assert.match(album, /removeAlbumInfo: function \(\) \{\s*this\.albumInfoRequestToken\+\+;/);
  assert.match(album, /Hide for now/);
  assert.match(album, /Reference artwork/);
});
