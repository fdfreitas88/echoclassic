/* Library display preferences are separate from playback and are never sent to LMS. */
(function (global) {
  'use strict';
  var defaults = { albumCover: true, artistCover: true, artist: true, counts: true, year: true, format: true, genre: false, source: true, albumInformation: true, artistInformation: true };
  var defaultOrder = ['albumCover', 'artist', 'counts', 'year', 'format', 'genre', 'source', 'albumInformation', 'artistCover', 'artistInformation'];
  var defaultPositions = { albumCover: 'left', artist: 'left', counts: 'left', year: 'left', format: 'left', genre: 'hidden', source: 'left', albumInformation: 'left', artistCover: 'right', artistInformation: 'right' };
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('echoclassic.library-display.v1') || '{}') || {}; } catch (e) {}
  var collectionCacheKey = 'echoclassic.collection-cache.v1';
  function validCollectionCache(value) {
    return value && value.lastscan && Array.isArray(value.rows) && value.complete ? value : null;
  }
  function collectionDb() {
    return new Promise(function (resolve, reject) {
      if (!global.indexedDB) return reject(new Error('IndexedDB unavailable'));
      var request = global.indexedDB.open('echoclassic-library', 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains('cache')) request.result.createObjectStore('cache'); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }
  async function readCollectionCache() {
    try {
      var db = await collectionDb();
      var value = await new Promise(function (resolve, reject) { var request = db.transaction('cache', 'readonly').objectStore('cache').get(collectionCacheKey); request.onsuccess = function () { resolve(request.result); }; request.onerror = function () { reject(request.error); }; });
      db.close(); return validCollectionCache(value);
    } catch (e) {
      try { return validCollectionCache(JSON.parse(localStorage.getItem(collectionCacheKey) || 'null')); } catch (ignored) { return null; }
    }
  }
  async function writeCollectionCache(value) {
    try {
      var db = await collectionDb();
      await new Promise(function (resolve, reject) { var request = db.transaction('cache', 'readwrite').objectStore('cache').put(value, collectionCacheKey); request.onsuccess = resolve; request.onerror = function () { reject(request.error); }; });
      db.close();
    } catch (e) {
      try { localStorage.setItem(collectionCacheKey, JSON.stringify(value)); } catch (ignored) {}
    }
  }
  var dashboardCards = ['graphics', 'genre', 'albums', 'decade', 'size', 'tracks', 'format'];
  var dashboardDefaults = { graphics: [12, 3], genre: [6, 4], albums: [6, 4], decade: [6, 4], size: [6, 4], tracks: [6, 4], format: [6, 4] };
  function uniqueCards(list) {
    return Array.isArray(list) ? list.filter(function (key, i, all) { return dashboardCards.indexOf(key) >= 0 && all.indexOf(key) === i; }) : [];
  }
  function clampSpan(value, min, max, fallback) {
    var n = Number(value);
    return isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  }
  function cleanDashboard(value) {
    value = value && typeof value === 'object' ? value : {};
    var order = uniqueCards(value.order), size = {};
    dashboardCards.forEach(function (key) { if (order.indexOf(key) < 0) order.push(key); });
    dashboardCards.forEach(function (key) {
      var s = value.size && Array.isArray(value.size[key]) ? value.size[key] : [], d = dashboardDefaults[key];
      size[key] = [clampSpan(s[0], 3, 12, d[0]), clampSpan(s[1], 3, 10, d[1])];
    });
    return { order: order, size: size, hidden: uniqueCards(value.hidden) };
  }
  var state = Vue.observable({ preferences: {}, orders: {}, positions: {}, context: null, returnTo: null, collectionReturn: null, albumSide: saved.albumSide === 'right' ? 'right' : 'left', panel: ['album', 'eq', 'signal'], hidden: [], collection: null, dashboard: cleanDashboard(saved.dashboardVersion === 4 ? saved.dashboard : null) });
  function cleanFields(value) {
    var out = {};
    Object.keys(defaults).forEach(function (key) { if (value && typeof value[key] === 'boolean') out[key] = value[key]; });
    return out;
  }
  Object.keys(saved.preferences || {}).slice(0, 1000).forEach(function (key) {
    if (/^(global|album:.+|artist:.+|genre:.+)$/.test(key)) state.preferences[key] = cleanFields(saved.preferences[key]);
  });
  function cleanOrder(value) {
    var out = Array.isArray(value) ? value.filter(function (key, i, all) { return defaultOrder.indexOf(key) >= 0 && all.indexOf(key) === i; }) : [];
    defaultOrder.forEach(function (key) { if (out.indexOf(key) < 0) out.push(key); });
    return out;
  }
  Object.keys(saved.orders || {}).slice(0, 1000).forEach(function (key) {
    if (/^(global|album:.+|artist:.+|genre:.+)$/.test(key)) state.orders[key] = cleanOrder(saved.orders[key]);
  });
  function cleanPositions(value) {
    var out = {};
    Object.keys(defaultPositions).forEach(function (key) { if (value && ['left', 'right', 'hidden'].indexOf(value[key]) >= 0) out[key] = value[key]; });
    return out;
  }
  Object.keys(saved.positions || {}).slice(0, 1000).forEach(function (key) {
    if (/^(global|album:.+|artist:.+|genre:.+)$/.test(key)) state.positions[key] = cleanPositions(saved.positions[key]);
  });
  if (Array.isArray(saved.panel)) {
    state.panel = saved.panel.filter(function (key, i, a) { return ['album', 'eq', 'signal'].indexOf(key) >= 0 && a.indexOf(key) === i; });
    ['album', 'eq', 'signal'].forEach(function (key) { if (state.panel.indexOf(key) < 0) state.panel.push(key); });
  }
  if (Array.isArray(saved.hidden)) state.hidden = saved.hidden.filter(function (key) { return state.panel.indexOf(key) >= 0; });
  function persist() { try { localStorage.setItem('echoclassic.library-display.v1', JSON.stringify({ preferences: state.preferences, orders: state.orders, positions: state.positions, albumSide: state.albumSide, panel: state.panel, hidden: state.hidden, dashboardVersion: 4, dashboard: state.dashboard })); } catch (e) {} }
  function keys(context) {
    context = context || {};
    return ['global', context.genre ? 'genre:' + context.genre : '', context.artist ? 'artist:' + context.artist : '', context.id != null ? 'album:' + context.id : ''].filter(Boolean);
  }
  function resolve(context, until) {
    var out = Object.assign({}, defaults), chain = keys(context);
    for (var i = 0; i < chain.length; i++) { Object.assign(out, state.preferences[chain[i]] || {}); if (chain[i] === until) break; }
    return out;
  }
  function resolveOrder(context, until) {
    var out = defaultOrder.slice(), chain = keys(context);
    for (var i = 0; i < chain.length; i++) { if (state.orders[chain[i]]) out = state.orders[chain[i]].slice(); if (chain[i] === until) break; }
    return out;
  }
  function resolvePositions(context, until) {
    var out = Object.assign({}, defaultPositions), chain = keys(context);
    for (var i = 0; i < chain.length; i++) { Object.assign(out, state.positions[chain[i]] || {}); if (chain[i] === until) break; }
    return out;
  }
  function set(key, field, value) {
    if (!Object.prototype.hasOwnProperty.call(defaults, field)) return;
    var next = Object.assign({}, state.preferences[key] || {}); next[field] = !!value;
    Vue.set(state.preferences, key, next); persist();
  }
  function open(context, returnTo) {
    state.context = context || null;
    state.returnTo = returnTo && returnTo.tab ? { tab: returnTo.tab, settingsDepth: Number(returnTo.settingsDepth) || 0 } : null;
    LmsUi.setTab('settings'); LmsUi.state.appearanceScreen = 'album-information';
    LmsNav.push('settings', { label: 'Album information', screen: 'album-information' });
  }
  function closeToOrigin() {
    var target = state.returnTo;
    if (!target) return false;
    while (LmsNav.depth('settings') > target.settingsDepth) LmsNav.pop('settings');
    state.returnTo = null;
    state.context = null;
    if (global.LmsUi && LmsUi.restoreTab) LmsUi.restoreTab(target.tab);
    else if (global.LmsUi && LmsUi.setTab) LmsUi.setTab(target.tab);
    if (global.history && history.replaceState && global.LmsNav && LmsNav.stacks && LmsNav.depth) {
      history.replaceState({ echoClassic: true, tab: target.tab, depth: LmsNav.depth(target.tab), frames: JSON.parse(JSON.stringify(LmsNav.stacks[target.tab] || [])) }, '');
    }
    return true;
  }
  global.LmsLibraryDisplay = { state: state, resolve: resolve, resolveOrder: resolveOrder, resolvePositions: resolvePositions, keys: keys, set: set, open: open, closeToOrigin: closeToOrigin,
    setOrder: function (key, order) { Vue.set(state.orders, key, cleanOrder(order)); persist(); },
    setPosition: function (scope, field, position) { if (!Object.prototype.hasOwnProperty.call(defaultPositions, field) || ['left', 'right', 'hidden'].indexOf(position) < 0) return; var next = Object.assign({}, state.positions[scope] || {}); next[field] = position; Vue.set(state.positions, scope, next); set(scope, field, position !== 'hidden'); persist(); },
    setAlbumSide: function (side) { if (side !== 'left' && side !== 'right') return; state.albumSide = side; persist(); },
    reset: function (key) { Vue.delete(state.preferences, key); Vue.delete(state.orders, key); Vue.delete(state.positions, key); persist(); },
    move: function (index, delta) { var next = index + delta; if (next < 0 || next >= state.panel.length) return; var key = state.panel.splice(index, 1)[0]; state.panel.splice(next, 0, key); persist(); },
    show: function (key, visible) { var i = state.hidden.indexOf(key); if (visible && i >= 0) state.hidden.splice(i, 1); else if (!visible && i < 0) state.hidden.push(key); persist(); },
    cacheCollection: writeCollectionCache, loadCollectionCache: readCollectionCache,
    dashboardCards: dashboardCards.slice(),
    setDashboard: function (partial) { var next = Object.assign({}, state.dashboard); Object.keys(partial || {}).forEach(function (k) { next[k] = k === 'size' ? Object.assign({}, state.dashboard.size, partial.size) : partial[k]; }); state.dashboard = cleanDashboard(next); persist(); },
    resetDashboard: function () { state.dashboard = cleanDashboard(null); persist(); }
  };
})(window);

/* The collection index is a browser-side derivative of the LMS library. Cache
   inspection is deliberately separate from building: opening Collection and
   the background timer may check lastscan, but only a user action may page the
   complete track library. */
(function (global) {
  'use strict';
  /* LMS handles one large titles query much more reliably than several
     simultaneous ones. Keep the first page small for a quick partial
     dashboard, then use larger sequential pages to reduce round trips without
     overloading the server. */
  var firstPageSize = 500, scanPageSize = 5000, pageRetries = 2;
  var inFlight = null, generation = 0, prepared = Object.create(null);
  var state = Vue.observable({ busy: false, processed: 0, total: null, freshness: 'unknown', serverLastscan: '', error: '', partialRows: [], partialStats: null, partialFirstMs: null });
  function bucketList(bucket) {
    return Object.keys(bucket).map(function (key) { return { key: key, value: bucket[key] }; }).sort(function (a, b) { return b.value - a.value; });
  }
  function createAccumulator() {
    var albums = Object.create(null), genreAlbums = Object.create(null), untaggedAlbums = Object.create(null);
    var genre = Object.create(null), genreStorage = Object.create(null), format = Object.create(null), storage = Object.create(null);
    var trackCount = 0, totalDuration = 0, unknownSizes = 0, storageBytes = 0, losslessTracks = 0;
    function add(row) {
      trackCount++; totalDuration += row.duration || 0;
      var genreKey = row.genre || '?', formatKey = row.format || '?';
      genre[genreKey] = (genre[genreKey] || 0) + 1; format[formatKey] = (format[formatKey] || 0) + 1;
      if (!row.remote && row.fileSize == null) unknownSizes++;
      if (!row.remote && row.fileSize != null) { storageBytes += row.fileSize; storage[formatKey] = (storage[formatKey] || 0) + row.fileSize; genreStorage[genreKey] = (genreStorage[genreKey] || 0) + row.fileSize; }
      if (/^(dsd|dsf|dff|flac|alac|wav|aiff|ape|wavpack)$/i.test(String(row.format || ''))) losslessTracks++;
      if (row.albumId == null) return;
      var albumKey = String(row.albumId), album = albums[albumKey] || (albums[albumKey] = { id: row.albumId, bytes: 0, known: true, local: false, year: null });
      if (album.year == null && row.year) album.year = row.year;
      if (!row.remote) { album.local = true; if (row.fileSize == null) album.known = false; else album.bytes += row.fileSize; }
      (genreAlbums[genreKey] || (genreAlbums[genreKey] = Object.create(null)))[albumKey] = true;
      if (!row.genre || /^no genre$/i.test(row.genre)) untaggedAlbums[albumKey] = true;
    }
    function snapshot() {
      var size = Object.create(null), decade = Object.create(null), genreAlbumCounts = Object.create(null);
      Object.keys(albums).forEach(function (key) { var album = albums[key], decadeKey = album.year ? (Math.floor(album.year / 10) * 10) + 's' : '?'; decade[decadeKey] = (decade[decadeKey] || 0) + 1; if (album.local) { var band = !album.known ? '?' : album.bytes < 250e6 ? '< 250 MB' : album.bytes < 500e6 ? '250–500 MB' : album.bytes < 1e9 ? '500 MB–1 GB' : '> 1 GB'; size[band] = (size[band] || 0) + 1; } });
      Object.keys(genreAlbums).forEach(function (key) { genreAlbumCounts[key] = Object.keys(genreAlbums[key]).length; });
      return { trackCount: trackCount, albumCount: Object.keys(albums).length, totalDuration: totalDuration, unknownSizes: unknownSizes, storageBytes: storageBytes, albumsToTag: Object.keys(untaggedAlbums).length, losslessPercent: trackCount ? Math.round(100 * losslessTracks / trackCount) : 0,
        groups: { genre: bucketList(genre), format: bucketList(format), storage: bucketList(storage), size: bucketList(size), decade: bucketList(decade) }, genreAlbums: bucketList(genreAlbumCounts), genreTracks: bucketList(genre), genreStorage: bucketList(genreStorage) };
    }
    return { addRows: function (rows) { rows.forEach(add); }, snapshot: snapshot };
  }
  function publishCache(cached, stamp) {
    if (cached) LmsLibraryDisplay.state.collection = cached;
    state.serverLastscan = String(stamp || '');
    state.freshness = !cached ? 'empty' : cached.lastscan === state.serverLastscan ? 'current' : 'stale';
    return cached;
  }
  async function fetchCollectionPage(start, count, token) {
    var lastError;
    for (var attempt = 0; attempt <= pageRetries; attempt++) {
      if (token !== generation) throw new Error('Collection scan cancelled');
      try { return await LmsApi.collectionTracks(start, count); }
      catch (error) {
        lastError = error;
        if (attempt === pageRetries) throw error;
        await new Promise(function (resolve) { setTimeout(resolve, 250 * (attempt + 1)); });
      }
    }
    throw lastError;
  }
  async function inspect() {
    var cached = LmsLibraryDisplay.state.collection;
    if (!cached) cached = await LmsLibraryDisplay.loadCollectionCache();
    var info, stamp;
    try { info = await LmsApi.serverInfo(); stamp = String(info.lastscan || ''); }
    catch (error) { if (!cached) throw error; stamp = String(cached.lastscan || ''); }
    return publishCache(cached, stamp);
  }
  async function build(lastscan, token) {
    var started = Date.now(), networkMs = 0, aggregationMs = 0, accumulator = createAccumulator();
    state.busy = true; state.processed = 0; state.total = null; state.error = ''; state.partialRows = []; state.partialStats = null; state.partialFirstMs = null;
    var first = await fetchCollectionPage(0, firstPageSize, token);
    if (token !== generation) throw new Error('Collection scan cancelled');
    var total = first.total, pages = [first], firstMs = first.rows.length ? Date.now() - started : null;
    if (!first.rows.length && total != null && total > 0) throw new Error('Incomplete collection page');
    if (total != null && first.rows.length !== Math.min(firstPageSize, total)) throw new Error('Incomplete collection page');
    var aggregateStarted = Date.now(); accumulator.addRows(first.rows); state.partialStats = accumulator.snapshot(); aggregationMs += Date.now() - aggregateStarted;
    state.processed = first.rows.length; state.total = total; state.partialRows = first.rows.slice(); state.partialFirstMs = firstMs;
    var offset = first.rows.length, page, requestCount;
    if (total == null) {
      if (first.rows.length === firstPageSize) {
        do {
          requestCount = scanPageSize;
          page = await fetchCollectionPage(offset, requestCount, token);
          pages.push(page); offset += page.rows.length; state.processed = offset;
          aggregateStarted = Date.now(); accumulator.addRows(page.rows); state.partialStats = accumulator.snapshot(); aggregationMs += Date.now() - aggregateStarted;
          await new Promise(function (resolve) { setTimeout(resolve, 0); });
        } while (page.rows.length === requestCount);
      }
      total = offset; state.total = total;
    } else {
      while (offset < total) {
        requestCount = Math.min(scanPageSize, total - offset);
        page = await fetchCollectionPage(offset, requestCount, token);
        if (page.total != null && page.total !== total) throw new Error('Library changed during collection scan');
        if (page.rows.length !== requestCount) throw new Error('Incomplete collection page');
        pages.push(page); offset += page.rows.length; state.processed = offset;
        aggregateStarted = Date.now(); accumulator.addRows(page.rows); state.partialStats = accumulator.snapshot(); aggregationMs += Date.now() - aggregateStarted;
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
      }
    }
    networkMs = Date.now() - started;
    var rows = [], seen = Object.create(null);
    pages.forEach(function (item) { item.rows.forEach(function (row) { var key = String(row.id); if (seen[key]) throw new Error('Duplicate collection track'); seen[key] = true; rows.push(row); }); });
    if (rows.length !== total) throw new Error('Incomplete collection page');
    var confirmed = String((await LmsApi.serverInfo()).lastscan || '');
    if (token !== generation) throw new Error('Collection scan cancelled');
    if (confirmed !== lastscan) throw new Error('Library changed during collection scan');
    var snapshot = { rows: rows, offset: rows.length, total: total, lastscan: lastscan, complete: true, error: '', cachedAt: Date.now(), firstMs: firstMs, completeMs: Date.now() - started, networkMs: networkMs, aggregationMs: aggregationMs, cacheMs: 0 };
    LmsLibraryDisplay.state.collection = snapshot;
    var cacheStarted = Date.now();
    await LmsLibraryDisplay.cacheCollection(snapshot);
    snapshot.cacheMs = Date.now() - cacheStarted;
    state.partialRows = []; state.partialStats = null; state.partialFirstMs = null;
    state.freshness = 'current'; state.serverLastscan = lastscan;
    return snapshot;
  }
  async function start(token) {
    var info = await LmsApi.serverInfo(), stamp = String(info.lastscan || '');
    if (token !== generation) throw new Error('Collection scan cancelled');
    state.serverLastscan = stamp;
    return build(stamp, token);
  }
  function rebuild() {
    if (inFlight) return inFlight;
    var token = ++generation; state.busy = true; state.processed = 0; state.total = null; state.error = '';
    inFlight = start(token).catch(function (error) { if (!/cancelled/i.test(String(error && error.message || ''))) state.error = error && error.message || 'Collection scan failed'; throw error; }).finally(function () { inFlight = null; state.busy = false; });
    return inFlight;
  }
  function cancel() { if (!state.busy) return; generation++; state.busy = false; state.error = ''; state.partialRows = []; state.partialStats = null; state.partialFirstMs = null; }
  function preparedKey(lastscan, kind, key) { return String(lastscan || '') + '|' + kind + '|' + key; }
  global.LmsCollectionCache = {
    state: state, inspect: inspect, rebuild: rebuild, cancel: cancel,
    ensure: function (force) { return force ? rebuild() : inspect(); },
    prepared: function (lastscan, kind, key) { return prepared[preparedKey(lastscan, kind, key)] || null; },
    cachePrepared: function (lastscan, kind, key, value) { prepared[preparedKey(lastscan, kind, key)] = value; }
  };
  if (global.indexedDB && global.setInterval) {
    global.setTimeout(function () { inspect().catch(function () {}); }, 0);
    global.setInterval(function () { if (!state.busy && (!global.document || !global.document.hidden)) inspect().catch(function () {}); }, 60000);
  }
})(window);

Vue.component('lms-album-display-settings', {
  template: `<section><div v-if="prefs.returnTo" class="album-display-return-bar"><button type="button" class="album-display-return-back" @click="returnToOrigin">‹ {{ tr('Back') }} {{ tr('to') }} {{ tr('Album') }}</button><strong>{{ tr('Display') }}</strong></div><div class="sgh">Album information</div><div class="player-help">Choose what appears beside the album cover.</div>
    <div class="sgroup"><label class="srow">{{ tr('Apply to') }}<select v-model="scope"><option v-for="option in scopes" :key="option.key" :value="option.key">{{ option.label }}</option></select></label>
    <div class="album-field-editor is-sided">
      <div v-for="side in ['left','right','hidden']" :key="side" class="album-field-list" :class="{'is-hidden':side==='hidden'}" @dragover.prevent @drop.prevent="dropAt(sideFields(side).length,side)"><div class="album-field-list-title"><strong>{{ tr(side==='left'?'Left side':side==='right'?'Right side':'Hidden') }}</strong><small>{{ tr(side==='hidden'?'Drag here to remove':'Drag to rearrange') }}</small></div>
        <div v-for="(field,index) in sideFields(side)" :key="field.key" class="album-field-row" :class="{dragging:dragKey===field.key}" draggable="true" @dragstart="dragStart(field.key,$event)" @dragover.prevent.stop @drop.prevent.stop="dropAt(index,side)" @dragend="dragEnd"><span class="album-field-grip" aria-hidden="true">⠿</span><span>{{ tr(field.label) }}</span><span class="album-field-actions"><button v-if="side!=='left'" type="button" :aria-label="tr('Left')" @click="place(field.key,'left')">←</button><button v-if="side!=='right'" type="button" :aria-label="tr('Right')" @click="place(field.key,'right')">→</button><button v-if="side!=='hidden'" type="button" :aria-label="tr('Hide')+' '+tr(field.label)" @click="place(field.key,'hidden')">−</button></span></div>
      </div>
    </div>
    <button class="srow pointer" @click="reset">{{ tr(scope === 'global' ? 'Restore defaults' : 'Use inherited settings') }}</button></div>
    <p class="player-help">Album overrides artist, artist overrides genre, genre overrides global.</p>
    <section class="album-display-preview" :aria-label="tr('LIVE PREVIEW')"><small>{{ tr('LIVE PREVIEW') }}</small><strong>{{ preview.title }}</strong><template v-for="field in visibleFields"><span v-if="previewValue(field.key)" :key="'preview-'+field.key" :class="{'preview-information':field.key==='albumInformation'||field.key==='artistInformation'}">{{ previewValue(field.key) }}</span></template></section>
    <p v-if="!prefs.context" class="player-help">Open these settings from an album to customize its artist, genre or album.</p><div v-if="prefs.returnTo" class="album-display-return-actions"><button type="button" class="settings-command-row pointer" @click="returnToOrigin">{{ tr('Done') }} · {{ tr('Back') }} {{ tr('to') }} {{ tr('Album') }} <span class="v">✓</span></button></div></section>`,
  data: function () { return { prefs: LmsLibraryDisplay.state, scope: 'global', dragKey: '', dragSide: '', fields: [
    { key: 'albumCover', label: 'Album cover' }, { key: 'artistCover', label: 'Artist cover' }, { key: 'artist', label: 'Artist' }, { key: 'counts', label: 'Track and disc count' }, { key: 'year', label: 'Edition year' },
    { key: 'format', label: 'File format and resolution' }, { key: 'genre', label: 'Genre' }, { key: 'source', label: 'Music source' },
    { key: 'albumInformation', label: 'Album information' }, { key: 'artistInformation', label: 'Artist information' }] }; },
  computed: {
    scopes: function () { var c = this.prefs.context || {}, self = this; return LmsLibraryDisplay.keys(c).map(function (key) { return { key: key, label: key === 'global' ? self.tr('Global') : self.tr(key.split(':')[0] === 'album' ? 'Album' : key.split(':')[0] === 'artist' ? 'Artist' : 'Genre') + ': ' + (key.indexOf('album:') === 0 ? c.title : key.slice(key.indexOf(':') + 1)) }; }); },
    resolved: function () { this.prefs.preferences; return LmsLibraryDisplay.resolve(this.prefs.context, this.scope); },
    positions: function () { this.prefs.positions; return LmsLibraryDisplay.resolvePositions(this.prefs.context, this.scope); },
    orderedFields: function () { this.prefs.orders; var byKey = {}; this.fields.forEach(function (field) { byKey[field.key] = field; }); return LmsLibraryDisplay.resolveOrder(this.prefs.context, this.scope).map(function (key) { return byKey[key]; }).filter(Boolean); },
    visibleFields: function () { var self=this; return this.orderedFields.filter(function(field){return self.positions[field.key] !== 'hidden';}); },
    hiddenFields: function () { var self=this; return this.orderedFields.filter(function(field){return self.positions[field.key] === 'hidden';}); },
    preview: function () { var n = (window.LmsStore && LmsStore.state && LmsStore.state.np) || {}, c = Object.assign({ title:n.album, artist:n.artist, genre:n.genre, format:n.format }, this.prefs.context || {}); return { title: c.title || this.tr('Current album'), artist: c.artist || '', genre: c.genre || '', counts: c.counts || '', year: c.year || '', format: c.format || '', source: c.source || '' }; }
  },
  methods: { tr: function (s) { return window.LmsStr ? LmsStr.t(s) : s; }, returnToOrigin: function () { LmsLibraryDisplay.closeToOrigin(); }, setSide: function (side) { LmsLibraryDisplay.setAlbumSide(side); }, change: function (key, value) { LmsLibraryDisplay.set(this.scope, key, value); }, reset: function () { LmsLibraryDisplay.reset(this.scope); },
    previewValue:function(key){var p=this.preview;return {artist:p.artist,counts:p.counts,year:p.year?this.tr('Edition year')+': '+p.year:'',format:p.format,genre:p.genre,source:p.source,albumInformation:this.tr('Album information'),artistInformation:this.tr('Artist information')}[key]||'';},
    sideFields:function(side){var self=this;return this.orderedFields.filter(function(field){return self.positions[field.key]===side;});},
    place:function(key,side){LmsLibraryDisplay.setPosition(this.scope,key,side);},
    dragStart:function(key,event){this.dragKey=key;this.dragSide=this.positions[key];if(event&&event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',key);}},
    dragEnd:function(){this.dragKey='';},
    dropAt:function(index,side){if(!this.dragKey)return;var target=this.sideFields(side),before=target[index]&&target[index].key,order=this.orderedFields.map(function(f){return f.key;}),from=order.indexOf(this.dragKey);if(from<0)return;order.splice(from,1);var at=before?order.indexOf(before):order.length;order.splice(at,0,this.dragKey);LmsLibraryDisplay.setOrder(this.scope,order);if(this.dragSide!==side)this.place(this.dragKey,side);this.dragEnd();},
    moveField:function(key,delta){var visible=this.visibleFields.map(function(f){return f.key;}),i=visible.indexOf(key),swap=visible[i+delta];if(!swap)return;var order=this.orderedFields.map(function(f){return f.key;}),a=order.indexOf(key),b=order.indexOf(swap),tmp=order[a];order[a]=order[b];order[b]=tmp;LmsLibraryDisplay.setOrder(this.scope,order);}
  }
});

Vue.component('lms-player-library-panel', {
  props: { editing: Boolean },
  template: `<section class="player-library-panel">
    <div v-if="editing" class="player-panel-editor"><div v-for="(key,index) in prefs.panel" :key="key" class="player-panel-edit-row"><label><input type="checkbox" :checked="prefs.hidden.indexOf(key)<0" @change="show(key,$event.target.checked)">{{ tr(label(key)) }}</label><button :disabled="index===0" :aria-label="tr('Move up')" @click="move(index,-1)">↑</button><button :disabled="index===prefs.panel.length-1" :aria-label="tr('Move down')" @click="move(index,1)">↓</button></div></div>
    <section v-for="key in visible" :key="key" class="player-panel-module">
      <template v-if="key==='album'"><h3>{{ tr('Album information') }}</h3><h2>{{ store.np.album }}</h2><p>{{ store.np.artist }}</p>
        <p v-if="loading" role="status">{{ tr('Loading…') }}</p><button v-if="error" @click="load">{{ tr('Try again') }}</button>
        <dl v-if="song"><template v-for="row in metadata"><dt :key="row.label+'label'">{{ tr(row.label) }}</dt><dd :key="row.label">{{ row.value }}</dd></template></dl>
        <button v-if="song && song.albumId != null" class="album-config-cog" :title="tr('Customize album information')" :aria-label="tr('Customize album information')" @click="configure"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </template>
      <template v-else-if="key==='eq'"><h3>{{ tr('Small EQ') }}</h3><div v-if="bands.length" class="small-eq-bands"><label v-for="band in bands" :key="band.index">{{ band.frequency }} Hz<input type="range" min="-12" max="12" step="0.5" :value="band.gain" :disabled="saving || !store.commandable" :aria-label="tr('Equalizer')+' '+band.frequency+' Hz'" @change="gain(band.index,$event)"><output>{{ band.gain }} dB</output></label></div><p v-else>{{ tr('Not available') }}</p><button @click="equalizer">{{ tr('Equalizer') }}</button></template>
      <template v-else><h3>{{ tr('Signal & track information') }}</h3><p>{{ signal }}</p><button @click="info">{{ tr('Information') }}</button></template>
    </section></section>`,
  data: function () { return { prefs: LmsLibraryDisplay.state, store: LmsStore.state, song: null, loading: false, error: false, token: 0, saving: false }; },
  computed: {
    visible: function () { var self = this; return this.prefs.panel.filter(function (key) { return self.prefs.hidden.indexOf(key)<0; }); },
    metadata: function () { var s = this.song || {}, p = LmsLibraryDisplay.resolve({ id:s.albumId,artist:s.artist,genre:s.genre }); return [
      { label:'Track and disc count',value:p.counts && this.countLabel },{ label:'Edition year',value:p.year && s.year },{ label:'Genre',value:p.genre && s.genre },{ label:'Composer',value:s.composer },{ label:'Conductor',value:s.conductor },{ label:'Ensemble',value:s.band },{ label:'Music source',value:p.source && this.sourceLabel },{ label:'Format:',value:p.format && s.format }].filter(function (row) { return !!row.value; }); },
    countLabel: function () { var s=this.song||{}, tracks=s.trackCount||s.tracks||s.totalTracks||s.albumTracks||'', discs=s.discCount||s.discs||''; return [tracks ? tracks+' '+this.tr(Number(tracks)===1?'track':'tracks') : '', discs ? discs+' '+this.tr(Number(discs)===1?'disc':'discs') : ''].filter(Boolean).join(' · '); },
    sourceLabel: function () { var s=this.song||{}, url=String(s.url||''); if (/qobuz/i.test(url)||String(s.source||'').toLowerCase()==='qobuz') return 'Qobuz'; return s.remote ? this.tr('Remote / streaming') : this.tr('Local library'); },
    bands: function () { var settings=this.store.equalizer.settings; if(this.store.equalizer.status!=='ready'||!settings||!settings.Client)return []; return (settings.Client.Filters||[]).map(function (f,i) { return { index:i,frequency:Number(f.Frequency),gain:Number(f.Gain),type:String(f.FilterType).toLowerCase() }; }).filter(function (b) { return b.type==='peak' && isFinite(b.gain) && isFinite(b.frequency); }).slice(0,3); },
    signal: function () { var n=this.store.np; return [n.format,LmsFmt.rate(n.sampleRate),LmsFmt.depth(n.sampleSize),n.isTranscoded?this.tr('Transcoded'):''].filter(Boolean).join(' · '); }
  },
  methods: {
    tr:function(s){return window.LmsStr?LmsStr.t(s):s;},label:function(key){return {album:'Album information',eq:'Small EQ',signal:'Signal & track information'}[key];},
    move:function(i,d){LmsLibraryDisplay.move(i,d);},show:function(k,v){LmsLibraryDisplay.show(k,v);},
    configure:function(){var s=this.song||{},n=this.store.np||{};LmsUi.closePlayer();LmsLibraryDisplay.open({id:s.albumId,title:s.album||n.album,artist:s.artist||n.artist,genre:s.genre||n.genre,counts:this.countLabel,year:s.year||n.year||'',format:[s.format||n.format,LmsFmt.rate(s.sampleRate||n.sampleRate),LmsFmt.depth(s.sampleSize||n.sampleSize)].filter(Boolean).join(' · '),source:this.sourceLabel});},
    equalizer:function(){LmsUi.closePlayer();LmsStore.setEqualizerContext(null);LmsUi.setTab('settings');LmsUi.state.appearanceScreen='equalizer';LmsNav.push('settings',{label:'Equalizer',screen:'equalizer'});},
    info:function(){LmsUi.state.infoItem=Object.assign({kind:'track'},this.store.np);},
    gain:async function(index,event){if(this.saving||this.store.equalizer.status!=='ready')return;var value=Math.max(-12,Math.min(12,Number(event.target.value)));if(!isFinite(value))return;var settings=JSON.parse(JSON.stringify(this.store.equalizer.settings));if(!settings.Client||!settings.Client.Filters[index])return;settings.Client.Filters[index].Gain=value;this.saving=true;try{await LmsStore.saveEqualizer(settings);}finally{this.saving=false;}},
    load:async function(){var token=++this.token,id=this.store.np.id,pid=this.store.playerId;this.song=null;this.error=false;if(id==null){this.loading=false;return;}this.loading=true;try{var s=await LmsApi.songInfo(pid,id);if(token===this.token)this.song=s;}catch(e){if(token===this.token)this.error=true;}finally{if(token===this.token)this.loading=false;}}
  },
  watch:{'store.np.id':function(){this.load();},'store.playerId':function(){this.load();}},created:function(){this.load();},beforeDestroy:function(){this.token++;}
});

/* Collection scans publish a safe partial summary, then commit a completed
   snapshot keyed by LMS lastscan. Opening Collection remains cache-only. */
Vue.component('lms-collection', {
  template: `<section class="collection-screen scroller" :class="{'collection-editing': editing}">
  <section v-if="!hasSnapshot && !scanning && cacheFreshness === 'empty'" class="collection-empty" role="status"><span class="collection-empty-icon" aria-hidden="true">▥</span><h3>{{ tr('Collection is not prepared yet') }}</h3><p>{{ tr('Scan your music folders to build collection statistics.') }}</p><button type="button" @click="refresh">{{ tr('Scan folders') }}</button></section>
  <h3 v-if="hasDisplay" class="collection-section-head">{{ tr('Summary') }}<small v-if="!hasSnapshot"> · {{ tr('Partial results') }}</small></h3>
  <div v-if="hasDisplay" class="collection-summary">
    <button type="button" class="k1" :disabled="!hasSnapshot" @click="openDrill('all','',tr('Albums'))"><strong>{{ albumCount }}</strong><span>{{ tr('Albums') }}</span><small v-if="addedSinceScan !== null">{{ signedDelta(addedSinceScan) }} {{ tr('since last scan') }}</small></button>
    <button type="button" class="k2" :disabled="!hasSnapshot" @click="openDrill('all','',tr('Tracks'))"><strong>{{ displayTrackCount }}</strong><span>{{ tr('Tracks') }}</span><small>{{ hours(totalDuration) }}</small></button>
    <button type="button" class="k3" :disabled="!hasSnapshot" @click="openDrill('all','',tr('Known file sizes'))"><strong>{{ storageLabel }}</strong><span>{{ tr('Known file sizes') }}</span><small>{{ unknownSizes }} {{ tr('Unknown') }}</small></button>
    <button type="button" class="k4" :disabled="!hasSnapshot" @click="openDrill('all','',tr('Genres'))"><strong>{{ groups.genre.length }}</strong><span>{{ tr('Genres') }}</span><small>{{ albumsToTag }} {{ tr('albums untagged') }}</small></button>
    <button type="button" class="k5" :disabled="!hasSnapshot" @click="openDrill('untagged','',tr('Albums to tag'))"><strong>{{ albumsToTag }}</strong><span>{{ tr('Albums to tag') }}</span><small>{{ tr('No genre') }}</small></button>
    <button type="button" class="k6" :disabled="!hasSnapshot" @click="openDrill('lossless','',tr('Lossless tracks'))"><strong>{{ losslessPercent }}%</strong><span>{{ tr('Lossless tracks') }}</span><small>{{ tr('of all tracks') }}</small></button>
  </div>
  <div v-if="hasSnapshot || scanning || error" class="collection-status" :class="{'is-stale': cacheFreshness === 'stale'}" role="status" aria-live="polite">
    <div class="collection-status-main"><span><i class="collection-dot" :class="{busy: scanning,stale:cacheFreshness === 'stale'}" aria-hidden="true"></i>{{ tr(scanning ? (progressTotal === null ? 'Starting collection scan…' : 'Updating collection') : cacheFreshness === 'stale' ? 'Library changed · Update available' : complete ? 'Complete' : 'Partial results') }}<template v-if="!scanning && hasSnapshot"> · {{ rows.length }} {{ tr('Tracks') }}</template></span>
      <button v-if="scanning" type="button" @click="stop">{{ tr('Stop') }}</button><button v-else-if="cacheFreshness === 'stale'" type="button" @click="refresh">{{ tr('Update collection') }}</button><button v-else-if="error" type="button" @click="refresh">{{ tr('Try again') }}</button><button v-else-if="hasSnapshot" type="button" @click="refresh">{{ tr('Scan collection now') }}</button>
      <label class="collection-measure">{{ tr('Measure') }}<select v-model="measure"><option value="albums">{{ tr('Albums') }}</option><option value="tracks">{{ tr('Tracks') }}</option><option value="storage">{{ tr('Storage') }}</option></select></label>
      <span class="collection-status-spacer"></span>
      <button v-if="hasSnapshot" type="button" class="collection-builder-command" :aria-expanded="builder.open?'true':'false'" @click="LmsPlaylistBuilder.open('collection')"><span aria-hidden="true">☷</span>{{ tr('Playlist Builder') }}<small v-if="builder.tracks.length">{{ builder.tracks.length }}</small></button>
      <button v-if="hasSnapshot" type="button" class="collection-edit" :class="{on:editing}" :aria-pressed="editing?'true':'false'" @click="toggleEdit">{{ tr(editing ? 'Done' : 'Edit') }}</button>
    </div>
    <div v-if="scanning" class="collection-scan-progress" :class="{'is-indeterminate':progressTotal === null}" role="progressbar" :aria-label="tr('Collection scan progress')" aria-valuemin="0" :aria-valuemax="progressTotal === null ? undefined : progressTotal" :aria-valuenow="progressTotal === null ? undefined : progressProcessed"><span class="collection-scan-copy"><strong v-if="progressTotal !== null">{{ progressPercent }}%</strong><span>{{ progressProcessed }}<template v-if="progressTotal !== null"> {{ tr('of') }} {{ progressTotal }}</template> {{ tr('tracks') }}</span></span><span class="collection-scan-track"><i :style="{width: progressTotal === null ? '35%' : progressPercent + '%'}"></i></span></div>
    <span class="collection-caveat">{{ tr('Streaming entries are excluded from storage. Missing file sizes are not estimated.') }}</span><p v-if="error">{{ error }}</p></div>
  <div v-if="hasDisplay" class="collection-body">
  <div class="collection-grid" @dragover.prevent="dragOver($event)" @drop.prevent="drop($event)">
    <section class="collection-card collection-graphics-card" data-card="graphics" :class="{dragging:dragging==='graphics'}" :style="dashboardCardStyle('graphics')" :draggable="editing" @dragstart="dragStart('graphics',$event)" @dragend="drop"><header>{{ tr('Collection graphics') }}</header><div class="collection-mini-charts"><article v-for="chart in overviewCharts" :key="chart.id" class="collection-mini-chart" :class="{'metric-active':metricCardActive(chart.id)}"><button type="button" class="collection-chart-title" @click="focusMetricCard(chart.id)"><strong>{{ tr(chart.label) }}</strong><small>{{ chartTotal(chart) }}</small></button><div class="collection-mini-chart-content"><svg class="collection-mini-donut" viewBox="0 0 42 42" role="group" :aria-label="tr(chart.label)+' '+groupSummary(chart.groups)"><circle class="collection-donut-base" cx="21" cy="21" r="15.9155"></circle><circle v-for="(group,index) in chart.groups.slice(0,7)" :key="group.key" class="collection-donut-segment" :class="{on:metricActive(chart.id,index)}" cx="21" cy="21" r="15.9155" pathLength="100" transform="rotate(-90 21 21)" :style="segmentStyle(chart.groups,index)" role="button" tabindex="0" :aria-label="metricLabel(chart,group)" @mouseenter="setMetric(chart.id,index,group.key)" @mouseleave="clearMetric" @focus="setMetric(chart.id,index,group.key)" @blur="clearMetric" @click="openOverviewGroup(chart,group,$event)" @keydown.enter.space.prevent="openOverviewGroup(chart,group,$event)"></circle></svg><span class="collection-chart-keys"><button v-for="(group,index) in chart.groups.slice(0,4)" :key="group.key" type="button" :class="{on:metricActive(chart.id,index)}" :style="{'--collection-color':chartColor(index)}" @mouseenter="setMetric(chart.id,index,group.key)" @mouseleave="clearMetric" @focus="setMetric(chart.id,index,group.key)" @blur="clearMetric" @click="openOverviewGroup(chart,group,$event)"><i aria-hidden="true"></i><span>{{ group.key === '?' ? tr('Unknown') : group.key }}</span><b>{{ percent(group.value,chart.groups) }}%</b></button></span></div></article></div><button v-if="editing" type="button" class="collection-grip" :aria-label="tr('Resize')+' '+tr('Collection graphics')" @pointerdown.stop.prevent="startResize('graphics',$event)" @keydown="resizeKey('graphics',$event)"></button></section>
    <section v-for="card in visibleCards" :key="card.id" class="collection-card" :class="[{dragging:dragging===card.id},{'collection-chart-target':metricCardActive(card.id)}]" :data-card="card.id" :style="dashboardCardStyle(card.id)" :draggable="editing" @dragstart="dragStart(card.id,$event)" @dragend="drop">
      <header>{{ tr(card.label) }}</header>
      <div class="collection-card-body">
        <template v-if="card.id === 'genre'"><button v-for="(group,index) in genreGroups" :key="group.key" type="button" class="collection-bar" :class="{on: isDrill('genre', group.key),'metric-active':metricRowActive('genre',index)}" :style="{'--collection-color':chartColor(index)}" @click="openDrill('genre',group.key,tr('By genre'),$event)"><span>{{ group.key === '?' ? tr('Unknown') : group.key }}</span><span class="collection-gauge"><i :style="{width: percentage(group.value,genreGroups) + '%'}"></i></span><span>{{ measure === 'storage' ? bytes(group.value) : group.value }}</span><span aria-hidden="true">›</span></button><p v-if="!genreGroups.length">{{ tr('Not available') }}</p></template>
        <template v-else><button v-for="(group,index) in groups[card.id]" :key="group.key" type="button" class="collection-bar" :class="{on: isDrill(card.id, group.key),'metric-active':metricRowActive(card.id,index)}" :style="{'--collection-color':chartColor(index)}" @click="openDrill(card.id,group.key,tr(card.label))"><span>{{ group.key === '?' ? tr('Unknown') : group.key }}</span><span class="collection-gauge"><i :style="{width: percentage(group.value,groups[card.id]) + '%'}"></i></span><span>{{ card.id === 'storage' ? bytes(group.value) : group.value }}</span><span aria-hidden="true">›</span></button><p v-if="!groups[card.id].length">{{ tr('Not available') }}</p></template>
      </div>
      <button v-if="editing" type="button" class="collection-grip" :aria-label="tr('Resize')+' '+tr(card.label)" @pointerdown.stop.prevent="startResize(card.id,$event)" @keydown="resizeKey(card.id,$event)"></button>
    </section>
  <aside class="collection-inspector collection-card" data-card="albums" :class="{dragging:dragging==='albums'}" :style="dashboardCardStyle('albums')" :draggable="editing" @dragstart="dragStart('albums',$event)" @dragend="drop"><template v-if="!selected"><header class="collection-empty-card-head">{{ tr('Albums') }}<span>0 {{ tr('selected') }}</span></header><div class="collection-card-empty"><i aria-hidden="true">▧</i><strong>{{ tr('No category selected') }}</strong><small>{{ tr('Choose a genre or decade to see matching albums.') }}</small></div></template><template v-else>
    <div class="collection-inspector-head"><div class="collection-set-heading"><strong>{{ selected.key === '?' ? tr('Unknown') : (selected.key || crumb) }} · {{ tr('albums') }}</strong><span>{{ selectedAlbumCount }} {{ tr('selected') }}</span><button type="button" class="primary" :disabled="actionBusy || !drillActionsReady" @click="addTargetsToBuilder">{{ tr('Add') }}</button><button type="button" :disabled="actionBusy || !drillActionsReady" @click="showTargetsInFolders">{{ tr('Show in Folders') }}</button><button type="button" class="collection-close" :aria-label="tr('Close')" @click="clearDrill">✕</button></div><p>{{ selectedAlbums.length }} {{ tr('Albums') }} · {{ selectedTrackCount }} {{ tr('Tracks') }} · {{ bytes(selectedBytes) }} · {{ hours(selectedDuration) }}</p></div>
    <div v-if="drillPreparing || drillError" class="collection-preparation" :class="{'is-error':drillError}" aria-live="polite"><template v-if="drillPreparing"><div><strong>{{ tr('Preparing') }} {{ selected.key === '?' ? tr('Unknown') : selected.key }}</strong><span>{{ drillProcessed }} {{ tr('of') }} {{ drillTotal }} {{ tr('tracks') }} · {{ drillPercent }}%</span></div><span class="collection-scan-track" role="progressbar" :aria-label="tr('Genre preparation progress')" aria-valuemin="0" :aria-valuemax="drillTotal" :aria-valuenow="drillProcessed"><i :style="{width:drillPercent+'%'}"></i></span><button type="button" @click="cancelDrillPreparation">{{ tr('Cancel') }}</button></template><template v-else><p role="alert">{{ drillError }}</p><button type="button" @click="retryDrill">{{ tr('Try again') }}</button><button type="button" @click="clearDrill">{{ tr('Back to Collection') }}</button></template></div>
    <div v-if="drillListReady" class="collection-selection-guidance" :class="{ready:selectedAlbumCount}" role="status" aria-live="polite"><i aria-hidden="true">{{ selectedAlbumCount ? '✓' : '!' }}</i><span><strong>{{ tr(selectedAlbumCount ? 'Only the selected albums will be used.' : 'Select at least one album') }}</strong><small v-if="!selectedAlbumCount">{{ tr('Choose one or more albums before using the actions below.') }}</small></span></div>
    <div class="collection-selection-bar"><span>{{ selectedAlbumCount + ' ' + tr('of') + ' ' + selectedAlbums.length + ' ' + tr('selected') }}</span><button type="button" :disabled="!drillListReady" @click="toggleAllVisible(true)">{{ tr('Select all') }}</button><button type="button" :disabled="!drillListReady || !selectedAlbumCount" @click="toggleAllVisible(false)">{{ tr('Clear') }}</button></div>
    <div ref="albumList" class="collection-album-list">
      <div v-for="album in selectedAlbums.slice(0,visibleCount)" :key="album.id" class="collection-album"><button type="button" class="collection-check" :class="{on: isAlbumSelected(album.id)}" :aria-pressed="isAlbumSelected(album.id) ? 'true' : 'false'" :aria-label="tr('Select') + ' ' + album.title" @click="selectAlbum(album.id, !isAlbumSelected(album.id))">{{ isAlbumSelected(album.id) ? '✓' : '' }}</button><img class="collection-art" :src="coverUrl(album)" alt="" loading="lazy"><span class="collection-album-text" @click="openAlbum(album)"><strong>{{ album.title }}</strong><small>{{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template> · {{ album.format }} · {{ album.tracks }} {{ tr('tracks') }}</small><code>{{ folderOf(album) }}</code></span><button type="button" class="collection-more" :aria-label="tr('More') + ' ' + album.title" @click="openAlbumActions(album, $event)">⋯</button></div>
      <button v-if="visibleCount<selectedAlbums.length" type="button" @click="visibleCount+=100">{{ tr('Load more') }}</button>
    </div>
    <p class="collection-action-status" role="status">{{ actionMessage }}</p>
    <div class="collection-toolbar" role="toolbar" :aria-label="tr('Album actions')">
      <button type="button" :disabled="actionBusy || !drillActionsReady" @click="playTargets"><i aria-hidden="true">▶</i>{{ tr('Play') }}</button>
    </div>
    </template><button v-if="editing" type="button" class="collection-grip" :aria-label="tr('Resize')+' '+tr('Albums')" @pointerdown.stop.prevent="startResize('albums',$event)" @keydown="resizeKey('albums',$event)"></button>
  </aside>
  <section class="collection-card collection-tracks-card" data-card="tracks" :class="{dragging:dragging==='tracks'}" :style="dashboardCardStyle('tracks')" :draggable="editing" @dragstart="dragStart('tracks',$event)" @dragend="drop"><header>{{ tr('Tracks') }}<span>{{ tr('From selected albums') }}</span><b>{{ selectedTracks.length }}</b></header><div v-if="!selectedAlbumCount" class="collection-card-empty"><i aria-hidden="true">♪</i><strong>{{ tr('Select at least one album') }}</strong><small>{{ tr('Tracks from selected albums will appear here.') }}</small></div><div v-else class="collection-track-list"><button v-for="track in selectedTracks" :key="track.id" type="button" @click="openTrackActions(track,$event)"><i aria-hidden="true">♪</i><span><strong>{{ track.title }}</strong><small>{{ track.artist }}<template v-if="track.album"> · {{ track.album }}</template></small></span><time>{{ duration(track.duration) }}</time></button></div><button v-if="editing" type="button" class="collection-grip" :aria-label="tr('Resize')+' '+tr('Tracks')" @pointerdown.stop.prevent="startResize('tracks',$event)" @keydown="resizeKey('tracks',$event)"></button></section>
  </div>
  <div v-if="drillDialogOpen" class="collection-prepare-backdrop" @click.self="dismissDrillDialog"><section ref="prepareDialog" class="collection-prepare-modal" role="dialog" aria-modal="true" aria-labelledby="collection-prepare-title" tabindex="-1" @keydown.esc.stop.prevent="dismissDrillDialog"><span class="collection-prepare-icon" aria-hidden="true">▥</span><h3 id="collection-prepare-title">{{ tr('Prepare') }} {{ pendingDrillLabel }}?</h3><p>{{ pendingDrillAlbums }} {{ tr('Albums') }} {{ tr('from') }} {{ pendingDrillTracks }} {{ tr('Tracks') }}</p><small>{{ tr('This prepares the album list on this device. Playback and playlists are not changed.') }}</small><div><button type="button" @click="dismissDrillDialog">{{ tr('Cancel') }}</button><button type="button" class="primary" @click="confirmDrill">{{ tr('Prepare and open') }}</button></div></section></div>
  <div v-if="playlistOpen" class="collection-playlist-backdrop" @click.self="playlistOpen=false"><section class="collection-playlist-modal" role="dialog" aria-modal="true" aria-labelledby="collection-playlist-title">
    <div class="collection-modal-nav"><button type="button" @click="playlistOpen=false">{{ tr('Cancel') }}</button><h3 id="collection-playlist-title">{{ tr('Add') }} {{ targetTracks.length }} {{ tr('Tracks') }}</h3><button type="button" class="on" :disabled="actionBusy || (playlistChoice === 'new' && !playlistName.trim())" @click="confirmPlaylist">{{ tr('Add') }}</button></div>
    <h4>{{ tr('Playlists') }}</h4>
    <div class="collection-group"><button v-for="p in playlistList" :key="p.id" type="button" class="collection-cell" @click="playlistChoice = p.id"><i aria-hidden="true">{{ playlistChoice === p.id ? '✓' : '' }}</i><span class="plain">{{ p.name }}</span></button><p v-if="!playlistList.length" class="collection-cell">{{ tr('No playlists yet') }}</p></div>
    <h4>{{ tr('New playlist') }}</h4>
    <div class="collection-group"><label class="collection-cell"><input v-model="playlistName" type="text" :placeholder="tr('Playlist name')" @focus="playlistChoice = 'new'" @keydown.enter.prevent="confirmPlaylist"></label></div>
    <h4>{{ tr('Or') }}</h4>
    <div class="collection-group"><button type="button" class="collection-cell" @click="playlistChoice = 'queue'; confirmPlaylist()"><span>{{ tr('Add to Current Queue') }}</span></button></div>
  </section></div>
  </div>
  <details class="collection-timings"><summary>{{ tr('Loading performance') }}</summary><p>{{ tr('First usable results') }}: {{ displayFirstMs === null ? tr('Not measured') : displayFirstMs + ' ms' }}</p><p>{{ tr('Complete collection') }}: {{ completeMs === null ? tr('Not measured') : completeMs + ' ms' }}</p><p>{{ tr('Network requests') }}: {{ networkMs === null ? tr('Not measured') : networkMs + ' ms' }}</p><p>{{ tr('Aggregation') }}: {{ aggregationMs === null ? tr('Not measured') : aggregationMs + ' ms' }}</p><p>{{ tr('Cache write') }}: {{ cacheMs === null ? tr('Not measured') : cacheMs + ' ms' }}</p><p>{{ tr('Render ready') }}: {{ renderMs === null ? tr('Not measured') : renderMs + ' ms' }}</p></details>
</section>`,
  data: function () { var builderApi=window.LmsPlaylistBuilder||{state:{open:false,tracks:[]},open:function(){},offerCollectionSet:function(){}};return { rows: [], offset: 0, total: null, lastscan: '', busy: false, collectionCache: LmsCollectionCache.state, builder: builderApi.state, LmsPlaylistBuilder:builderApi, complete: false, error: '', token: 0, selected: null, selectedAlbumIds: {}, visibleCount: 100, firstMs: null, completeMs: null, networkMs: null, aggregationMs: null, cacheMs: null, renderMs: null, started: 0, measure: 'albums', playlistOpen: false, playlistName: '', playlistList: [], playlistChoice: null, actionBusy: false, actionMessage: '', previousAlbumCount: null,
    editing: false, dragging: null, activeMetric: null, crumb: '', pendingDrill: null, drillDialogOpen: false, drillOrigin: null, drillPreparing: false, drillReady: true, drillProcessed: 0, drillTotal: 0, drillAlbums: [], drillRows: [], drillError: '', drillToken: 0,
    cardLabels: { graphics: 'Collection graphics', genre: 'By genre', albums: 'Albums', size: 'Album file size', decade: 'Decades', tracks: 'Tracks', format: 'Album file type' } }; },
  computed: {
    hasSnapshot: function () { return !!(this.complete && this.lastscan); },
    partialStats: function () { return !this.hasSnapshot ? this.collectionCache.partialStats : null; },
    hasDisplay: function () { return this.hasSnapshot || !!this.partialStats; },
    displayTrackCount: function () { return this.partialStats ? this.partialStats.trackCount : this.rows.length; },
    displayFirstMs: function () { return this.firstMs == null ? this.collectionCache.partialFirstMs : this.firstMs; },
    cacheFreshness: function () { return this.collectionCache.freshness || (this.hasSnapshot ? 'current' : 'empty'); },
    scanning: function () { return this.busy || this.collectionCache.busy; },
    progressProcessed: function () { return this.collectionCache.busy ? this.collectionCache.processed : this.rows.length; },
    progressTotal: function () { return this.collectionCache.busy ? this.collectionCache.total : this.total; },
    progressPercent: function () { return this.progressTotal ? Math.min(100, Math.round(100 * this.progressProcessed / this.progressTotal)) : 35; },
    albumMap: function () { var out = Object.create(null); this.rows.forEach(function (r) { if (r.albumId == null) return; var key = String(r.albumId), a = out[key] || (out[key] = { id: r.albumId, title: r.album || String(r.albumId), artist: r.artist, bytes: 0, known: true, local: false, tracks: 0, duration: 0, year: null, url: '', format: '', coverId: null }); a.tracks++; a.duration += r.duration || 0; if (a.year == null && r.year) a.year = r.year; if (!a.format && r.format) a.format = r.format; if (a.coverId == null && r.coverId) a.coverId = r.coverId; if (!r.remote) { a.local = true; if (!a.url && r.url) a.url = r.url; if (r.fileSize == null) a.known = false; else a.bytes += r.fileSize; } }); return out; },
    albumCount: function () { return this.partialStats ? this.partialStats.albumCount : Object.keys(this.albumMap).length; },
    unknownSizes: function () { return this.partialStats ? this.partialStats.unknownSizes : this.rows.filter(function (r) { return !r.remote && r.fileSize == null; }).length; },
    storageLabel: function () { if (this.partialStats) return this.partialStats.storageBytes ? this.bytes(this.partialStats.storageBytes) : this.tr('Not available'); var known = this.rows.filter(function (r) { return !r.remote && r.fileSize != null; }); return known.length ? this.bytes(known.reduce(function (sum, r) { return sum + r.fileSize; }, 0)) : this.tr('Not available'); },
    albumsToTag: function () { if (this.partialStats) return this.partialStats.albumsToTag; var self = this, ids = Object.create(null); this.rows.forEach(function (r) { if (r.albumId != null && self.untagged(r)) ids[String(r.albumId)] = true; }); return Object.keys(ids).length; },
    losslessPercent: function () { if (this.partialStats) return this.partialStats.losslessPercent; var self = this, n = this.rows.filter(function (r) { return self.isLosslessFormat(r.format); }).length; return this.rows.length ? Math.round(100 * n / this.rows.length) : 0; },
    totalDuration: function () { return this.partialStats ? this.partialStats.totalDuration : this.rows.reduce(function (sum, r) { return sum + (r.duration || 0); }, 0); },
    addedSinceScan: function () { return this.previousAlbumCount == null ? null : this.albumCount - this.previousAlbumCount; },
    groups: function () { if (this.partialStats) return this.partialStats.groups; var buckets = { genre: Object.create(null), format: Object.create(null), storage: Object.create(null), size: Object.create(null), decade: Object.create(null) };
      this.rows.forEach(function (r) { var genre = r.genre || '?', format = r.format || '?'; buckets.genre[genre] = (buckets.genre[genre] || 0) + 1; buckets.format[format] = (buckets.format[format] || 0) + 1; if (!r.remote && r.fileSize != null) buckets.storage[format] = (buckets.storage[format] || 0) + r.fileSize; });
      Object.keys(this.albumMap).forEach(function (key) { var a = this.albumMap[key]; var decade = this.decadeOf(a); buckets.decade[decade] = (buckets.decade[decade] || 0) + 1; if (!a.local) return; var band = this.sizeBand(a); buckets.size[band] = (buckets.size[band] || 0) + 1; }, this);
      Object.keys(buckets).forEach(function (kind) { buckets[kind] = Object.keys(buckets[kind]).map(function (key) { return { key: key, value: buckets[kind][key] }; }).sort(function (a, b) { return b.value - a.value; }); }); return buckets;
    },
    layout: function () { return LmsLibraryDisplay.state.dashboard; },
    visibleCards: function () { var self=this,details=['genre','decade','size','format'];return this.layout.order.filter(function(id){return details.indexOf(id)>=0;}).map(function(id){return {id:id,label:self.cardLabels[id]};}); },
    hiddenCards: function () { var self = this; return this.layout.order.filter(function (id) { return self.layout.hidden.indexOf(id) >= 0; }).map(function (id) { return { id: id, label: self.cardLabels[id] }; }); },
    genreGroups: function () { if (this.partialStats) return this.measure === 'storage' ? this.partialStats.genreStorage : this.measure === 'tracks' ? this.partialStats.genreTracks : this.partialStats.genreAlbums; var self = this, buckets = Object.create(null); this.rows.forEach(function (r) { var key = r.genre || '?', value = self.measure === 'storage' ? (!r.remote && r.fileSize != null ? r.fileSize : 0) : 1; if (self.measure === 'albums') { if (!buckets[key]) buckets[key] = Object.create(null); if (r.albumId != null) buckets[key][r.albumId] = true; } else buckets[key] = (buckets[key] || 0) + value; }); return Object.keys(buckets).map(function (key) { return { key:key, value:self.measure === 'albums' ? Object.keys(buckets[key]).length : buckets[key] }; }).sort(function (a,b) { return b.value-a.value; }); },
    formatGroups: function () { return this.groups.format; },
    donutStyle: function () { var total=this.formatGroups.reduce(function(sum,g){return sum+g.value;},0), at=0, self=this; return 'conic-gradient(' + this.formatGroups.map(function(g,i){var from=100*at/total;at+=g.value;return self.chartColor(i)+' '+from+'% '+(100*at/total)+'%';}).join(',') + ')'; },
    formatSummary: function () { var self=this; return this.formatGroups.map(function(g){return g.key+' '+self.percent(g.value,self.formatGroups)+'%';}).join(', '); },
    overviewCharts: function () { return [{id:'format',label:'Album file type',groups:this.groups.format},{id:'genre',label:'By genre',groups:this.genreGroups},{id:'decade',label:'Decades',groups:this.groups.decade},{id:'size',label:'Album file size',groups:this.groups.size}]; },
    selectedAlbums: function () { if (!this.selected) return []; if (this.selected.kind === 'genre' && (this.drillPreparing || (this.drillReady && this.drillTotal > 0))) return this.drillAlbums; var self = this, ids = Object.create(null), out = []; this.rows.forEach(function (r) { if (r.albumId == null) return; var key = String(r.albumId), a = self.albumMap[key]; if (!a || ids[key]) return; if (self.matchesDrill(r, a)) { ids[key] = true; out.push(a); } }); return out.sort(function (a, b) { return String(a.artist || '').localeCompare(String(b.artist || '')) || String(a.title).localeCompare(String(b.title)); }); },
    selectedAlbumCount: function () { return Object.keys(this.selectedAlbumIds).filter(function (key) { return this.selectedAlbumIds[key]; }, this).length; },
    allVisibleSelected: function () { var self=this,list=this.selectedAlbums.slice(0,this.visibleCount);return !!list.length&&list.every(function(album){return !!self.selectedAlbumIds[String(album.id)];}); },
    selectedTracks: function () { var selected=this.selectedAlbumIds;return this.rows.filter(function(row){return !!selected[String(row.albumId)];}); },
    targetAlbums: function () { if(!this.selected||!this.selectedAlbumCount)return[];var self=this;if(this.selected.kind==='genre'&&this.drillRows.length)return this.selectedAlbums.filter(function(a){return !!self.selectedAlbumIds[String(a.id)];});var ids=Object.create(null),out=[];this.rows.forEach(function(r){if(r.albumId==null)return;var key=String(r.albumId);if(ids[key]||!self.selectedAlbumIds[key])return;var a=self.albumMap[key];if(!a||!self.matchesDrill(r,a))return;ids[key]=true;out.push(a);});return out; },
    targetTracks: function () { var source = this.selected && this.selected.kind === 'genre' && this.drillRows.length ? this.drillRows : this.rows, ids = Object.create(null); this.targetAlbums.forEach(function (a) { ids[String(a.id)] = true; }); return source.filter(function (r) { return !!ids[String(r.albumId)]; }); },
    selectedTrackCount: function () { return this.selectedAlbums.reduce(function (n, a) { return n + a.tracks; }, 0); },
    selectedBytes: function () { return this.selectedAlbums.reduce(function (n, a) { return n + a.bytes; }, 0); },
    selectedDuration: function () { return this.selectedAlbums.reduce(function (n, a) { return n + a.duration; }, 0); },
    drillPercent: function () { return this.drillTotal ? Math.min(100, Math.round(100 * this.drillProcessed / this.drillTotal)) : 0; },
    drillListReady: function () { return !!this.selected && (this.selected.kind !== 'genre' || (this.drillReady && !this.drillPreparing && !this.drillError)); },
    drillActionsReady: function () { return this.drillListReady && this.selectedAlbumCount > 0; },
    pendingDrillLabel: function () { var p = this.pendingDrill; return !p ? '' : p.key === '?' ? this.tr('Unknown') : p.key; },
    pendingDrillTracks: function () { var p=this.pendingDrill;if(!p)return 0;var g=this.groups.genre.filter(function(x){return x.key===p.key;})[0];return g?g.value:0; },
    pendingDrillAlbums: function () { var p=this.pendingDrill;if(!p)return 0;var ids=Object.create(null);this.rows.forEach(function(r){if((r.genre||'?')===p.key&&r.albumId!=null)ids[String(r.albumId)]=true;});return Object.keys(ids).length; }
  },
  methods: {
    tr: function (s) { return window.LmsStr ? LmsStr.t(s) : s; },
    donutFor: function (groups) { var total=(groups||[]).reduce(function(sum,g){return sum+g.value;},0),at=0,self=this;if(!total)return 'var(--field)';return 'conic-gradient('+groups.slice(0,7).map(function(g,i){var from=100*at/total;at+=g.value;return self.chartColor(i)+' '+from+'% '+(100*at/total)+'%';}).join(',')+')'; },
    groupSummary: function (groups) { var self=this;return (groups||[]).slice(0,3).map(function(g){return (g.key==='?'?self.tr('Unknown'):g.key)+' '+self.percent(g.value,groups)+'%';}).join(' · '); },
    duration: function (seconds) { seconds=Math.max(0,Number(seconds)||0);return Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'); },
    bytes: function (n) { if (n < 1024) return n + ' B'; var units = ['KB', 'MB', 'GB', 'TB'], i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < 3); return n.toFixed(1) + ' ' + units[i]; },
    sizeBand: function (a) { return !a.known ? '?' : a.bytes < 250e6 ? '< 250 MB' : a.bytes < 500e6 ? '250–500 MB' : a.bytes < 1e9 ? '500 MB–1 GB' : '> 1 GB'; },
    untagged: function (r) { return !r.genre || /^no genre$/i.test(r.genre); },
    isLosslessFormat: function (format) { return /^(dsd|dsf|dff)/i.test(String(format || '')) || (window.LmsFmt && LmsFmt.isLossless(String(format || '').toLowerCase())); },
    decadeOf: function (album) { return album.year ? (Math.floor(album.year / 10) * 10) + 's' : '?'; },
    matchesDrill: function (r, a) { var s = this.selected, k = s.key; switch (s.kind) {
      case 'all': return true; case 'untagged': return this.untagged(r); case 'lossless': return this.isLosslessFormat(r.format);
      case 'genre': return (r.genre || '?') === k; case 'format': return (r.format || '?') === k;
      case 'storage': return (r.format || '?') === k && !r.remote; case 'size': return a.local && this.sizeBand(a) === k;
      case 'decade': return this.decadeOf(a) === k; } return false; },
    percentage: function (n, groupList) { return 100 * n / Math.max.apply(Math, groupList.map(function (g) { return g.value; }).concat([1])); },
    percent: function (n, groupList) { var total=groupList.reduce(function(sum,g){return sum+g.value;},0); return total ? Math.round(100*n/total) : 0; },
    snapshot: function () { return { rows: this.rows, offset: this.offset, total: this.total, lastscan: this.lastscan, complete: this.complete, error: this.error, cachedAt: Date.now(), firstMs: this.firstMs, completeMs: this.completeMs }; },
    remember: function () { var value = this.snapshot(); LmsLibraryDisplay.state.collection = value; if (value.complete && value.lastscan) LmsLibraryDisplay.cacheCollection(value); },
    restore: function (lastscan) { var c = LmsLibraryDisplay.state.collection; if (!c || (lastscan && c.lastscan !== lastscan)) return false; this.rows = c.rows || []; this.offset = c.offset || 0; this.total = c.total == null ? null : c.total; this.lastscan = c.lastscan || ''; this.complete = !!c.complete; this.error = c.error || ''; this.firstMs = c.firstMs == null ? null : c.firstMs; this.completeMs = c.completeMs == null ? null : c.completeMs; this.networkMs = c.networkMs == null ? null : c.networkMs; this.aggregationMs = c.aggregationMs == null ? null : c.aggregationMs; this.cacheMs = c.cacheMs == null ? null : c.cacheMs; return true; },
    stop: function () { if (this.collectionCache.busy) LmsCollectionCache.cancel(); this.token++; this.busy = false; if (this.complete) this.remember(); },
    applySnapshot: function (snapshot) { if (snapshot && this.rows.length) this.previousAlbumCount = this.albumCount; if (!snapshot) return false; var changed=this.lastscan&&this.lastscan!==snapshot.lastscan;LmsLibraryDisplay.state.collection = snapshot;var restored=this.restore(snapshot.lastscan);if(changed)this.resetDrillPreparation();return restored; },
    rebuild: function () { return this.refresh(); },
    refresh: async function () { this.error = ''; try { var snapshot=await LmsCollectionCache.rebuild(),renderStarted=Date.now();this.applySnapshot(snapshot);await this.$nextTick();await new Promise(function(resolve){requestAnimationFrame(function(){requestAnimationFrame(resolve);});});this.renderMs=Date.now()-renderStarted; } catch (e) { if (!/cancelled/i.test(String(e&&e.message||''))) this.error = this.tr('Collection could not be loaded. Your previous collection is still available.'); } },
    activate: async function () { this.error = ''; try { var snapshot=await LmsCollectionCache.inspect();if(snapshot)this.applySnapshot(snapshot); } catch (e) { this.error = this.tr('Collection could not be loaded. Retry when LMS is available.'); } },
    scan: function () { return this.refresh(); },
    chartColor: function (index) { return ['#c83d31','#c98012','#087fb2','#238f74','#725aa7','#a85a73','#477d9b'][index % 7]; },
    chartTotal: function (chart) { return chart.id === 'format' ? this.rows.length+' '+this.tr('tracks') : chart.id === 'size' ? this.storageLabel : this.albumCount+' '+this.tr('albums'); },
    metricLabel: function (chart, group) { return (group.key === '?' ? this.tr('Unknown') : group.key)+' '+this.percent(group.value,chart.groups)+'%'; },
    segmentStyle: function (groups, index) { var total=(groups||[]).reduce(function(sum,g){return sum+g.value;},0),before=(groups||[]).slice(0,index).reduce(function(sum,g){return sum+g.value;},0),value=groups[index]&&groups[index].value||0,pct=total?100*value/total:0,offset=total?-100*before/total:0;return {stroke:this.chartColor(index),strokeDasharray:pct+' '+(100-pct),strokeDashoffset:offset}; },
    setMetric: function (kind, index, key) { this.activeMetric={kind:kind,index:index,key:key}; },
    clearMetric: function () { this.activeMetric=null; },
    metricActive: function (kind, index) { return !!this.activeMetric&&this.activeMetric.kind===kind&&this.activeMetric.index===index; },
    metricCardActive: function (kind) { return !!this.activeMetric&&this.activeMetric.kind===kind; },
    metricRowActive: function (kind, index) { return this.metricActive(kind,index); },
    focusMetricCard: function (kind) { var self=this;this.$nextTick(function(){var root=self.$el&&self.$el.querySelector?self.$el:null,card=root&&root.querySelector('[data-card="'+kind+'"]');if(card){if(card.scrollIntoView)card.scrollIntoView({behavior:'smooth',block:'nearest'});if(card.focus)card.focus({preventScroll:true});card.classList&&card.classList.add('collection-chart-target');setTimeout(function(){card.classList&&card.classList.remove('collection-chart-target');},900);}}); },
    openOverviewGroup: function (chart, group, event) { this.setMetric(chart.id,chart.groups.indexOf(group),group.key);this.focusMetricCard(chart.id);this.openDrill(chart.id,group.key,this.tr(chart.label),event); },
    signedDelta: function (n) { return (n >= 0 ? '+' : '') + n; },
    hours: function (seconds) { var h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60); return h + ' ' + this.tr('h') + ' ' + m + ' ' + this.tr('min'); },
    cardStyle: function (card) { return { '--w': card.w, '--h': card.h }; },
    dashboardCardStyle: function (id) { var size=this.layout.size[id]||[6,4],at=this.layout.order.indexOf(id);return {'--w':size[0],'--h':size[1],order:at<0?99:at}; },
    isDrill: function (kind, key) { return !!this.selected && this.selected.kind === kind && this.selected.key === key; },
    openDrill: function (kind, key, crumb, event) { if(this.partialStats)return;if(kind!=='genre'){this.drill(kind,key);this.crumb=crumb||'';return;}var cached=LmsCollectionCache.prepared(this.lastscan,kind,key);this.crumb=crumb||'';if(cached){this.drill(kind,key);this.applyPreparedDrill(cached);return;}this.pendingDrill={kind:kind,key:key,crumb:crumb||''};this.drillOrigin=event&&event.currentTarget||null;this.drillDialogOpen=true;var self=this;this.$nextTick(function(){if(self.$refs&&self.$refs.prepareDialog&&self.$refs.prepareDialog.focus)self.$refs.prepareDialog.focus();}); },
    toggleEdit: function () { this.editing = !this.editing; this.dragging = null; this.$emit('editing-change', this.editing); },
    saveLayout: function (partial) { LmsLibraryDisplay.setDashboard(partial); },
    hideCard: function (id) { if (this.layout.hidden.indexOf(id) < 0) this.saveLayout({ hidden: this.layout.hidden.concat([id]) }); },
    showCard: function (id) { this.saveLayout({ hidden: this.layout.hidden.filter(function (k) { return k !== id; }) }); },
    moveCard: function (id, beforeId) { var order = this.layout.order.filter(function (k) { return k !== id; }); var at = beforeId ? order.indexOf(beforeId) : -1; if (at < 0) order.push(id); else order.splice(at, 0, id); this.saveLayout({ order: order }); },
    resizeCard: function (id, w, h) { var size = {}; size[id] = [w, h]; this.saveLayout({ size: size }); },
    dragStart: function (id, event) { if (!this.editing) return; this.dragging = id; if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); } },
    dragOver: function (event) { if (!this.dragging) return; var target = event.target.closest ? event.target.closest('.collection-card') : null; if (!target) return; var id = target.getAttribute('data-card'); if (id === this.dragging) return; var rect = target.getBoundingClientRect(), after = event.clientX - rect.left > rect.width / 2, order = this.layout.order, next = after ? order[order.indexOf(id) + 1] || null : id; if (next === this.dragging) return; this.moveCard(this.dragging, next); },
    drop: function () { this.dragging = null; },
    reorderKey: function (id, event) { var order = this.layout.order, i = order.indexOf(id); if (event.altKey && event.key === 'ArrowLeft' && i > 0) { event.preventDefault(); this.moveCard(id, order[i - 1]); } else if (event.altKey && event.key === 'ArrowRight' && i < order.length - 1) { event.preventDefault(); this.moveCard(id, order[i + 2] || null); } },
    resizeKey: function (id, event) { if (!event.altKey || !event.shiftKey) return; var s = this.layout.size[id], d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (!d) return; event.preventDefault(); this.resizeCard(id, s[0] + d[0], s[1] + d[1]); },
    startResize: function (id, event) { var self = this, s = this.layout.size[id], grid = event.target.closest('.collection-grid'), gridWidth=(grid&&grid.clientWidth)||(grid&&grid.parentElement&&grid.parentElement.clientWidth)||0, col = (gridWidth + 14) / 12, row = 64 + 14, x0 = event.clientX, y0 = event.clientY;
      function move(ev) { self.resizeCard(id, s[0] + Math.round((ev.clientX - x0) / col), s[1] + Math.round((ev.clientY - y0) / row)); }
      function up() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); },
    openMusicFolders: function () { LmsUi.setTab('music'); LmsUi.setMusicView('musicfolders'); LmsNav.reset('music'); },
    drill: function (kind, key) { this.selected = { kind: kind, key: key }; this.selectedAlbumIds = {}; this.visibleCount = 100; this.playlistName = (key === '?' ? this.tr('Unknown') : key) + ' ' + this.tr('Collection'); this.actionMessage = '';this.drillReady=true;this.drillError=''; },
    resetDrillPreparation: function () { this.drillToken++;this.drillPreparing=false;this.drillReady=true;this.drillProcessed=0;this.drillTotal=0;this.drillAlbums=[];this.drillRows=[];this.drillError='';this.pendingDrill=null;this.drillDialogOpen=false; },
    dismissDrillDialog: function () { this.drillDialogOpen=false;this.pendingDrill=null;var origin=this.drillOrigin;this.drillOrigin=null;if(origin&&origin.focus)this.$nextTick(function(){origin.focus();}); },
    applyPreparedDrill: function (value) { this.drillAlbums=value.albums||[];this.drillRows=value.rows||[];this.drillProcessed=value.processed==null?this.rows.length:value.processed;this.drillTotal=value.total==null?this.rows.length:value.total;this.drillPreparing=false;this.drillReady=true;this.drillError=''; },
    addPreparedRow: function (map, row) { if(row.albumId==null)return;var key=String(row.albumId),a=map[key]||(map[key]={id:row.albumId,title:row.album||String(row.albumId),artist:row.artist,bytes:0,known:true,local:false,tracks:0,duration:0,year:null,url:'',format:'',coverId:null});a.tracks++;a.duration+=row.duration||0;if(a.year==null&&row.year)a.year=row.year;if(!a.format&&row.format)a.format=row.format;if(a.coverId==null&&row.coverId)a.coverId=row.coverId;if(!row.remote){a.local=true;if(!a.url&&row.url)a.url=row.url;if(row.fileSize==null)a.known=false;else a.bytes+=row.fileSize;} },
    confirmDrill: async function () { var p=this.pendingDrill;if(!p)return;this.drillDialogOpen=false;this.pendingDrill=null;this.drill(p.kind,p.key);this.crumb=p.crumb;this.drillReady=false;this.drillPreparing=true;this.drillProcessed=0;this.drillTotal=this.rows.length;this.drillAlbums=[];this.drillRows=[];this.drillError='';var token=++this.drillToken,map=Object.create(null),matches=[];try{await this.$nextTick();await new Promise(function(resolve){setTimeout(resolve,0);});for(var start=0;start<this.rows.length;start+=750){if(token!==this.drillToken)return;var end=Math.min(start+750,this.rows.length);for(var i=start;i<end;i++){var row=this.rows[i];if((row.genre||'?')===p.key){matches.push(row);this.addPreparedRow(map,row);}}this.drillProcessed=end;await new Promise(function(resolve){setTimeout(resolve,0);});}if(token!==this.drillToken)return;this.drillRows=matches;this.drillAlbums=Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return String(a.artist||'').localeCompare(String(b.artist||''))||String(a.title).localeCompare(String(b.title));});this.drillPreparing=false;this.drillReady=true;var value={albums:this.drillAlbums.slice(),rows:this.drillRows.slice(),processed:this.drillProcessed,total:this.drillTotal};LmsCollectionCache.cachePrepared(this.lastscan,p.kind,p.key,value);this.actionMessage=(p.key==='?'?this.tr('Unknown'):p.key)+' '+this.tr('is ready');}catch(e){if(token===this.drillToken){this.drillPreparing=false;this.drillReady=false;this.drillError=this.tr('This genre could not be prepared.');}} },
    retryDrill: function () { if(!this.selected)return;this.pendingDrill={kind:this.selected.kind,key:this.selected.key,crumb:this.crumb};return this.confirmDrill(); },
    cancelDrillPreparation: function () { this.drillToken++;this.drillPreparing=false;this.drillReady=false;this.selected=null;this.drillAlbums=[];this.drillRows=[];this.actionMessage=''; },
    clearDrill: function () { this.drillToken++;this.drillPreparing=false;this.selected=null;this.selectedAlbumIds={};this.playlistOpen=false;this.actionMessage='';this.drillAlbums=[];this.drillRows=[];this.drillError='';LmsLibraryDisplay.state.collectionReturn=null; },
    isAlbumSelected: function (id) { return !!this.selectedAlbumIds[String(id)]; },
    selectAlbum: function (id, value) { if (value) Vue.set(this.selectedAlbumIds,String(id),true); else Vue.delete(this.selectedAlbumIds,String(id)); },
    toggleAllVisible: function (value) { var self=this;this.selectedAlbums.slice(0,this.visibleCount).forEach(function(album){self.selectAlbum(album.id,value);}); },
    uniquePlaylistName: async function (requested) { var list=await LmsApi.playlists(0,500),used=Object.create(null),base=requested.trim(),name=base,n=2;list.forEach(function(p){used[String(p.name||'').toLowerCase()]=true;});while(used[name.toLowerCase()])name=base+' '+n++;return name; },
    openAlbum: function (album) { LmsUi.setTab('music'); LmsNav.push('music', { kind: 'album', id: album.id, label: album.title, album: { id: album.id, title: album.title, artist: album.artist } }); },
    pid: function () { return (window.LmsStore && LmsStore.state && LmsStore.state.playerId) || ''; },
    coverUrl: function (album) { return window.LmsFmt && LmsFmt.coverUrl ? LmsFmt.coverUrl(album && album.coverId, 80) : ''; },
    folderOf: function (album) { return album.url ? LmsApi.commonDirectory([album.url]) : ''; },
    run: async function (work, okMessage, failMessage) { if (this.actionBusy) return; this.actionBusy = true; this.actionMessage = ''; try { await work(); this.actionMessage = okMessage; } catch (e) { this.actionMessage = failMessage; } finally { this.actionBusy = false; } },
    playTargets: function () { var self = this, albums = this.targetAlbums; if (!this.drillActionsReady || !albums.length) return Promise.resolve(); return this.run(async function () { await LmsApi.loadContainer(self.pid(), 'album_id', albums[0].id); for (var i = 1; i < albums.length; i++) await LmsApi.queueControl(self.pid(), 'add', 'album_id', albums[i].id); }, this.tr('Playing selection.'), this.tr('Could not start playback.')); },
    playNext: function (album) { var self = this; return this.run(function () { return LmsApi.queueControl(self.pid(), 'insert', 'album_id', album.id); }, this.tr('Playing next.'), this.tr('Could not queue the album.')); },
    openAlbumActions: function (album, event) { LmsUi.openActions({ kind: 'album', id: album.id, title: album.title, sub: album.artist, folderUrl: album.url || '' }, event && event.currentTarget); },
    openTrackActions: function (track, event) { LmsUi.openActions({ kind:'track', id:track.id, title:track.title, sub:[track.artist,track.album].filter(Boolean).join(' · '), folderUrl:track.url||'' }, event&&event.currentTarget); },
    returnSnapshot: function () { return { selected:this.selected&&{kind:this.selected.kind,key:this.selected.key},selectedAlbumIds:Object.assign({},this.selectedAlbumIds),visibleCount:this.visibleCount,crumb:this.crumb,drillAlbums:this.drillAlbums.slice(),drillRows:this.drillRows.slice(),drillReady:this.drillReady,drillProcessed:this.drillProcessed,drillTotal:this.drillTotal,scrollTop:this.$refs&&this.$refs.albumList?this.$refs.albumList.scrollTop:0 }; },
    restoreReturnSnapshot: function () { var saved=LmsLibraryDisplay.state.collectionReturn;if(!saved||!saved.selected)return false;this.selected={kind:saved.selected.kind,key:saved.selected.key};this.selectedAlbumIds=Object.assign({},saved.selectedAlbumIds||{});this.visibleCount=saved.visibleCount||100;this.crumb=saved.crumb||'';this.drillAlbums=(saved.drillAlbums||[]).slice();this.drillRows=(saved.drillRows||[]).slice();this.drillReady=saved.drillReady!==false;this.drillPreparing=false;this.drillProcessed=saved.drillProcessed||0;this.drillTotal=saved.drillTotal||0;this.drillError='';LmsLibraryDisplay.state.collectionReturn=null;var self=this;this.$nextTick(function(){if(self.$refs&&self.$refs.albumList)self.$refs.albumList.scrollTop=saved.scrollTop||0;});return true; },
    showTargetsInFolders: async function () { if(!this.drillActionsReady)return;var albums=this.targetAlbums.filter(function(a){return !!a.url;});this.actionMessage='';if(!albums.length){this.actionMessage=this.tr('Folder not found in Music folders');return;}LmsLibraryDisplay.state.collectionReturn=this.returnSnapshot();var result=await LmsUi.showInMusicFoldersMany(albums.map(function(a){return {url:a.url,label:a.title,albumId:a.id};}));if(!result||!result.opened){LmsLibraryDisplay.state.collectionReturn=null;this.actionMessage=this.tr('Folder not found in Music folders');} },
    addTargetsToBuilder: function () { if(!this.drillActionsReady)return;var label=(this.selected&&this.selected.key&&this.selected.key!=='?'?this.selected.key:this.crumb)+' '+this.tr('Collection');LmsPlaylistBuilder.offerCollectionSet(this.targetTracks.map(function(track){return {id:track.id,title:track.title,artist:track.artist,album:track.album,url:track.url,path:track.url,duration:track.duration};}),label);this.actionMessage=this.tr('Selection sent to Playlist Builder.'); },
    openPlaylistModal: async function () { if(!this.drillActionsReady)return;this.playlistChoice = null; this.playlistName = (this.selected && this.selected.key && this.selected.key !== '?' ? this.selected.key : this.crumb) + ' ' + this.tr('Collection'); this.playlistOpen = true; try { this.playlistList = await LmsApi.playlists(0, 500); } catch (e) { this.playlistList = []; } },
    confirmPlaylist: function () { var self = this, choice = this.playlistChoice, tracks = this.targetTracks, albums = this.targetAlbums; if (choice == null || !tracks.length) return Promise.resolve(); return this.run(async function () {
      if (choice === 'queue') { for (var q = 0; q < albums.length; q++) await LmsApi.queueControl(self.pid(), 'add', 'album_id', albums[q].id); return; }
      var id = choice;
      if (choice === 'new') { var used = Object.create(null); (self.playlistList || []).forEach(function (p) { used[String(p.name || '').toLowerCase()] = true; }); var base = self.playlistName.trim(), name = base, n = 2; while (used[name.toLowerCase()]) name = base + ' ' + n++; var created = await LmsApi.createPlaylist(name); if (created.id == null) throw new Error('playlist'); id = created.id; self.playlistName = name; }
      for (var i = 0; i < tracks.length; i++) await LmsApi.editPlaylist(id, 'add', { title: tracks[i].title, url: tracks[i].url });
      self.playlistOpen = false; }, this.tr('Added to playlist.'), this.tr('Could not add to playlist.')); }
  },
  mounted: function () { this.restoreReturnSnapshot();this.activate(); }, beforeDestroy: function () { if(this.selected)LmsLibraryDisplay.state.collectionReturn=this.returnSnapshot();this.stop(); }
});
