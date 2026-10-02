const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./helpers');
const root = path.resolve(__dirname, '..');

function plain(v) { return JSON.parse(JSON.stringify(v)); }

function boot(extra) {
  const definitions = {};
  const ctx = h.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/library-review.js', Object.assign({
    Vue: { observable: x => x, set: (o, k, v) => o[k] = v, delete: (o, k) => delete o[k], component: (n, d) => definitions[n] = d },
    localStorage: { getItem: () => null, setItem: () => {} },
    requestAnimationFrame: fn => fn(),
    LmsStore: { state: { playerId: 'p1', np: {}, equalizer: { settings: null, status: 'idle' } } },
    LmsApi: {}, LmsUi: { state: {} }, LmsNav: {},
    LmsFmt: { isLossless: f => /^(flac|alac|wav|aiff|ape|wavpack)$/i.test(f || '') }
  }, extra || {}));
  const d = definitions['lms-collection'];
  const self = Object.assign(d.data(), { $nextTick: async () => {}, $refs: {}, $emit: () => {} });
  Object.entries(d.methods || {}).forEach(([k, v]) => self[k] = v.bind(self));
  Object.entries(d.computed || {}).forEach(([k, v]) => Object.defineProperty(self, k, { get: v.bind(self) }));
  return { ctx, self, definitions };
}

const rows = [
  { id: 1, albumId: 10, album: 'Close', artist: 'Yes', genre: 'Rock', format: 'FLAC', year: 1972, duration: 300, fileSize: 100, remote: false, url: 'file:///m/Yes/Close/1.flac', title: 'a' },
  { id: 2, albumId: 10, album: 'Close', artist: 'Yes', genre: 'Rock', format: 'FLAC', year: 1972, duration: 200, fileSize: 100, remote: false, url: 'file:///m/Yes/Close/2.flac', title: 'b' },
  { id: 3, albumId: 11, album: 'Untagged', artist: 'X', genre: '', format: 'MP3', year: null, duration: 100, fileSize: 10, remote: false, url: 'file:///m/X/U/1.mp3', title: 'c' },
  { id: 4, albumId: 12, album: 'Disc', artist: 'Y', genre: 'Jazz', format: 'DSD', year: 1985, duration: 400, fileSize: 500, remote: false, url: 'file:///m/Y/D/1.dsf', title: 'd' }
];

test('summary figures derive from the loaded rows', () => {
  const { self } = boot();
  self.rows = rows;
  assert.equal(self.albumCount, 3);
  assert.equal(self.albumsToTag, 1);
  assert.equal(self.losslessPercent, 75);
  assert.equal(self.totalDuration, 1000);
  assert.equal(self.addedSinceScan, null);
});

test('albumMap carries tracks, duration, year, first url and format', () => {
  const { self } = boot();
  self.rows = rows;
  const a = self.albumMap['10'];
  assert.equal(a.tracks, 2); assert.equal(a.duration, 500); assert.equal(a.year, 1972);
  assert.equal(a.url, 'file:///m/Yes/Close/1.flac'); assert.equal(a.format, 'FLAC');
});

test('decade buckets count albums and unknown years', () => {
  const { self } = boot();
  self.rows = rows.concat([{ id: 5, albumId: 13, album: 'Bad year', year: 4070 }]);
  assert.deepEqual(Array.from(self.groups.decade, g => Object.assign({}, g)).sort((a, b) => a.key.localeCompare(b.key)),
    [{ key: '1970s', value: 1 }, { key: '1980s', value: 1 }, { key: '?', value: 2 }].sort((a, b) => a.key.localeCompare(b.key)));
  assert.equal(self.groups.decade.some(group => group.key === '4070s'), false);
});

test('Collection explains albums absent from its track-derived index', () => {
  const { self, definitions } = boot(); self.rows = rows;
  self.collectionCache.serverAlbumCount = 5;
  assert.equal(self.unindexedAlbumCount, 2);
  assert.match(definitions['lms-collection'].template, /not represented by track rows/);
  assert.match(definitions['lms-collection'].template, /Collection counts albums represented by track rows/);
});

test('every drill kind selects the right albums', () => {
  const { self } = boot();
  self.rows = rows;
  const ids = () => Array.from(self.selectedAlbums).map(a => a.id).sort();
  self.drill('all', ''); assert.deepEqual(ids(), [10, 11, 12]);
  self.drill('untagged', ''); assert.deepEqual(ids(), [11]);
  self.drill('lossless', ''); assert.deepEqual(ids(), [10, 12]);
  self.drill('genre', 'Rock'); assert.deepEqual(ids(), [10]);
  self.drill('format', 'DSD'); assert.deepEqual(ids(), [12]);
  self.drill('decade', '1980s'); assert.deepEqual(ids(), [12]);
  self.drill('decade', '?'); assert.deepEqual(ids(), [11]);
});

test('an uncached genre asks before preparation and then caches the completed result', async () => {
  const { self, definitions } = boot();
  self.rows = rows; self.lastscan = 'scan-1';
  self.openDrill('genre', 'Rock', 'By genre', { currentTarget: { focus() {} } });
  assert.equal(self.drillDialogOpen, true); assert.equal(self.selected, null);
  assert.equal(self.pendingDrillTracks, 2); assert.equal(self.pendingDrillAlbums, 1);
  await self.confirmDrill();
  assert.equal(self.drillPreparing, false); assert.equal(self.drillReady, true);
  assert.deepEqual(plain(self.selectedAlbums.map(a => a.id)), [10]);
  self.clearDrill(); self.openDrill('genre', 'Rock', 'By genre');
  assert.equal(self.drillDialogOpen, false); assert.deepEqual(plain(self.selectedAlbums.map(a => a.id)), [10]);
  assert.match(definitions['lms-collection'].template, /Prepare and open/);
});

test('genre progress view opens before preparation work starts', async () => {
  const frames = []; const { self } = boot({ setTimeout: fn => frames.push(fn) });
  self.rows = rows; self.lastscan = 'scan-1';
  self.openDrill('genre', 'Rock', 'By genre');
  const pending = self.confirmDrill();
  for (let i = 0; i < 3 && !frames.length; i++) await Promise.resolve();
  assert.deepEqual(plain(self.selected), { kind: 'genre', key: 'Rock' });
  assert.equal(self.drillDialogOpen, false);
  assert.equal(self.drillPreparing, true);
  assert.equal(self.drillProcessed, 0);
  assert.deepEqual(plain(self.selectedAlbums), []);
  self.cancelDrillPreparation();
  frames.shift()(); await Promise.resolve();
  await pending;
  assert.equal(self.selected, null);
});

test('genre preparation can be cancelled without discarding the collection snapshot', async () => {
  const frames = []; const { self } = boot({ setTimeout: fn => frames.push(fn) });
  self.rows = rows; self.lastscan = 'scan-1'; self.complete = true;
  self.openDrill('genre', 'Rock', 'By genre');
  const pending = self.confirmDrill();
  for (let i = 0; i < 3 && !frames.length; i++) await Promise.resolve();
  assert.equal(self.drillPreparing, true); self.cancelDrillPreparation();
  frames.splice(0).forEach(fn => fn()); await pending;
  assert.equal(self.selected, null); assert.equal(self.rows.length, rows.length); assert.equal(self.complete, true);
});

test('addedSinceScan compares with the previous cached total', () => {
  const { self } = boot();
  self.rows = rows;
  self.previousAlbumCount = 1;
  assert.equal(self.addedSinceScan, 2);
});

test('V4 keeps the approved default card order and follows persisted edit order', () => {
  const { self, ctx } = boot();
  assert.deepEqual(plain(ctx.LmsLibraryDisplay.state.dashboard.order), ['graphics', 'genre', 'albums', 'decade', 'size', 'tracks', 'format']);
  ctx.LmsLibraryDisplay.setDashboard({ order: ['graphics', 'decade', 'albums', 'genre', 'format', 'tracks', 'size'], size: { decade: [12, 4] } });
  assert.deepEqual(plain(self.visibleCards.map(c => c.id)), ['decade', 'genre', 'format', 'size']);
  assert.equal(self.dashboardCardStyle('decade').order, 1);
  assert.equal(self.dashboardCardStyle('decade')['--w'], 12);
});

test('overview card derives four compact pie charts from collection data', () => {
  const { self } = boot(); self.rows = rows;
  assert.deepEqual(plain(self.overviewCharts.map(c => c.id)), ['format', 'genre', 'decade', 'size']);
  assert.equal(self.overviewCharts[1].groups[0].value, 1, 'genre chart uses the album-based list values');
  assert.equal(self.segmentStyle(self.overviewCharts[0].groups, 0).stroke, '#c83d31');
  assert.match(self.segmentStyle(self.overviewCharts[0].groups, 0).strokeDasharray, /^50 /);
  assert.match(self.groupSummary(self.overviewCharts[0].groups), /FLAC/);
});

test('each chart segment exposes matching hover state and drills to its exact list', () => {
  const { self } = boot(); self.rows = rows; self.lastscan = 'scan-1';
  const chart = self.overviewCharts[2], group = chart.groups.find(item => item.key === '1970s');
  self.setMetric(chart.id, chart.groups.indexOf(group), group.key);
  assert.equal(self.metricCardActive('decade'), true);
  assert.equal(self.metricRowActive('decade', chart.groups.indexOf(group)), true);
  self.openOverviewGroup(chart, group, { currentTarget: null });
  assert.deepEqual(plain(self.selected), { kind: 'decade', key: '1970s' });
});

test('template carries the dashboard structure', () => {
  const { definitions } = boot();
  const t = definitions['lms-collection'].template;
  for (const needle of ['collection-summary', 'collection-grid', 'collection-graphics-card', 'collection-mini-charts', 'collection-donut-segment', 'collection-chart-keys', 'data-card="tracks"', 'collection-track-list', 'No category selected', 'collection-edit', 'collection-grip', ':draggable="editing"']) assert.ok(t.includes(needle), needle);
  assert.ok(t.includes('transform="rotate(-90 21 21)"'), 'donut segments rotate around the SVG center');
  for (const removed of ['collection-reorder', 'collection-hide']) assert.ok(!t.includes(removed), removed);
  assert.ok(!t.includes('collection-charts'), 'old chart grid removed');
});

function calls() {
  const log = [];
  const rec = name => (...a) => { log.push([name, ...a]); return Promise.resolve(name === 'createPlaylist' ? { id: 99 } : name === 'playlists' ? [{ id: 5, name: 'Car' }] : {}); };
  return { log, api: { loadContainer: rec('loadContainer'), queueControl: rec('queueControl'), playlists: rec('playlists'), createPlaylist: rec('createPlaylist'), editPlaylist: rec('editPlaylist'), commonDirectory: urls => '/m/common' } };
}

test('Collection actions require an explicit album selection', () => {
  const { self } = boot();
  self.rows = rows; self.drill('all', '');
  assert.deepEqual(plain(self.targetAlbums), []);
  assert.equal(self.drillListReady, true);
  assert.equal(self.drillActionsReady, false);
  self.selectAlbum(12, true);
  assert.deepEqual(plain(self.targetAlbums.map(a => a.id)), [12]);
  assert.equal(self.targetTracks.length, 1);
  assert.equal(self.drillActionsReady, true);
});

test('bulk Play loads the first album and appends the rest', async () => {
  const c = calls(); const { self } = boot({ LmsApi: c.api });
  self.rows = rows; self.drill('lossless', '');
  self.selectAlbum(10, true); self.selectAlbum(12, true);
  await self.playTargets();
  assert.deepEqual(c.log, [['loadContainer', 'p1', 'album_id', 10], ['queueControl', 'p1', 'add', 'album_id', 12]]);
});

test('Play Next inserts one album', async () => {
  const c = calls(); const { self } = boot({ LmsApi: c.api });
  self.rows = rows; await self.playNext({ id: 11 });
  assert.deepEqual(c.log, [['queueControl', 'p1', 'insert', 'album_id', 11]]);
});

test('playlist modal adds to an existing playlist, a new one, or the queue', async () => {
  const c = calls(); const { self } = boot({ LmsApi: c.api });
  self.rows = rows; self.drill('genre', 'Rock');
  self.selectAlbum(10, true);
  await self.openPlaylistModal();
  assert.equal(self.playlistOpen, true); assert.deepEqual(self.playlistList.map(p => p.id), [5]);
  self.playlistChoice = 5; await self.confirmPlaylist();
  assert.deepEqual(c.log.filter(l => l[0] === 'editPlaylist').map(l => l[1]), [5, 5]);
  c.log.length = 0; await self.openPlaylistModal(); self.playlistChoice = 'new'; self.playlistName = 'Prog'; await self.confirmPlaylist();
  assert.equal(c.log[1][0], 'createPlaylist'); assert.equal(c.log[2][1], 99);
  c.log.length = 0; await self.openPlaylistModal(); self.playlistChoice = 'queue'; await self.confirmPlaylist();
  assert.deepEqual(c.log.filter(l => l[0] === 'queueControl'), [['queueControl', 'p1', 'add', 'album_id', 10]]);
  assert.equal(c.log.some(l => l[0] === 'loadContainer'), false);
});

test('album action sheet item carries the folder url', () => {
  let opened = null; const { self } = boot({ LmsUi: { state: {}, openActions: (item) => { opened = item; } } });
  self.rows = rows; self.openAlbumActions(self.albumMap['10'], { currentTarget: null });
  assert.equal(opened.kind, 'album'); assert.equal(opened.id, 10); assert.equal(opened.folderUrl, 'file:///m/Yes/Close/1.flac');
});

test('Show in Folders reports when the folder is unknown', async () => {
  const c = calls(); const { self } = boot({ LmsApi: c.api, LmsUi: { state: {}, showInMusicFoldersMany: async () => ({ opened: 0 }) } });
  self.rows = rows; self.drill('all', ''); self.selectAlbum(10, true);
  await self.showTargetsInFolders();
  assert.equal(self.actionMessage, 'Folder not found in Music folders');
});

test('Show in Folders sends every checked album independently', async () => {
  const c = calls(); let sent = null;
  const { self, ctx } = boot({ LmsApi: c.api, LmsUi: { state: {}, showInMusicFoldersMany: async items => { sent = items; return { opened: 2 }; } } });
  self.rows = rows; self.drill('all', ''); self.selectAlbum(10, true); self.selectAlbum(12, true);
  self.$refs.albumList = { scrollTop: 136 };
  await self.showTargetsInFolders();
  assert.deepEqual(plain(sent.map(item => item.albumId)), [10, 12]);
  assert.equal(ctx.LmsLibraryDisplay.state.collectionReturn.scrollTop, 136);
});

test('returning from Folders restores the drill, checks and scroll position', () => {
  const { self, ctx } = boot();
  let restoredScroll = 0;
  self.$nextTick = fn => fn();
  self.$refs.albumList = { set scrollTop(value) { restoredScroll = value; }, get scrollTop() { return restoredScroll; } };
  ctx.LmsLibraryDisplay.state.collectionReturn = {
    selected: { kind: 'genre', key: 'Rock' }, selectedAlbumIds: { '10': true },
    visibleCount: 200, crumb: 'By genre', drillAlbums: [{ id: 10 }], drillRows: [rows[0]],
    drillReady: true, drillProcessed: 4, drillTotal: 4, scrollTop: 84
  };
  assert.equal(self.restoreReturnSnapshot(), true);
  assert.deepEqual(plain(self.selected), { kind: 'genre', key: 'Rock' });
  assert.deepEqual(plain(self.selectedAlbumIds), { '10': true });
  assert.equal(self.visibleCount, 200); assert.equal(restoredScroll, 84);
  assert.equal(ctx.LmsLibraryDisplay.state.collectionReturn, null);
});

test('template shows selection guidance and disables actions until a selection exists', () => {
  const { definitions } = boot(); const t = definitions['lms-collection'].template;
  assert.match(t, /collection-selection-guidance/);
  assert.match(t, /collection-set-heading/);
  assert.match(t, /collection-set-heading[\s\S]*?addTargetsToBuilder[\s\S]*?showTargetsInFolders/);
  assert.match(t, /Select at least one album/);
  assert.match(t, /actionBusy \|\| !drillActionsReady/);
  assert.ok(!t.includes('None selected · actions apply to all'));
});

test('selected albums stay inside a dashboard-sized card beside the shared builder', () => {
  const css = fs.readFileSync(path.join(root, 'EchoClassic/HTML/echoclassic/html/css/ios9.css'), 'utf8');
  assert.match(css, /\.collection-grid\{display:grid;grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css, /\.collection-card\{grid-column:span var\(--w,4\);grid-row:span var\(--h,4\)/);
  assert.doesNotMatch(css, /\.collection-inspector\{grid-column:/);
  assert.doesNotMatch(css, /\.collection-card\[data-card=tracks\]\{grid-column:/);
});

test('Tracks card contains every track from the checked albums', () => {
  const { self } = boot(); self.rows = rows; self.drill('all', '');
  assert.equal(self.selectedTracks.length, 0);
  self.selectAlbum(10, true); assert.deepEqual(plain(self.selectedTracks.map(t => t.id)), [1, 2]);
  self.selectAlbum(12, true); assert.deepEqual(plain(self.selectedTracks.map(t => t.id)), [1, 2, 4]);
});
