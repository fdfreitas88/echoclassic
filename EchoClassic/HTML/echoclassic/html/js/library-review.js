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
  var state = Vue.observable({ preferences: {}, orders: {}, positions: {}, context: null, albumSide: saved.albumSide === 'right' ? 'right' : 'left', panel: ['album', 'eq', 'signal'], hidden: [], collection: null });
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
  function persist() { try { localStorage.setItem('echoclassic.library-display.v1', JSON.stringify({ preferences: state.preferences, orders: state.orders, positions: state.positions, albumSide: state.albumSide, panel: state.panel, hidden: state.hidden })); } catch (e) {} }
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
  function open(context) {
    state.context = context || null;
    LmsUi.setTab('settings'); LmsUi.state.appearanceScreen = 'album-information';
    LmsNav.push('settings', { label: 'Album information', screen: 'album-information' });
  }
  global.LmsLibraryDisplay = { state: state, resolve: resolve, resolveOrder: resolveOrder, resolvePositions: resolvePositions, keys: keys, set: set, open: open,
    setOrder: function (key, order) { Vue.set(state.orders, key, cleanOrder(order)); persist(); },
    setPosition: function (scope, field, position) { if (!Object.prototype.hasOwnProperty.call(defaultPositions, field) || ['left', 'right', 'hidden'].indexOf(position) < 0) return; var next = Object.assign({}, state.positions[scope] || {}); next[field] = position; Vue.set(state.positions, scope, next); set(scope, field, position !== 'hidden'); persist(); },
    setAlbumSide: function (side) { if (side !== 'left' && side !== 'right') return; state.albumSide = side; persist(); },
    reset: function (key) { Vue.delete(state.preferences, key); Vue.delete(state.orders, key); Vue.delete(state.positions, key); persist(); },
    move: function (index, delta) { var next = index + delta; if (next < 0 || next >= state.panel.length) return; var key = state.panel.splice(index, 1)[0]; state.panel.splice(next, 0, key); persist(); },
    show: function (key, visible) { var i = state.hidden.indexOf(key); if (visible && i >= 0) state.hidden.splice(i, 1); else if (!visible && i < 0) state.hidden.push(key); persist(); },
    cacheCollection: writeCollectionCache, loadCollectionCache: readCollectionCache
  };
})(window);

/* The collection index is a browser-side derivative of the LMS library. It is
   built once, stored in IndexedDB, and rebuilt only when LMS changes lastscan
   or the user explicitly requests it. The timer detects completed LMS scans
   even while the Collection screen is closed. */
(function (global) {
  'use strict';
  var inFlight = null;
  var state = Vue.observable({ busy: false, processed: 0, total: null });
  async function build(lastscan) {
    var rows = [], offset = 0, total = null;
    state.busy = true; state.processed = 0; state.total = null;
    do {
      var page = await LmsApi.collectionTracks(offset, 500);
      if (!page.rows.length && page.total != null && offset < page.total) throw new Error('Incomplete collection page');
      total = page.total; rows = rows.concat(page.rows); offset += page.rows.length;
      state.processed = offset; state.total = total;
    } while (total == null ? page.rows.length === 500 : offset < total);
    var confirmed = String((await LmsApi.serverInfo()).lastscan || '');
    if (confirmed !== lastscan) return build(confirmed);
    var snapshot = { rows: rows, offset: offset, total: total, lastscan: lastscan, complete: true, error: '', firstMs: null, completeMs: null };
    LmsLibraryDisplay.state.collection = snapshot;
    await LmsLibraryDisplay.cacheCollection(snapshot);
    return snapshot;
  }
  async function run(force) {
    var cached = LmsLibraryDisplay.state.collection;
    if (!cached) cached = await LmsLibraryDisplay.loadCollectionCache();
    if (cached) LmsLibraryDisplay.state.collection = cached;
    var stamp = String((await LmsApi.serverInfo()).lastscan || '');
    if (!force && cached && cached.lastscan === stamp) return cached;
    return build(stamp);
  }
  function ensure(force) {
    if (inFlight) return inFlight;
    inFlight = run(!!force).finally(function () { inFlight = null; state.busy = false; });
    return inFlight;
  }
  global.LmsCollectionCache = { state: state, ensure: ensure };
  if (global.indexedDB && global.setInterval) {
    global.setTimeout(function () { ensure(false).catch(function () {}); }, 0);
    global.setInterval(function () { if (!global.document || !global.document.hidden) ensure(false).catch(function () {}); }, 60000);
  }
})(window);

Vue.component('lms-album-display-settings', {
  template: `<section><div class="sgh">Album information</div><div class="player-help">Choose what appears beside the album cover.</div>
    <div class="sgroup"><label class="srow">{{ tr('Apply to') }}<select v-model="scope"><option v-for="option in scopes" :key="option.key" :value="option.key">{{ option.label }}</option></select></label>
    <div class="album-field-editor is-sided">
      <div v-for="side in ['left','right','hidden']" :key="side" class="album-field-list" :class="{'is-hidden':side==='hidden'}" @dragover.prevent @drop.prevent="dropAt(sideFields(side).length,side)"><div class="album-field-list-title"><strong>{{ tr(side==='left'?'Left side':side==='right'?'Right side':'Hidden') }}</strong><small>{{ tr(side==='hidden'?'Drag here to remove':'Drag to rearrange') }}</small></div>
        <div v-for="(field,index) in sideFields(side)" :key="field.key" class="album-field-row" :class="{dragging:dragKey===field.key}" draggable="true" @dragstart="dragStart(field.key,$event)" @dragover.prevent.stop @drop.prevent.stop="dropAt(index,side)" @dragend="dragEnd"><span class="album-field-grip" aria-hidden="true">⠿</span><span>{{ tr(field.label) }}</span><span class="album-field-actions"><button v-if="side!=='left'" type="button" :aria-label="tr('Left')" @click="place(field.key,'left')">←</button><button v-if="side!=='right'" type="button" :aria-label="tr('Right')" @click="place(field.key,'right')">→</button><button v-if="side!=='hidden'" type="button" :aria-label="tr('Hide')+' '+tr(field.label)" @click="place(field.key,'hidden')">−</button></span></div>
      </div>
    </div>
    <button class="srow pointer" @click="reset">{{ tr(scope === 'global' ? 'Restore defaults' : 'Use inherited settings') }}</button></div>
    <p class="player-help">Album overrides artist, artist overrides genre, genre overrides global.</p>
    <section class="album-display-preview" :aria-label="tr('LIVE PREVIEW')"><small>{{ tr('LIVE PREVIEW') }}</small><strong>{{ preview.title }}</strong><template v-for="field in visibleFields"><span v-if="previewValue(field.key)" :key="'preview-'+field.key" :class="{'preview-information':field.key==='albumInformation'||field.key==='artistInformation'}">{{ previewValue(field.key) }}</span></template></section>
    <p v-if="!prefs.context" class="player-help">Open these settings from an album to customize its artist, genre or album.</p></section>`,
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
  methods: { tr: function (s) { return window.LmsStr ? LmsStr.t(s) : s; }, setSide: function (side) { LmsLibraryDisplay.setAlbumSide(side); }, change: function (key, value) { LmsLibraryDisplay.set(this.scope, key, value); }, reset: function () { LmsLibraryDisplay.reset(this.scope); },
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

/* Sequential 500-row reads. A completed snapshot is keyed by LMS lastscan, so
   opening Collection is free until an actual library scan changes the stamp. */
Vue.component('lms-collection', {
  template: `<section class="collection-screen scroller"><div class="collection-view-switch" role="tablist" :aria-label="tr('Library view')"><button type="button" role="tab" aria-selected="true">{{ tr('Collection') }}</button><button type="button" role="tab" aria-selected="false" @click="openMusicFolders">{{ tr('Music folders') }}</button></div><h2>{{ tr('Collection') }}</h2>
    <div class="collection-totals"><div><strong>{{ albumCount }}</strong>{{ tr('Albums') }}</div><div><strong>{{ rows.length }}</strong>{{ tr('Tracks') }}</div><div><strong>{{ storageLabel }}</strong>{{ tr('Known file sizes') }}</div><div><strong>{{ groups.genre.length }}</strong>{{ tr('Genres') }}</div></div>
    <div class="collection-status" role="status">{{ tr(complete ? 'Complete' : scanning ? 'Loading…' : 'Partial results') }}<template v-if="!scanning"> · {{ rows.length }}<span v-if="total !== null"> / {{ total }}</span></template>
      <div v-if="scanning" class="collection-scan-progress" role="progressbar" :aria-label="tr('Collection scan progress')" aria-valuemin="0" :aria-valuemax="progressTotal === null ? undefined : progressTotal" :aria-valuenow="progressTotal === null ? undefined : progressProcessed"><span class="collection-scan-track"><i :style="{width: progressPercent + '%'}"></i></span><span>{{ progressProcessed }}<template v-if="progressTotal !== null"> / {{ progressTotal }}</template></span></div>
      <button v-if="busy" type="button" @click="stop">{{ tr('Stop') }}</button><button v-else-if="!complete && rows.length" type="button" @click="scan">{{ tr(error ? 'Try again' : 'Load more') }}</button><button type="button" :disabled="scanning" @click="refresh">{{ tr(scanning ? 'Scanning collection…' : 'Scan collection now') }}</button>
      <p v-if="error">{{ error }}</p><p>{{ tr('Streaming entries are excluded from storage. Missing file sizes are not estimated.') }} {{ unknownSizes }} {{ tr('Unknown') }}</p></div>
    <label class="collection-measure">{{ tr('Measure') }}<select v-model="measure"><option value="albums">{{ tr('Albums') }}</option><option value="tracks">{{ tr('Tracks') }}</option><option value="storage">{{ tr('Storage') }}</option></select></label>
    <div class="collection-charts"><section class="collection-chart"><h3>{{ tr('By genre') }}</h3>
      <button v-for="(group,index) in genreGroups" :key="group.key" class="collection-bar" :style="{'--collection-color':chartColor(index)}" @click="drill('genre',group.key)"><span>{{ group.key === '?' ? tr('Unknown') : group.key }}</span><span class="collection-gauge"><i :style="{width: percentage(group.value,genreGroups) + '%'}"></i></span><span>{{ measure === 'storage' ? bytes(group.value) : group.value }}</span><span aria-hidden="true">›</span></button><p v-if="!genreGroups.length">{{ tr('Not available') }}</p></section>
      <section class="collection-chart"><h3>{{ tr('File types') }} · {{ tr('Track share') }}</h3><div v-if="formatGroups.length" class="collection-donut-row"><div class="collection-donut" :style="{background: donutStyle}" role="img" :aria-label="formatSummary"></div><div><button v-for="(group,index) in formatGroups" :key="group.key" class="collection-legend" :style="{'--collection-color':chartColor(index)}" @click="drill('format',group.key)"><i aria-hidden="true"></i>{{ group.key === '?' ? tr('Unknown') : group.key }} <span>{{ percent(group.value, formatGroups) }}%</span></button></div></div><p v-else>{{ tr('Not available') }}</p></section>
      <section v-for="kind in kinds" :key="kind.key" class="collection-chart"><h3>{{ tr(kind.label) }}</h3>
        <button v-for="group in groups[kind.key]" :key="group.key" class="collection-bar" @click="drill(kind.key,group.key)"><span>{{ group.key === '?' ? tr('Unknown') : group.key }}</span><span class="collection-gauge"><i :style="{width: percentage(group.value,groups[kind.key]) + '%'}"></i></span><span>{{ kind.key === 'storage' ? bytes(group.value) : group.value }}</span><span aria-hidden="true">›</span></button><p v-if="!groups[kind.key].length">{{ tr('Not available') }}</p></section></div>
    <section v-if="selected" class="collection-drill"><header><span><h3>{{ selected.key === '?' ? tr('Unknown') : selected.key }}</h3><small>{{ selectedAlbums.length }} {{ tr('Albums') }}</small></span><button @click="clearDrill">{{ tr('Clear filter') }}</button></header>
      <div class="collection-selection-bar"><label><input type="checkbox" :checked="allVisibleSelected" @change="toggleAllVisible($event.target.checked)">{{ tr('Select all') }}</label><strong>{{ selectedAlbumCount }} {{ tr('Selected') }}</strong><button type="button" :disabled="!selectedAlbumCount || actionBusy" @click="playSelected">▶ {{ tr('Play now') }}</button><button type="button" :disabled="!selectedAlbumCount || actionBusy" @click="playlistOpen=true">{{ tr('Create playlist') }}</button><span class="collection-action-status" role="status">{{ playlistOpen ? '' : actionMessage }}</span></div>
      <div v-for="album in selectedAlbums.slice(0,visibleCount)" :key="album.id" class="collection-album"><label><input type="checkbox" :checked="isAlbumSelected(album.id)" @change="selectAlbum(album.id,$event.target.checked)"><span><strong>{{ album.title }}</strong><small>{{ album.artist }}</small></span></label><button type="button" :aria-label="tr('Open') + ' ' + album.title" @click="openAlbum(album)">›</button></div>
      <button v-if="visibleCount<selectedAlbums.length" @click="visibleCount+=100">{{ tr('Load more') }}</button></section>
    <div v-if="playlistOpen" class="collection-playlist-backdrop" @click.self="playlistOpen=false"><section class="collection-playlist-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-playlist-title"><h3 id="collection-playlist-title">{{ tr('Create playlist') }}</h3><label>{{ tr('Playlist name') }}<input ref="playlistName" v-model="playlistName" type="text" @keydown.enter.prevent="savePlaylist"></label><p role="status">{{ actionMessage }}</p><footer><button type="button" @click="playlistOpen=false">{{ tr('Cancel') }}</button><button type="button" :disabled="!playlistName.trim() || actionBusy" @click="savePlaylist">{{ tr(actionBusy ? 'Saving playlist…' : 'Save playlist') }}</button></footer></section></div>
    <details class="collection-timings"><summary>{{ tr('Loading performance') }}</summary><p>{{ tr('First usable results') }}: {{ firstMs === null ? tr('Not measured') : firstMs + ' ms' }}</p><p>{{ tr('Complete collection') }}: {{ completeMs === null ? tr('Not measured') : completeMs + ' ms' }}</p></details>
  </section>`,
  data: function () { return { rows: [], offset: 0, total: null, lastscan: '', busy: false, collectionCache: LmsCollectionCache.state, complete: false, error: '', token: 0, selected: null, selectedAlbumIds: {}, visibleCount: 100, firstMs: null, completeMs: null, started: 0, measure: 'albums', playlistOpen: false, playlistName: '', actionBusy: false, actionMessage: '',
    kinds: [{ key: 'storage', label: 'Storage by file type' }, { key: 'size', label: 'Album file size' }] }; },
  computed: {
    scanning: function () { return this.busy || this.collectionCache.busy; },
    progressProcessed: function () { return this.collectionCache.busy ? this.collectionCache.processed : this.rows.length; },
    progressTotal: function () { return this.collectionCache.busy ? this.collectionCache.total : this.total; },
    progressPercent: function () { return this.progressTotal ? Math.min(100, 100 * this.progressProcessed / this.progressTotal) : 35; },
    albumMap: function () { var out = Object.create(null); this.rows.forEach(function (r) { if (r.albumId == null) return; var key = String(r.albumId), a = out[key] || (out[key] = { id: r.albumId, title: r.album || String(r.albumId), artist: r.artist, bytes: 0, known: true, local: false }); if (!r.remote) { a.local = true; if (r.fileSize == null) a.known = false; else a.bytes += r.fileSize; } }); return out; },
    albumCount: function () { return Object.keys(this.albumMap).length; },
    unknownSizes: function () { return this.rows.filter(function (r) { return !r.remote && r.fileSize == null; }).length; },
    storageLabel: function () { var known = this.rows.filter(function (r) { return !r.remote && r.fileSize != null; }); return known.length ? this.bytes(known.reduce(function (sum, r) { return sum + r.fileSize; }, 0)) : this.tr('Not available'); },
    groups: function () { var buckets = { genre: Object.create(null), format: Object.create(null), storage: Object.create(null), size: Object.create(null) };
      this.rows.forEach(function (r) { var genre = r.genre || '?', format = r.format || '?'; buckets.genre[genre] = (buckets.genre[genre] || 0) + 1; buckets.format[format] = (buckets.format[format] || 0) + 1; if (!r.remote && r.fileSize != null) buckets.storage[format] = (buckets.storage[format] || 0) + r.fileSize; });
      Object.keys(this.albumMap).forEach(function (key) { var a = this.albumMap[key]; if (!a.local) return; var band = this.sizeBand(a); buckets.size[band] = (buckets.size[band] || 0) + 1; }, this);
      Object.keys(buckets).forEach(function (kind) { buckets[kind] = Object.keys(buckets[kind]).map(function (key) { return { key: key, value: buckets[kind][key] }; }).sort(function (a, b) { return b.value - a.value; }); }); return buckets;
    },
    genreGroups: function () { var self = this, buckets = Object.create(null); this.rows.forEach(function (r) { var key = r.genre || '?', value = self.measure === 'storage' ? (!r.remote && r.fileSize != null ? r.fileSize : 0) : 1; if (self.measure === 'albums') { if (!buckets[key]) buckets[key] = Object.create(null); if (r.albumId != null) buckets[key][r.albumId] = true; } else buckets[key] = (buckets[key] || 0) + value; }); return Object.keys(buckets).map(function (key) { return { key:key, value:self.measure === 'albums' ? Object.keys(buckets[key]).length : buckets[key] }; }).sort(function (a,b) { return b.value-a.value; }); },
    formatGroups: function () { return this.groups.format; },
    donutStyle: function () { var total=this.formatGroups.reduce(function(sum,g){return sum+g.value;},0), at=0, self=this; return 'conic-gradient(' + this.formatGroups.map(function(g,i){var from=100*at/total;at+=g.value;return self.chartColor(i)+' '+from+'% '+(100*at/total)+'%';}).join(',') + ')'; },
    formatSummary: function () { var self=this; return this.formatGroups.map(function(g){return g.key+' '+self.percent(g.value,self.formatGroups)+'%';}).join(', '); },
    selectedAlbums: function () { if (!this.selected) return []; var self = this, ids = Object.create(null); this.rows.forEach(function (r) { var s = self.selected, a = self.albumMap[String(r.albumId)]; if (!a) return; if ((s.kind === 'genre' && (r.genre || '?') === s.key) || ((s.kind === 'format' || s.kind === 'storage') && (r.format || '?') === s.key && (s.kind !== 'storage' || !r.remote)) || (s.kind === 'size' && a.local && self.sizeBand(a) === s.key)) ids[String(a.id)] = a; }); return Object.keys(ids).map(function (key) { return ids[key]; }); },
    selectedAlbumCount: function () { return Object.keys(this.selectedAlbumIds).filter(function (key) { return this.selectedAlbumIds[key]; }, this).length; },
    allVisibleSelected: function () { var self=this,list=this.selectedAlbums.slice(0,this.visibleCount);return !!list.length&&list.every(function(album){return !!self.selectedAlbumIds[String(album.id)];}); },
    selectedTracks: function () { var selected=this.selectedAlbumIds;return this.rows.filter(function(row){return !!selected[String(row.albumId)];}); }
  },
  methods: {
    tr: function (s) { return window.LmsStr ? LmsStr.t(s) : s; },
    bytes: function (n) { if (n < 1024) return n + ' B'; var units = ['KB', 'MB', 'GB', 'TB'], i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < 3); return n.toFixed(1) + ' ' + units[i]; },
    sizeBand: function (a) { return !a.known ? '?' : a.bytes < 250e6 ? '< 250 MB' : a.bytes < 500e6 ? '250–500 MB' : a.bytes < 1e9 ? '500 MB–1 GB' : '> 1 GB'; },
    percentage: function (n, groupList) { return 100 * n / Math.max.apply(Math, groupList.map(function (g) { return g.value; }).concat([1])); },
    percent: function (n, groupList) { var total=groupList.reduce(function(sum,g){return sum+g.value;},0); return total ? Math.round(100*n/total) : 0; },
    snapshot: function () { return { rows: this.rows, offset: this.offset, total: this.total, lastscan: this.lastscan, complete: this.complete, error: this.error, firstMs: this.firstMs, completeMs: this.completeMs }; },
    remember: function () { var value = this.snapshot(); LmsLibraryDisplay.state.collection = value; if (value.complete && value.lastscan) LmsLibraryDisplay.cacheCollection(value); },
    restore: function (lastscan) { var c = LmsLibraryDisplay.state.collection; if (!c || (lastscan && c.lastscan !== lastscan)) return false; this.rows = c.rows || []; this.offset = c.offset || 0; this.total = c.total == null ? null : c.total; this.lastscan = c.lastscan || ''; this.complete = !!c.complete; this.error = c.error || ''; this.firstMs = c.firstMs == null ? null : c.firstMs; this.completeMs = c.completeMs == null ? null : c.completeMs; return true; },
    stop: function () { this.token++; this.busy = false; this.remember(); },
    applySnapshot: function (snapshot) { if (!snapshot) return false; LmsLibraryDisplay.state.collection = snapshot; return this.restore(snapshot.lastscan); },
    rebuild: function (lastscan) { this.stop(); this.lastscan = String(lastscan || ''); this.rows = []; this.offset = 0; this.total = null; this.complete = false; this.error = ''; this.firstMs = null; this.completeMs = null; this.started = 0; this.selected = null; this.remember(); return this.scan(); },
    refresh: async function () { this.error = ''; try { this.applySnapshot(await LmsCollectionCache.ensure(true)); } catch (e) { this.error = this.tr('Collection could not be loaded. Retry or refresh if the library changed.'); } },
    activate: async function () { try { this.applySnapshot(await LmsCollectionCache.ensure(false)); } catch (e) { this.error = this.tr('Collection could not be loaded. Retry or refresh if the library changed.'); } },
    scan: async function () { if (this.busy || this.complete) return; var token = ++this.token; this.busy = true; this.error = ''; if (!this.started) this.started = Date.now();
      try { while (token === this.token && !this.complete) { var page = await LmsApi.collectionTracks(this.offset, 500); if (token !== this.token) return; if (!page.rows.length && page.total != null && this.offset < page.total) throw new Error('Incomplete page');
        if (this.total !== null && page.total !== null && this.total !== page.total) throw new Error('Library changed');
        this.total = page.total; var seen = Object.create(null); this.rows.forEach(function (r) { seen[String(r.id)] = true; }); this.rows = this.rows.concat(page.rows.filter(function (r) { var key = String(r.id); if (seen[key]) return false; seen[key] = true; return true; }));
        this.offset += page.rows.length; this.complete = page.total == null ? page.rows.length < 500 : this.offset >= page.total;
        await this.$nextTick(); await new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); });
        if (this.firstMs === null && this.rows.length) this.firstMs = Date.now() - this.started;
        if (this.complete) this.completeMs = Date.now() - this.started;
        this.remember();
      } } catch (e) { if (token === this.token) { this.error = this.tr('Collection could not be loaded. Retry or refresh if the library changed.'); this.remember(); } }
      finally { if (token === this.token) { this.busy = false; this.remember(); } }
    },
    chartColor: function (index) { return ['#c83d31','#c98012','#087fb2','#238f74','#725aa7','#a85a73','#477d9b'][index % 7]; },
    openMusicFolders: function () { LmsUi.setTab('music'); LmsUi.setMusicView('musicfolders'); LmsNav.reset('music'); },
    drill: function (kind, key) { this.selected = { kind: kind, key: key }; this.selectedAlbumIds = {}; this.visibleCount = 100; this.playlistName = (key === '?' ? this.tr('Unknown') : key) + ' ' + this.tr('Collection'); this.actionMessage = ''; },
    clearDrill: function () { this.selected=null;this.selectedAlbumIds={};this.playlistOpen=false;this.actionMessage=''; },
    isAlbumSelected: function (id) { return !!this.selectedAlbumIds[String(id)]; },
    selectAlbum: function (id, value) { if (value) Vue.set(this.selectedAlbumIds,String(id),true); else Vue.delete(this.selectedAlbumIds,String(id)); },
    toggleAllVisible: function (value) { var self=this;this.selectedAlbums.slice(0,this.visibleCount).forEach(function(album){self.selectAlbum(album.id,value);}); },
    playSelected: async function () { if (!this.selectedTracks.length || this.actionBusy) return; this.actionBusy=true;this.actionMessage='';try{await LmsStore.playTrackList(this.selectedTracks,0,false);this.actionMessage=this.tr('Playing selection.');}catch(e){this.actionMessage=this.tr('Could not start playback.');}finally{this.actionBusy=false;} },
    uniquePlaylistName: async function (requested) { var list=await LmsApi.playlists(0,500),used=Object.create(null),base=requested.trim(),name=base,n=2;list.forEach(function(p){used[String(p.name||'').toLowerCase()]=true;});while(used[name.toLowerCase()])name=base+' '+n++;return name; },
    savePlaylist: async function () { if (!this.playlistName.trim() || !this.selectedTracks.length || this.actionBusy) return;this.actionBusy=true;this.actionMessage=this.tr('Saving playlist…');try{var name=await this.uniquePlaylistName(this.playlistName),created=await LmsApi.createPlaylist(name);if(created.id==null)throw new Error('playlist');for(var i=0;i<this.selectedTracks.length;i++){var track=this.selectedTracks[i];await LmsApi.editPlaylist(created.id,'add',{title:track.title,url:track.url});}this.playlistName=name;this.actionMessage=this.tr('Playlist saved.')+' '+name;}catch(e){this.actionMessage=this.tr('Could not save playlist.');}finally{this.actionBusy=false;} },
    openAlbum: function (album) { LmsUi.setTab('music'); LmsNav.push('music', { kind: 'album', id: album.id, label: album.title, album: { id: album.id, title: album.title, artist: album.artist } }); }
  },
  mounted: function () { this.activate(); }, beforeDestroy: function () { this.stop(); }
});
