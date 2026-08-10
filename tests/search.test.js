const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function apiWithResponses() {
  const calls = [];
  const ctx = helpers.browserContext({
    AbortController: function () {
      this.signal = {};
      this.abort = function () {};
    },
    fetch: function (url, opts) {
      const payload = JSON.parse(opts.body);
      const player = payload.params[0];
      const cmd = payload.params[1];
      calls.push(cmd.slice());
      let result = {};

      if (cmd[0] === 'search') {
        result = {
          contributors_loop: [
            { contributor_id: 10, contributor: 'Acqua Fragile' }
          ],
          albums_loop: [
            { album_id: 1246, album: 'Acqua Fragile', artwork: 'art-a' }
          ],
          tracks_loop: [
            { track_id: 1, track: 'Water line' },
            { track_id: 2, track: 'Acqua' },
            { track_id: 3, track: "Musica sull'acqua" }
          ]
        };
      } else if (cmd[0] === 'playlists') {
        result = { playlists_loop: [] };
      } else if (cmd[0] === 'albums' && String(cmd[3]) === 'album_id:1246') {
        result = { albums_loop: [{ id: 1246, album: 'Acqua Fragile', artist: 'Acqua Fragile', year: 1973, artwork_track_id: 456 }] };
      } else if (cmd[0] === 'songinfo') {
        const id = String(cmd[3]).replace('track_id:', '');
        const info = {
          '1': { id: 1, title: 'Water line', artist: 'Other Artist', album: 'Acqua Collection', duration: 111, url: 'file:///one.flac', album_id: 91 },
          '2': { id: 2, title: 'Acqua', artist: 'Exact Artist', album: 'Exact Album', duration: 222, url: 'file:///two.flac', album_id: 92 },
          '3': { id: 3, title: "Musica sull'acqua", artist: 'Composer', album: 'Water Music', duration: 333, url: 'file:///three.flac', album_id: 93 }
        }[id];
        result = { songinfo_loop: [info] };
      }

      return Promise.resolve({
        ok: true,
        json: function () { return Promise.resolve({ result: result }); }
      });
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/format.js');
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/api.js');
  return { api: ctx.LmsApi, calls: calls };
}

test('search ranks exact matches first and enriches album and track context', async function () {
  const harness = apiWithResponses();
  const found = await harness.api.search('player', 'Acqua', 50);

  assert.equal(found.artists[0].name, 'Acqua Fragile');
  assert.equal(found.albums[0].artist, 'Acqua Fragile');
  assert.equal(found.albums[0].year, 1973);
  assert.equal(found.albums[0].artworkTrackId, 456);
  assert.equal(found.tracks[0].title, 'Acqua');
  assert.equal(found.tracks[0].artist, 'Exact Artist');
  assert.equal(found.tracks[0].album, 'Exact Album');
  assert.equal(found.tracks[0].duration, 222);
  assert.equal(found.tracks[0].source, 'Local library');
  assert.ok(harness.calls.some(function (cmd) { return cmd[0] === 'songinfo'; }));
  assert.ok(harness.calls.some(function (cmd) {
    return cmd[0] === 'albums' && cmd.indexOf('tags:jlay') >= 0;
  }));
});
