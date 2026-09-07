
var ECHOCLASSIC_ALBUM_INFO_CACHE_KEY = 'echoclassic.album-info.v1';
var ECHOCLASSIC_ALBUM_INFO_CACHE_LIMIT = 60;

/* Um album completo: cabecalho, linha de aleatorio e faixas. Existe como
   componente proprio porque a tela de album empilha um bloco destes por album do
   artista — o escolhido primeiro, os outros abaixo — e cada bloco carrega as
   proprias faixas, o que faz a lista aparecer em partes em vez de esperar todos.

   O bloco tambem e usado sozinho quando o album e aberto pela raiz Albuns. */
Vue.component('lms-album-block', {
  props: {
    album: { type: Object, required: true },
    artist: { type: Object, default: null },
    enrich: { type: Boolean, default: true },
    showRelated: { type: Boolean, default: true },
    continuation: { type: Boolean, default: false },
    genericTrackHeading: { type: Boolean, default: false },
    disc: { type: Number, default: 0 },
    suppliedTracks: { type: Array, default: null },
    incompleteDisc: { type: Boolean, default: false }
  },
  template: `
<div class="albumblock">
  <div v-if="(showRelated && relatedArtists.length) || (!disc && creditGroups.length)" ref="relatedRow" class="album-extra album-related"
       :class="{expanded: relatedExpanded}">
    <svg class="related-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 19.5v-1.3c0-2.1-1.8-3.7-4-3.7H7c-2.2 0-4 1.6-4 3.7v1.3M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 8h5M18.5 5.5v5"/>
    </svg>
    <div v-if="showRelated && relatedArtists.length" class="related-links">
      <strong>{{ tr('Local library') }}</strong>
      <template v-for="(a, index) in displayedRelatedArtists">
        <span v-if="index" :key="'separator-' + a.id" class="related-separator" aria-hidden="true">•</span>
        <button :key="a.id" @click="openRelatedArtist(a)">{{ a.name }}</button>
      </template>
    </div>
    <button v-if="showRelated && hasHiddenRelated" class="related-more"
            :aria-expanded="String(relatedExpanded)" @click="relatedExpanded = !relatedExpanded">
      <span>{{ tr(relatedExpanded ? 'Show less' : 'Show more') }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 5 5-5"/></svg>
    </button>
    <button v-if="!disc && creditGroups.length" type="button" class="related-more"
            :aria-expanded="String(metadataOpen)" @click="metadataOpen = !metadataOpen">{{ tr(metadataOpen ? 'Less' : 'More') }}</button>
  </div>
  <div v-else-if="relatedError" class="loading-more warning" role="status">{{ relatedError }}</div>

  <section v-if="metadataOpen && !disc" class="album-credits" :aria-label="tr('Credits')">
    <div v-for="group in creditGroups" :key="group.roleId" class="album-credit-row">
      <strong>{{ tr(group.role) }}</strong><div>
        <template v-for="credit in group.items">
          <button v-if="credit.ids.length" type="button" :key="credit.key" @click="openCredit(credit)">{{ credit.name }} ›</button>
          <span v-else :key="credit.key">{{ credit.name }}</span>
        </template>
      </div>
    </div>
    <p v-if="tracksHasMore" class="loading-more">{{ tr('Credits from loaded tracks') }}</p>
  </section>
  <div v-if="!continuation" class="albumhead reviewed-albumhead" :class="{'album-cover-hidden':!displayFields.albumCover}">
    <div v-if="displayFields.source && albumSource && !customDisplayOrder" class="album-origin-label">{{ originLine }}</div>
    <div v-if="displayFields.albumCover" class="albumart" :class="{placeholder: !artUrl || artFailed}">
      <img v-if="artUrl && !artFailed" :src="artUrl" alt="" @error="artFailed = true">
      <span v-else class="art-placeholder" aria-hidden="true">♫</span>
    </div>
    <div class="albummeta">
      <div class="album-title-row" :class="{pending: !albumSource}">
        <div class="atitle">{{ album.title }}<span v-if="disc"> · {{ tr('Disc') }} {{ disc }}</span></div>
      </div>
      <button v-if="displayFields.artist && artist" class="aartist pointer" :style="displayOrderStyle('artist')" @click="openArtist">{{ artist.name }}</button>
      <div v-else-if="displayFields.artist && album.artist" class="aartist" :style="displayOrderStyle('artist')">{{ album.artist }}</div>
      <div v-if="displayFields.counts" class="ameta" :style="displayOrderStyle('counts')">{{ metaLine }}</div>
      <div v-if="displayFields.year && album.year" class="edition-years" :style="displayOrderStyle('year')">
        <span>Year of this edition: {{ album.year || 'not available' }}</span>
      </div>
      <div v-if="displayFields.genre && displayContext.genre" class="ameta" :style="displayOrderStyle('genre')">{{ displayContext.genre }}</div>
      <div v-if="displayFields.source && albumSource && customDisplayOrder" class="ameta album-origin-inline" :style="displayOrderStyle('source')">{{ originLine }}</div>
      <div v-if="displayFields.format && tracks.length" class="album-facts" :style="displayOrderStyle('format')" aria-label="Album technical details">
        <span class="album-fact" :title="tr('Format:') + ' ' + formatLine">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21.5H6zM14 2.5v4h4"/></svg>
          <span>{{ formatLine }}</span>
        </span>
        <span class="album-fact" :title="'Bit rate: ' + bitRateLine">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-6M8 18V6M12 14v-4M16 19V5M20 15V9"/></svg>
          <span>{{ bitRateLine }}</span>
        </span>
      </div>
      <div v-if="isSacdAlbum" class="sacd-cache-line" role="status">
        <span class="sacd-cache-badge">{{ sacdCacheLabel }}</span>
        <span v-if="sacdFirstError" class="sacd-cache-error">{{ sacdFirstError }}</span>
        <button v-if="!sacdAvailable" type="button" @click="openSacdPluginManager">{{ tr('Install plugin') }}</button>
        <button v-else-if="sacdBinaryMissing" type="button" disabled>{{ tr('sacd_extract binary missing on the server') }}</button>
        <button v-else type="button" :disabled="sacdInProgress || sacdBusy" @click="changeSacdCache">{{ sacdActionLabel }}</button>
      </div>
      <div v-if="displayFields.albumInformation" class="album-summary-inline" :style="displayOrderStyle('albumInformation')">
        <svg viewBox="0 0 24 24" role="img" :aria-label="tr('Album information')"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg>
        <span>{{ albumSummary }}</span><button type="button" :aria-expanded="String(albumInfoVisible)" @click="albumInfoVisible = !albumInfoVisible">{{ tr(albumInfoVisible ? 'Less' : 'More') }}</button>
      </div>
    </div>
  </div>

  <div v-if="!continuation" class="album-primary-actions" aria-label="Album playback">
    <button type="button" class="album-play-command" @click="playAlbum" :disabled="store.discPlaybackBusy || incompleteDisc">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>
      <span>{{ tr('Play') }}</span>
    </button>
    <button type="button" class="album-shuffle-command" @click="shuffle" :disabled="store.discPlaybackBusy || incompleteDisc">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3l4 4-4 4M4 7h16M8 21l-4-4 4-4M20 17H4"/></svg>
      <span>{{ tr('Shuffle') }}</span>
    </button>
    <button type="button" class="album-equalizer-command" @click="openAlbumEqualizer">{{ tr('Equalizer') }}</button>
  </div>
  <p v-if="incompleteDisc" class="loading-more">{{ tr('Load all album tracks before playing a disc.') }}</p>
  <section v-if="albumInfoVisible" class="album-enrichment">
    <button type="button" class="album-config-cog" :aria-label="tr('Customize album information')" :title="tr('Customize album information')" @click="configureInformation"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/></svg></button>
    <span class="opml-new-label">{{ tr('New') }}</span>
    <h3>{{ tr('Album information') }}</h3>
    <div class="album-information-metadata">
      <div><span>{{ tr('Artist') }}</span><strong>{{ album.artist || (artist && artist.name) || tr('Unknown Artist') }}</strong></div>
      <div><span>{{ tr('Album') }}</span><strong>{{ metaLine }}</strong></div>
      <div><span>{{ tr('Edition year') }}</span><strong>{{ album.year || tr('not available') }}</strong></div>
      <div v-if="displayContext.genre"><span>{{ tr('Genre') }}</span><strong>{{ displayContext.genre }}</strong></div>
      <div><span>{{ tr('Format') }}</span><strong>{{ formatLine || tr('not available') }}</strong></div>
      <div><span>{{ tr('Source') }}</span><strong>{{ sourceTitle }}</strong></div>
    </div>
    <div v-if="albumInfoStatus === 'loading'" role="status">{{ tr('Finding album information…') }}</div>
    <div v-else-if="albumInfoStatus === 'unavailable'" role="status">
      <p>{{ tr('Album information requires MusicArtistInfo.') }}</p>
      <button type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button>
    </div>
    <template v-else-if="albumInfoStatus === 'ready'">
      <p v-if="albumInfo.review" class="album-review" :class="{expanded: albumReviewExpanded}">{{ albumInfo.review }}</p>
      <button v-if="albumInfo.review" type="button" class="retry-command artist-biography-toggle"
              :aria-expanded="albumReviewExpanded ? 'true' : 'false'" @click="albumReviewExpanded = !albumReviewExpanded">
        {{ tr(albumReviewExpanded ? 'Show less' : 'Show more') }}
      </button>
      <button type="button" class="retry-command album-source-toggle"
              :aria-expanded="albumSourceVisible ? 'true' : 'false'" @click="albumSourceVisible = !albumSourceVisible">
        {{ tr(albumSourceVisible ? 'Hide source' : 'Show source') }}
      </button>
      <div v-if="albumSourceVisible && albumInfo.covers.length" class="album-cover-candidates" :aria-label="tr('Reference artwork')">
        <figure v-for="(cover, index) in albumInfo.covers.slice(0, 4)" :key="cover.url + index">
          <img :src="cover.url" :alt="tr('Reference artwork')"><figcaption>{{ cover.credits || cover.size }}</figcaption>
        </figure>
      </div>
      <p v-if="albumSourceVisible" class="artist-enrichment-source">{{ tr('Provided by MusicArtistInfo from Last.fm, Discogs and MusicBrainz.') }} {{ tr('Retrieved') }} {{ albumInfoRetrieved }}</p>
      <div class="artist-enrichment-actions"><button type="button" @click="loadAlbumInfo(true)">{{ tr('Refresh') }}</button></div>
    </template>
    <div v-else-if="albumInfoStatus" role="status">{{ tr('Album information is temporarily unavailable.') }} <button type="button" class="retry-command" @click="loadAlbumInfo(true)">{{ tr('Try again') }}</button></div>
    <p v-else>{{ metaLine }} · {{ formatLine }}</p>
  </section>

  <header v-if="continuation && !genericTrackHeading" class="album-continuation-heading">
    <span class="album-continuation-label">{{ tr('Album') }}</span>
    <span class="album-continuation-copy"><strong>{{ album.title }}</strong><small>{{ continuationMeta }}</small></span>
  </header>
  <header v-else-if="continuation" class="album-continuation-heading album-track-heading">
    <span class="album-continuation-copy"><strong>{{ tr('Tracks') }}</strong><small>{{ continuationMeta }}</small></span>
  </header>
  <h3 v-else-if="!disc && !isMultiDisc" class="album-tracks-title">{{ tr('Album tracks') }}</h3>

  <div v-if="loading" class="empty"><div class="p">Loading tracks…</div></div>
  <div v-else-if="error" class="empty">
    <div class="p">{{ error }}</div>
    <button class="retry-command" @click="load">Try again</button>
  </div>
  <template v-else>
    <section v-if="isMultiDisc" class="album-discs">
      <div class="disc-toolbar">
        <input v-model.trim="discQuery" type="search" :aria-label="tr('Find a disc or track')" :placeholder="tr('Find a disc or track')">
        <select :aria-label="tr('Jump to disc')" @change="jumpDisc($event)"><option value="">{{ tr('Jump to disc') }}</option><option v-for="group in discGroups" :key="group.number" :value="group.number">{{ group.number }}</option></select>
        <button type="button" @click="toggleAllDiscs">{{ tr(allDiscsOpen ? 'Collapse all' : 'Expand all') }}</button>
      </div>
      <section v-for="group in filteredDiscs" :key="group.number" class="disc-section">
        <button type="button" class="disc-section-heading" :data-disc="group.number" :aria-expanded="String(discOpen(group.number))" @click="toggleDisc(group.number)">
          <span>{{ discOpen(group.number) ? '⌄' : '›' }} {{ tr('Disc') }} {{ group.number }}</span>
          <span>{{ group.tracks.length }} {{ tr('songs') }}</span>
        </button>
        <lms-album-block v-if="discOpen(group.number)" :album="album" :artist="artist" :disc="group.number"
          :supplied-tracks="group.tracks" :incomplete-disc="tracksHasMore" :enrich="false" :show-related="false"></lms-album-block>
      </section>
      <p v-if="!filteredDiscs.length" class="empty">{{ tr('No matching discs or tracks') }}</p>
    </section>
	    <template v-for="(t, trackIndex) in (isMultiDisc ? [] : tracks)">
      <div :key="t.id" class="trow"
	         :class="{playing: isPlaying(t), chosen: selected(t)}"
	         role="group" :aria-label="trackLabel(t)">
	      <button type="button" class="trow-main pointer" :aria-label="trackLabel(t)"
	              :aria-pressed="ui.selectionMode ? String(selected(t)) : null"
	              @click="rowClick(t)">
	        <span v-if="ui.selectionMode" class="select-mark" :class="{on: selected(t)}"></span>
	        <span class="num">
	          <svg v-if="isPlaying(t)" class="nowicon" viewBox="0 0 24 24">
	            <path d="M7 4l13 8-13 8z"/>
	          </svg>
	          <span v-else>{{ t.trackNum || '' }}</span>
	        </span>
	        <span class="ell"><span class="t ell">{{ t.title }}</span></span>
	        <span v-if="sacdTrackReady(t)" class="sacd-track-ready" :title="tr('Cached')" :aria-label="tr('Cached')">✓</span>
	        <span v-if="hires(t)" class="spec">{{ shortRate(t) }}</span>
	        <span class="dur">{{ dur(t.duration) }}</span>
	      </button>
	      <button v-if="!ui.selectionMode && store.equalizer.status === 'ready'" type="button"
	              class="track-equalizer-command" :class="{on: trackEqualizerRule(t)}"
	              :title="tr('Equalizer')" :aria-label="tr('Equalizer') + ': ' + t.title"
	              @click.stop="openTrackEqualizer(t)">
	        <svg viewBox="0 0 20 20" aria-hidden="true"><g><path d="M4 2.5v15M10 2.5v15M16 2.5v15"/><circle cx="4" cy="12" r="2.2"/><circle cx="10" cy="6" r="2.2"/><circle cx="16" cy="10" r="2.2"/></g></svg>
	      </button>
	      <button v-if="!ui.selectionMode" class="more-command" title="More actions"
	              :aria-label="'More actions for ' + t.title" @click.stop="actions(t, $event)">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle class="more-ring" cx="12" cy="12" r="8.5"/>
          <circle class="more-dot" cx="8.5" cy="12" r="1"/>
          <circle class="more-dot" cx="12" cy="12" r="1"/>
          <circle class="more-dot" cx="15.5" cy="12" r="1"/>
        </svg>
      </button>
	    </div>
      </template>
	    <div v-if="!tracks.length" class="empty"><div class="p">This album returned no tracks.</div></div>
	    <div v-if="tracksHasMore" class="loading-more warning" role="status">
      <button type="button" :disabled="tracksLoadingMore" @click="loadMoreTracks">{{ tr(tracksLoadingMore ? 'Loading…' : 'Load more tracks') }}</button>
	    </div>
    <p v-if="tracksPageError" class="loading-more warning" role="status">{{ tracksPageError }}</p>
	  </template>
	</div>`,
  data: function () {
    return { store: LmsStore.state, ui: LmsUi.state, tracks: [], artFailed: false,
	             relatedArtists: [], relatedVisibleCount: 1, relatedExpanded: false, relatedError: '',
	             tracksHasMore: false, tracksTotal: null, tracksOffset: 0, tracksLoadingMore: false, tracksPageError: '', trackLoadToken: 0,
             metadataOpen: false, discExpanded: {}, discQuery: '', albumInfoStatus: '', albumInfo: { review: '', covers: [] },
	             albumInfoVisible: false, albumReviewExpanded: false, albumSourceVisible: false,
	             albumInfoRequestToken: 0, sacdAvailable: null, sacdStats: null, sacdStatus: null,
	             sacdBusy: false, sacdPollTimer: null,
	             relatedObserver: null, loading: true, error: '' };
  },
  computed: {
    displayContext: function () { return { id: this.album.id, title: this.album.title, artist: this.album.artist || (this.artist && this.artist.name) || '', genre: this.album.genre || (this.tracks[0] && this.tracks[0].genre) || '', counts: this.metaLine, year: this.album.year || '', format: this.formatLine, source: this.sourceTitle }; },
    displayFields: function () { return window.LmsLibraryDisplay ? LmsLibraryDisplay.resolve(this.displayContext) : { artist: true, counts: true, year: true, format: true, source: true, albumInformation: true, artistInformation: true }; },
    displayOrder: function () { return window.LmsLibraryDisplay && LmsLibraryDisplay.resolveOrder ? LmsLibraryDisplay.resolveOrder(this.displayContext) : ['artist','counts','year','format','genre','source','albumInformation','artistInformation']; },
    customDisplayOrder: function () { return this.displayOrder.join(',') !== 'artist,counts,year,format,genre,source,albumInformation,artistInformation'; },
    albumSummary: function () { return this.albumInfo.review || this.album.title; },
    isMultiDisc: function () { return !this.disc && this.tracks.some(function (t) { return Number(t.disc) > 1 || Number(t.discCount) > 1; }); },
    discGroups: function () {
      var groups = {};
      this.tracks.forEach(function (t) { var n = this.discNumber(t); (groups[n] || (groups[n] = { number: n, tracks: [] })).tracks.push(t); }, this);
      return Object.keys(groups).map(function (n) { return groups[n]; }).sort(function (a, b) { return a.number - b.number; });
    },
    filteredDiscs: function () {
      var q = this.discQuery.toLowerCase();
      return this.discGroups.filter(function (g) { return !q || String(g.number) === q || g.tracks.some(function (t) { return t.title.toLowerCase().indexOf(q) >= 0; }); });
    },
    allDiscsOpen: function () { return this.discGroups.every(function (g) { return this.discOpen(g.number); }, this); },
    creditGroups: function () {
      var groups = {}, seen = {};
      this.tracks.forEach(function (t) { (t.credits || []).forEach(function (c) {
        var key = c.roleId + ':' + (c.ids.length ? c.ids.join(',') : c.name);
        if (seen[key]) return; seen[key] = true;
        var group = groups[c.roleId] || (groups[c.roleId] = { roleId: c.roleId, role: c.role, items: [] });
        group.items.push(Object.assign({ key: key }, c));
      }); });
      return [5, 6, 2, 3, 4].map(function (role) { return groups[role]; }).filter(Boolean);
    },
    artUrl: function () { return (this.album.art || '').replace('_50x50', ''); },
    metaLine: function () {
      var n = this.tracksTotal == null || this.disc ? this.tracks.length : this.tracksTotal;
      /* A frase e montada por concatenacao, entao o texto pronto nunca bate
         com uma chave do dicionario. Traduz-se a unidade antes de juntar. */
      var unit = (n === 1) ? 'song' : 'songs';
      if (window.LmsStr) unit = LmsStr.t(unit);
      return [this.album.releaseType || '', n ? n + ' ' + unit : '']
        .filter(Boolean).join(' • ');
    },
    continuationMeta: function () {
      return [this.metaLine, this.album.year ? String(this.album.year) : '']
        .filter(Boolean).join(' • ');
    },
    formatLine: function () {
      var self = this;
      return this.unique(this.tracks.map(function (track) {
        return self.formatLabel(track.format);
      })).join(', ') || 'Not available';
    },
    bitRateLine: function () {
      var rates = this.tracks.map(function (track) {
        return Math.round(track.bitrate || 0);
      })
        .filter(function (rate) { return rate > 0; });
      var bitrate = '';
      if (rates.length) {
        var min = Math.min.apply(Math, rates);
        var max = Math.max.apply(Math, rates);
        bitrate = (min === max ? String(min) : min + '–' + max) + ' kbps';
      }
      var resolution = this.unique(this.tracks.map(function (track) {
        return [LmsFmt.rate(track.sampleRate), LmsFmt.depth(track.sampleSize)]
          .filter(Boolean).join(' • ');
      })).filter(Boolean).join(', ');
      return [bitrate, resolution].filter(Boolean).join(' • ') || 'Not available';
    },
    originLine: function () {
      var self = this;
      return this.unique(this.tracks.map(function (track) {
        var provider = self.providerFromTrack(track);
        if (provider === 'qobuz') return 'Qobuz';
        if (provider === 'youtube') return 'YouTube';
        return provider === 'local' ? 'Local library' : 'Remote / streaming';
      })).join(', ') || 'Not available';
    },
    originIsLocal: function () {
      return this.tracks.length && this.tracks.every(function (track) {
        var match = String(track.url || '').match(/^([a-z][a-z0-9+.-]*):\/\//i);
        var scheme = match ? match[1].toLowerCase() : '';
        return !track.remote && (!scheme || scheme === 'file');
      });
    },
    albumSource: function () {
      var self = this;
      var providers = this.unique(this.tracks.map(function (track) {
        return self.providerFromTrack(track);
      }));
      if (!providers.length) return '';
      return providers.length === 1 ? providers[0] : 'mixed';
    },
    sourceTitle: function () {
      var label = {
        local: 'Local library', qobuz: 'Qobuz', youtube: 'YouTube',
        remote: 'Remote / streaming', mixed: 'Mixed sources'
      }[this.albumSource] || 'Identifying source';
      return this.tr(label);
    },
    albumInfoRetrieved: function () {
      return this.albumInfo.retrievedAt ? new Date(this.albumInfo.retrievedAt).toLocaleString() : '';
    },
    displayedRelatedArtists: function () {
      return this.relatedExpanded
        ? this.relatedArtists : this.relatedArtists.slice(0, this.relatedVisibleCount);
    },
    hasHiddenRelated: function () {
      return this.relatedExpanded || this.relatedVisibleCount < this.relatedArtists.length;
    },
    albumEqualizerRule: function () {
      var playerId = this.store.playerId;
      var albumId = String(this.album.id);
      return (this.store.equalizer.rules || []).filter(function (rule) {
        return rule.playerId === playerId && rule.type === 'album' && rule.key === albumId;
      })[0] || null;
    },
    isSacdAlbum: function () { return this.tracks.some(function (track) { return /\.iso#(2ch|mch)-\d{2,3}$/i.test(String(track.url || '')); }); },
    sacdCounts: function () { var states=this.sacdTrackStates(),ready=0,working=0,failed=0;states.forEach(function(s){if(s.state==='ready')ready++;else if(s.state==='pending'||s.state==='extracting')working++;else if(s.state==='failed')failed++;});return {total:states.length,ready:ready,working:working,failed:failed}; },
    sacdInProgress: function () { return this.sacdCounts.working > 0; },
    sacdBinaryMissing: function () { return this.sacdStats && !this.sacdStats.binary; },
    sacdFirstError: function () { var found=this.sacdTrackStates().filter(function(s){return s.state==='failed'&&s.error;})[0];return found ? found.error : ''; },
    sacdCacheLabel: function () { var c=this.sacdCounts;if(this.sacdAvailable===false)return this.tr('SACD cache status requires the SACDPlayer plugin');if(c.failed)return this.tr('Extraction failed');if(c.total&&c.ready===c.total)return this.tr('Cached');if(c.working)return this.tr('Preparing…')+' ('+c.ready+' '+this.tr('of')+' '+c.total+')';if(c.ready)return this.tr('Partially cached')+' ('+c.ready+' '+this.tr('of')+' '+c.total+')';return this.tr('Not cached'); },
    sacdActionLabel: function () { if(this.sacdInProgress)return this.tr('Preparing…');return this.sacdCounts.total&&this.sacdCounts.ready===this.sacdCounts.total?this.tr('Remove from cache'):this.tr('Prepare album'); }
  },
  methods: {
    sacdTarget: function () { var track=this.tracks.filter(function(t){return /\.iso#(2ch|mch)-\d{2,3}$/i.test(String(t.url||''));})[0];return track ? track.url : ''; },
    sacdTrackStates: function () { var status=this.sacdStatus&&this.sacdStatus.tracks||[],byNumber={};status.forEach(function(row){byNumber[Number(row.number)]=row;});return this.tracks.filter(function(t){return /\.iso#(2ch|mch)-\d{2,3}$/i.test(String(t.url||''));}).map(function(t,index){var match=String(t.url||'').match(/-(\d{2,3})$/);return byNumber[Number(match?match[1]:index+1)]||{number:index+1,state:'absent',error:''};}); },
    sacdTrackReady: function (track) { var match=String(track.url||'').match(/\.iso#(?:2ch|mch)-(\d{2,3})$/i),number=match?Number(match[1]):0;return !!this.sacdTrackStates().filter(function(row){return row.number===number&&row.state==='ready';})[0]; },
    loadSacdCache: async function () { if(!this.isSacdAlbum)return;this.sacdAvailable=await LmsApi.sacdPlayerAvailable(false);if(!this.sacdAvailable)return;var result=await Promise.all([LmsApi.sacdCacheStats(),LmsApi.sacdAlbumStatus(this.sacdTarget())]);this.sacdStats=result[0];this.sacdStatus=result[1];this.scheduleSacdPoll(); },
    scheduleSacdPoll: function () { if(this.sacdPollTimer){clearTimeout(this.sacdPollTimer);this.sacdPollTimer=null;}if(!this.sacdInProgress)return;var self=this;this.sacdPollTimer=setTimeout(function(){self.loadSacdCache();},5000); },
    changeSacdCache: async function () { if(this.sacdBusy||!this.sacdTarget())return;this.sacdBusy=true;try{if(this.sacdCounts.total&&this.sacdCounts.ready===this.sacdCounts.total)await LmsApi.sacdEvictAlbum(this.sacdTarget());else await LmsApi.sacdPrepareAlbum(this.sacdTarget());await this.loadSacdCache();}catch(e){LmsUi.notify(LmsStore.friendlyError(e,'SACD cache action failed.'),'error',5000);}this.sacdBusy=false; },
    openSacdPluginManager: function () { try{sessionStorage.setItem('echoclassic.plugin-search.v1','SACDPlayer');}catch(e){}this.ui.advancedSettingsPage='/echoclassic/settings/server/plugins.html';LmsUi.setTab('settings');LmsNav.push('settings',{label:'Advanced LMS settings',advanced:true});this.ui.advancedSettings=true; },
    displayOrderStyle: function (key) { var index=this.displayOrder.indexOf(key); return { order: index < 0 ? 99 : index }; },
    configureInformation: function () { LmsLibraryDisplay.open(this.displayContext); },
    discOpen: function (n) {
      if (this.discQuery) return true;
      if (Object.prototype.hasOwnProperty.call(this.discExpanded, n)) return this.discExpanded[n];
      var reported = Math.max.apply(Math, this.tracks.map(function (t) { return Number(t.discCount) || Number(t.disc) || 1; }));
      return reported <= 4;
    },
    toggleDisc: function (n) { this.$set(this.discExpanded, n, !this.discOpen(n)); },
    toggleAllDiscs: function () { var open = !this.allDiscsOpen; this.discQuery = ''; this.discGroups.forEach(function (g) { this.$set(this.discExpanded, g.number, open); }, this); },
    jumpDisc: function (event) {
      var n = Number(event.target.value); if (!n) return;
      this.discQuery = ''; this.$set(this.discExpanded, n, true);
      this.$nextTick(function () { var button = this.$el.querySelector('[data-disc="' + n + '"]'); if (button) { button.scrollIntoView({ block: 'start' }); button.focus(); } });
      event.target.value = '';
    },
    openCredit: function (credit) {
      if (!credit.ids.length) return;
      LmsNav.push('music', { kind: 'artist', id: credit.ids[0], ids: credit.ids, roleId: credit.roleId, label: credit.name, art: null });
    },
    loadMoreTracks: async function () {
      if (this.tracksLoadingMore || !this.tracksHasMore || this.suppliedTracks) return;
      var token = this.trackLoadToken, pid = this.store.playerId || '', albumId = this.album.id;
      this.tracksLoadingMore = true; this.tracksPageError = '';
      try {
        var page = await LmsApi.tracks(pid, albumId, this.tracksOffset, 500);
        if (token !== this.trackLoadToken || albumId !== this.album.id || pid !== (this.store.playerId || '')) return;
        var count = page.sourceCount == null ? page.length : page.sourceCount;
        if (!count && page.total != null && this.tracksOffset < page.total) throw new Error(this.tr('Could not load more tracks'));
        var seen = {}; this.tracks.forEach(function (t) { seen[t.id] = true; });
        this.tracks = this.tracks.concat(page.filter(function (t) { return !seen[t.id]; }));
        this.tracksOffset += count; this.tracksTotal = page.total == null ? null : page.total;
        this.tracksHasMore = page.total == null ? count === 500 : this.tracksOffset < page.total;
      } catch (e) { if (token === this.trackLoadToken) this.tracksPageError = this.tr('Could not load more tracks'); }
      finally { if (token === this.trackLoadToken) this.tracksLoadingMore = false; }
    },
    discNumber: function (track) { return Math.max(1, Number(track && track.disc) || 1); },
    showDiscHeader: function (track, index) {
      if (!this.tracks.some(function (item) { return Number(item.disc) > 1; })) return false;
      return index === 0 || this.discNumber(this.tracks[index - 1]) !== this.discNumber(track);
    },
    discTrackCount: function (disc) {
      return this.tracks.filter(function (track) {
        return Math.max(1, Number(track.disc) || 1) === Number(disc);
      }).length;
    },
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    unique: function (values) {
      return values.filter(function (value, index, all) {
        return value && all.indexOf(value) === index;
      });
    },
    formatLabel: function (value) {
      return LmsFmt.format(value);
    },
    providerFromTrack: function (track) {
      var match = String(track.url || '').match(/^([a-z][a-z0-9+.-]*):\/\//i);
      var scheme = match ? match[1].toLowerCase() : '';
      if (/^(youtube|yt|ytmusic)$/.test(scheme)) return 'youtube';
      if (scheme === 'qobuz') return 'qobuz';
      return track.remote || (scheme && scheme !== 'file') ? 'remote' : 'local';
    },
    dur: function (s) { return LmsFmt.duration(s); },
    hires: function (t) { return LmsFmt.isHiRes(t.sampleRate, t.sampleSize); },
	    shortRate: function (t) {
	      if (!t.sampleRate) return '';
	      return t.sampleRate >= 2822400 ? 'DSD' : Math.round(t.sampleRate / 1000) + 'k';
	    },
	    trackLabel: function (t) {
	      return [t.title, t.artist || this.album.artist || (this.artist && this.artist.name), this.album.title]
	        .filter(Boolean).join(', ');
	    },
    openArtist: function () {
      if (!this.artist) return;
      LmsNav.push('music', {
        kind: 'artist', id: this.artist.id, ids: this.artist.ids,
        label: this.artist.name, art: null
      });
    },
    openRelatedArtist: function (artist) {
      LmsUi.setMusicView('albums');
      LmsUi.setGroup(['relatedArtist']);
      Vue.nextTick(function () {
        LmsNav.push('music', {
          kind: 'artist', id: artist.id, ids: artist.ids,
          label: artist.name, art: null
        });
      });
    },
    play: function (t) {
      if (this.incompleteDisc) return;
      var i = this.tracks.findIndex(function (x) { return x.id === t.id; });
      if (this.disc) return LmsStore.playTrackList(this.tracks, i > 0 ? i : 0, false);
      LmsStore.playContainer('album_id', this.album.id, i > 0 ? i : 0);
    },
    playAlbum: function () {
      if (this.incompleteDisc) return;
      if (this.disc) return LmsStore.playTrackList(this.tracks, 0, false);
      return LmsStore.playContainer('album_id', this.album.id, 0);
    },
    rowItem: function (t) {
      return {
        kind: 'track', id: t.id, title: t.title,
        artist: t.artist || this.album.artist || (this.artist && this.artist.name) || '',
        album: this.album.title, url: t.url, coverId: this.album.id
      };
    },
    selected: function (t) {
      return !!this.ui.selected[LmsUi.selectionKey(this.rowItem(t))];
    },
    isPlaying: function (t) {
      return this.store.np.id != null && t.id != null &&
        String(this.store.np.id) === String(t.id);
    },
    rowClick: function (t) {
      if (this.ui.selectionMode) LmsUi.toggleSelection(this.rowItem(t));
      else this.play(t);
    },
    actions: function (t, event) {
      LmsUi.openActions(this.rowItem(t), event && event.currentTarget);
    },
    shuffle: function () {
      if (this.incompleteDisc) return;
      if (this.disc) return LmsStore.playTrackList(this.tracks, 0, true);
      var id = this.album.id;
      LmsStore.playContainer('album_id', id, 0).then(function () {
        return LmsStore.cycleShuffle();
      });
    },
    albumInfoCacheRead: function () {
      try {
        var parsed = JSON.parse(localStorage.getItem(ECHOCLASSIC_ALBUM_INFO_CACHE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    },
    albumInfoCacheKey: function () {
      return String(this.album.id == null
        ? (this.album.artist || '') + '|' + (this.album.title || '')
        : this.album.id);
    },
    albumInfoCacheGet: function () {
      var key = this.albumInfoCacheKey();
      var entry = this.albumInfoCacheRead().filter(function (item) {
        return item && item.key === key && item.value;
      })[0];
      return entry ? entry.value : null;
    },
    albumInfoCachePut: function (value) {
      var key = this.albumInfoCacheKey();
      var safe = {
        review: value.review || '',
        covers: (value.covers || []).slice(0, 4).map(function (cover) {
          return { url: cover.url || '', credits: cover.credits || '', size: cover.size || '' };
        }).filter(function (cover) { return cover.url; }),
        retrievedAt: value.retrievedAt
      };
      var rows = this.albumInfoCacheRead().filter(function (item) { return item && item.key !== key; });
      rows.unshift({ key: key, retrievedAt: value.retrievedAt, value: safe });
      try { localStorage.setItem(ECHOCLASSIC_ALBUM_INFO_CACHE_KEY,
        JSON.stringify(rows.slice(0, ECHOCLASSIC_ALBUM_INFO_CACHE_LIMIT))); } catch (e) {}
    },
    loadAlbumInfo: async function (force) {
      var token = ++this.albumInfoRequestToken;
      var cached = !force && this.albumInfoCacheGet();
      if (cached) {
        this.albumInfo = cached;
        this.albumInfoStatus = 'ready';
        this.albumReviewExpanded = false;
        return;
      }
      this.albumInfoStatus = 'loading';
      this.albumReviewExpanded = false;
      this.albumSourceVisible = false;
      try {
        var info = await LmsApi.musicAlbumInfo(this.store.playerId || '', this.album.id);
        if (token !== this.albumInfoRequestToken) return;
        if (!info.available) this.albumInfoStatus = 'unavailable';
        else if (!info.review && !info.covers.length && (info.reviewError || info.coversError)) this.albumInfoStatus = 'error';
        else {
          this.albumInfo = { review: info.review || '', covers: info.covers || [], retrievedAt: Date.now() };
          this.albumInfoStatus = 'ready';
          this.albumInfoCachePut(this.albumInfo);
        }
      } catch (e) { if (token === this.albumInfoRequestToken) this.albumInfoStatus = 'error'; }
    },
    openPluginManager: function () {
      try { sessionStorage.setItem('echoclassic.plugin-search.v1', 'MusicArtistInfo'); } catch (e) {}
      this.ui.advancedSettingsPage = '/echoclassic/settings/server/plugins.html';
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Advanced LMS settings', advanced: true });
      this.ui.advancedSettings = true;
      this.ui.advancedSettingsDirty = false;
    },
    openAlbumEqualizer: function () {
      LmsStore.setEqualizerContext({
        type: 'album', albumKey: String(this.album.id), albumTitle: this.album.title,
        artist: this.album.artist || (this.artist && this.artist.name) || '',
        artistLabel: this.album.artist || (this.artist && this.artist.name) || '',
        year: this.album.originalYear || this.album.year || ''
      });
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Equalizer', screen: 'equalizer' });
      this.ui.appearanceScreen = 'equalizer';
    },
    trackEqualizerRule: function (track) {
      var playerId = this.store.playerId;
      var songId = String(track.id);
      return (this.store.equalizer.rules || []).some(function (rule) {
        return rule.playerId === playerId && rule.type === 'song' && rule.key === songId;
      });
    },
    openTrackEqualizer: function (track) {
      LmsStore.setEqualizerContext({
        type: 'song', songKey: String(track.id), songTitle: track.title,
        albumKey: String(this.album.id), albumTitle: this.album.title,
        artist: track.artist || this.album.artist || (this.artist && this.artist.name) || '',
        artistLabel: track.artist || this.album.artist || (this.artist && this.artist.name) || '',
        genre: track.genre || '', year: track.originalYear || track.year || this.album.originalYear || this.album.year || '',
        folder: String(track.url || '').replace(/[?#].*$/, '').replace(/\/[^/]*$/, '')
      });
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Equalizer', screen: 'equalizer' });
      this.ui.appearanceScreen = 'equalizer';
    },
    load: async function () {
      var token = ++this.trackLoadToken;
      if (this.suppliedTracks) { this.tracks = this.suppliedTracks; this.loading = false; this.loadSacdCache(); return; }
	      this.loading = true;
	      this.error = '';
	      this.relatedArtists = [];
	      this.relatedError = '';
	      this.tracksHasMore = false;
      try {
        var pid = this.store.playerId || '';
        var self = this;
        var result = await Promise.all([
          LmsApi.tracks(pid, this.album.id, 0, 500),
          LmsApi.artistsOfAlbum(pid, this.album.id).catch(function (e) {
            self.relatedError = self.tr('Related artists could not be loaded.');
            if (window.console && console.debug) console.debug('[Echo Classic] related artists: ' + self.relatedError);
            return [];
          })
        ]);
        if (token !== this.trackLoadToken || pid !== (this.store.playerId || '')) return;
        this.tracks = result[0];
        this.tracksOffset = result[0].sourceCount == null ? result[0].length : result[0].sourceCount;
        this.tracksTotal = result[0].total == null ? null : result[0].total;
        this.tracksHasMore = this.tracksTotal == null ? this.tracksOffset === 500 : this.tracksOffset < this.tracksTotal;
        var main = String(this.album.artist || (this.artist && this.artist.name) || '');
        this.relatedArtists = result[1].filter(function (artist) {
          return self.normalizeName(artist.name) !== self.normalizeName(main);
        });
        this.$emit('summary', {
          id: this.album.id,
          songCount: this.tracks.length,
          formatLine: this.formatLine,
          bitRateLine: this.bitRateLine,
          originLine: this.originLine,
          relatedArtists: this.relatedArtists.slice()
        });
        this.$nextTick(this.measureRelatedWidth);
        this.loadSacdCache();
      } catch (e) {
        if (token !== this.trackLoadToken) return;
        this.error = e && e.message ? e.message : String(e);
      }
      if (token === this.trackLoadToken) this.loading = false;
    },
    normalizeName: function (value) {
      var name = String(value || '').toLowerCase();
      return name.normalize ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : name;
    },
    measureRelatedWidth: function () {
      var row = this.$refs.relatedRow;
      if (!row || !this.relatedArtists.length || this.relatedExpanded) return;
      var rowStyle = window.getComputedStyle(row);
      var available = row.clientWidth - parseFloat(rowStyle.paddingLeft || 0) -
        parseFloat(rowStyle.paddingRight || 0) - 24;
      var sample = row.querySelector('.related-links button');
      var sampleStyle = sample ? window.getComputedStyle(sample) : rowStyle;
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      context.font = [sampleStyle.fontStyle, sampleStyle.fontWeight,
        sampleStyle.fontSize, sampleStyle.fontFamily].filter(Boolean).join(' ');
      var widths = this.relatedArtists.map(function (artist) {
        return Math.ceil(context.measureText(artist.name).width) + 14;
      });
      var separatorWidth = 10;
      var total = widths.reduce(function (sum, width) { return sum + width; }, 0) +
        separatorWidth * Math.max(0, widths.length - 1);
      var count = widths.length;
      if (total > available) {
        var remaining = Math.max(40, available - 62);
        var used = 0;
        count = 0;
        widths.some(function (width) {
          var next = width + (count ? separatorWidth : 0);
          if (used + next > remaining) return true;
          used += next;
          count += 1;
          return false;
        });
        count = Math.max(1, count);
      }
      if (this.relatedVisibleCount !== count) this.relatedVisibleCount = count;
    }
  },
  created: function () { this.load(); if (this.enrich) this.loadAlbumInfo(); },
  mounted: function () {
    this.measureRelatedWidth();
    if (window.ResizeObserver) {
      var self = this;
      this.relatedObserver = new ResizeObserver(function () { self.measureRelatedWidth(); });
      this.relatedObserver.observe(this.$el);
    } else {
      window.addEventListener('resize', this.measureRelatedWidth);
    }
  },
  watch: { suppliedTracks: function (value) { if (value) this.tracks = value; }, 'album.id': function () { this.discExpanded = {}; this.metadataOpen = false; this.load(); }, 'store.playerId': function () { if (!this.suppliedTracks) this.load(); } },
  beforeDestroy: function () {
    this.trackLoadToken++;
    if (this.sacdPollTimer) clearTimeout(this.sacdPollTimer);
    if (this.relatedObserver) this.relatedObserver.disconnect();
    else window.removeEventListener('resize', this.measureRelatedWidth);
  }
});
