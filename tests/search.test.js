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
          works_loop: [
            { work_id: 88, work: 'Acqua suite', composer: 'Luciano Basso', composer_id: 44 }
          ],
          tracks_loop: [
            { track_id: 1, track: 'Water line' },
            { track_id: 2, track: 'Acqua' },
            { track_id: 3, track: "Musica sull'acqua" }
          ]
        };
      } else if (cmd[0] === 'playlists') {
        result = { playlists_loop: [] };
      } else if (cmd[0] === 'libraries') {
        result = { libraries_loop: [{ id: 'classical', name: 'Classical' }] };
      } else if (cmd[0] === 'musicfolder') {
        result = { folder_loop: [{ id: 90, filename: 'Archive', path: '/Music/Archive' }] };
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
  assert.equal(found.works[0].title, 'Acqua suite');
  assert.equal(found.works[0].composer, 'Luciano Basso');
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

test('advanced search carries the selected virtual library to LMS', async function () {
  const harness = apiWithResponses();
  harness.api.setLibrary('classical');
  await harness.api.search('player', 'Acqua', 50);
  const searchCall = harness.calls.find(function (cmd) { return cmd[0] === 'search'; });
  assert.ok(searchCall.indexOf('library_id:classical') >= 0);
});

test('library roots combine all music, virtual libraries and top-level music folders', async function () {
  const harness = apiWithResponses();
  const roots = await harness.api.libraryRoots('player');
  assert.deepEqual(JSON.parse(JSON.stringify(roots.map(function (root) { return root.key; }))),
    ['all', 'library:classical', 'folder:90']);
});

test('multi-root search isolates each LMS query and preserves result provenance', async function () {
  const harness = apiWithResponses();
  const found = await harness.api.searchRoots('player', 'Acqua', 50, [
    { type: 'library', id: 'classical', key: 'library:classical', name: 'Classical' },
    { type: 'folder', id: '90', key: 'folder:90', name: 'Archive' }
  ]);
  assert.ok(harness.calls.some(function (cmd) { return cmd[0] === 'search' && cmd.indexOf('library_id:classical') >= 0; }));
  assert.ok(harness.calls.some(function (cmd) { return cmd[0] === 'search' && cmd.indexOf('folder_id:90') >= 0; }));
  assert.deepEqual(JSON.parse(JSON.stringify(found.works.map(function (work) { return work.rootName; }))), ['Classical', 'Archive']);
});

/* NAV-01: the search had no navigation frame of its own. Searching for
   `Beatles` gave 2 artists and 5 albums; opening `The Beatles` closed the
   search and wiped the query, and `Back to Artists` landed on the Artists root
   with no term, no results and no scroll -- seeing the same result again cost
   typing the whole thing over.

   The suspended search now lives in LmsUi, which outlives the component, and
   the frame pushed for the result carries the mark Back reads. */

const SEARCH = 'EchoClassic/HTML/echoclassic/html/js/search.js';

function searchInstance(extra) {
  let definition = null;
  const pushed = [];
  const searches = [];
  const ctx = helpers.uiContext(Object.assign({
    document: {
      addEventListener: function () {},
      removeEventListener: function () {},
      querySelector: function () { return null; },
      activeElement: null,
      documentElement: {
        style: { setProperty: function () {} },
        classList: { add: function () {}, remove: function () {}, toggle: function () {} }
      },
      body: {
        setAttribute: function () {}, removeAttribute: function () {},
        classList: { add: function () {}, remove: function () {}, toggle: function () {} }
      }
    },
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    },
    LmsApi: {
      search: async function (player, query, limit) {
        searches.push([query, limit]);
        return { artists: [{ id: 1, name: 'The Beatles' }], albums: [], tracks: [], playlists: [] };
      }
    },
    LmsStore: { state: { playerId: 'p1' }, friendlyError: function (e, f) { return f; } },
    LmsNav: {
      reset: function () {},
      push: function (tab, frame) { pushed.push([tab, frame]); },
      top: function () { return null; }
    }
  }, extra || {}));
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/format.js');
  helpers.runInContext(ctx, SEARCH);

  function mount(el) {
    const self = definition.data();
    self.$nextTick = function (f) { if (f) f.call(self); };
    self.$el = el || { scrollTop: 0 };
    self.$refs = {};
    Object.keys(definition.methods).forEach(function (name) {
      self[name] = definition.methods[name].bind(self);
    });
    Object.keys(definition.computed).forEach(function (name) {
      Object.defineProperty(self, name, { get: definition.computed[name].bind(self) });
    });
    definition.created.call(self);
    definition.mounted.call(self);
    return self;
  }

  return { ctx: ctx, ui: ctx.LmsUi, mount: mount, pushed: pushed, searches: searches };
}

const BEATLES = {
  artists: [{ id: 1, name: 'The Beatles' }, { id: 2, name: 'Beatles Tribute' }],
  albums: [{ id: 9, title: 'Revolver' }],
  tracks: [],
  playlists: []
};

test('NAV-01: opening a result suspends the search instead of discarding it', function () {
  const harness = searchInstance();
  harness.ui.openSearch();
  harness.ui.state.query = 'Beatles';
  const view = harness.mount({ scrollTop: 420 });
  view.results = BEATLES;

  view.openArtist({ id: 1, name: 'The Beatles', ids: null });

  assert.equal(harness.ui.state.searching, false, 'the search screen closes -- the artist takes the screen');
  assert.equal(harness.ui.state.query, '', 'the visible field empties; the term lives in the snapshot now');
  assert.equal(harness.ui.hasSuspendedSearch('music'), true);
  assert.equal(harness.ui.state.searchReturn, true, 'the Back label is computed, so the flag has to be reactive state');

  assert.equal(harness.pushed.length, 1);
  assert.equal(harness.pushed[0][0], 'music');
  assert.equal(harness.pushed[0][1].fromSearch, true,
    'without the mark on the frame, Back cannot tell this drill came from a search');
});

test('NAV-01: coming back restores term, results, limit and scroll without a new query', function () {
  const harness = searchInstance();
  harness.ui.openSearch();
  harness.ui.state.query = 'Beatles';
  const first = harness.mount({ scrollTop: 420 });
  first.results = BEATLES;
  first.limit = 100;
  first.openArtist({ id: 1, name: 'The Beatles', ids: null });

  assert.equal(harness.ui.resumeSearch('music'), true);
  assert.equal(harness.ui.state.searching, true);
  assert.equal(harness.ui.state.query, 'Beatles', 'the term is back in the field, not retyped');

  const el = { scrollTop: 0 };
  const second = harness.mount(el);
  assert.deepEqual(JSON.parse(JSON.stringify(second.results)), BEATLES, 'the same 2 artists and 1 album, not a second round trip');
  assert.equal(second.limit, 100, 'Show more results had already grown the page; returning must not shrink it');
  assert.equal(el.scrollTop, 420);
  assert.deepEqual(harness.searches, [], 'no call to LmsApi.search: returning is not a new search');
  assert.equal(harness.ui.state.searchReturn, false, 'consumed -- the Back label stops offering a return that already happened');
});

test('NAV-01: the snapshot is handed over once, so a fresh search never inherits the old list', function () {
  const harness = searchInstance();
  harness.ui.openSearch();
  harness.ui.state.query = 'Beatles';
  const first = harness.mount({ scrollTop: 420 });
  first.results = BEATLES;
  first.openArtist({ id: 1, name: 'The Beatles', ids: null });

  harness.ui.openSearch();
  assert.equal(harness.ui.hasSuspendedSearch(), false,
    'opening the search anew drops the suspension: otherwise the next mount would show another query\'s results as if they were this one\'s');

  harness.ui.state.query = 'Beatles';
  const fresh = harness.mount({ scrollTop: 0 });
  assert.deepEqual(JSON.parse(JSON.stringify(fresh.results)),
    { artists: [], albums: [], tracks: [], playlists: [] });
});

test('NAV-01: a suspension belongs to the tab that consumed it', function () {
  const harness = searchInstance();
  harness.ui.openSearch();
  harness.ui.state.query = 'Beatles';
  const view = harness.mount({ scrollTop: 0 });
  view.results = BEATLES;

  view.openPlaylist({ id: 7, name: 'Fab four' });

  assert.equal(harness.pushed[0][0], 'playlists');
  assert.equal(harness.pushed[0][1].fromSearch, true);
  assert.equal(harness.ui.hasSuspendedSearch('playlists'), true);
  assert.equal(harness.ui.hasSuspendedSearch('music'), false,
    'resuming from the wrong stack is how a Back in one tab would hijack another tab\'s screen');
});
