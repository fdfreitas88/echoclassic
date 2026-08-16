
/* Um album completo: cabecalho, linha de aleatorio e faixas. Existe como
   componente proprio porque a tela de album empilha um bloco destes por album do
   artista — o escolhido primeiro, os outros abaixo — e cada bloco carrega as
   proprias faixas, o que faz a lista aparecer em partes em vez de esperar todos.

   O bloco tambem e usado sozinho quando o album e aberto pela raiz Albuns. */
Vue.component('lms-album-block', {
  props: {
    album: { type: Object, required: true },
    artist: { type: Object, default: null },
    enrich: { type: Boolean, default: true }
  },
  template: `
<div class="albumblock">
  <div class="albumhead">
    <div class="albumart" :class="{placeholder: !artUrl || artFailed}">
      <img v-if="artUrl && !artFailed" :src="artUrl" alt="" @error="artFailed = true">
      <span v-else class="art-placeholder" aria-hidden="true">♫</span>
    </div>
    <div class="albummeta">
      <div class="album-title-row" :class="{pending: !albumSource}">
        <span class="album-source" :class="'source-' + (albumSource || 'pending')"
              :title="sourceTitle" :aria-label="sourceTitle">
          <svg v-if="albumSource === 'local'" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4zM7 15.5h.01M10 15.5h7"/></svg>
          <span v-else-if="albumSource === 'qobuz'" class="provider-mark" aria-hidden="true">Q</span>
          <span v-else-if="albumSource === 'youtube'" class="provider-mark" aria-hidden="true">Y</span>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.2 4.7 4.7 0 0 0 7 18.5z"/></svg>
        </span>
        <div class="atitle">{{ album.title }}</div>
      </div>
      <button v-if="artist" class="aartist pointer" @click="openArtist">{{ artist.name }}</button>
      <div v-else-if="album.artist" class="aartist">{{ album.artist }}</div>
      <div class="ameta">{{ metaLine }}</div>
      <div v-if="album.originalYear || album.year" class="edition-years">
        <span>Year of this edition: {{ album.year || 'not available' }}</span>
        <span>Original year: {{ album.originalYear || 'not available' }}</span>
      </div>
      <div v-if="tracks.length" class="album-facts" aria-label="Album technical details">
        <span class="album-fact" :title="tr('Format:') + ' ' + formatLine">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4V21.5H6zM14 2.5v4h4"/></svg>
          <span>{{ formatLine }}</span>
        </span>
        <span class="album-fact" :title="'Bit rate: ' + bitRateLine">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-6M8 18V6M12 14v-4M16 19V5M20 15V9"/></svg>
          <span>{{ bitRateLine }}</span>
        </span>
        <span class="album-fact" :title="tr('Source:') + ' ' + originLine">
          <svg v-if="originIsLocal" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4zM7 15.5h.01M10 15.5h7"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.2 4.7 4.7 0 0 0 7 18.5z"/></svg>
          <span>{{ originLine }}</span>
        </span>
      </div>
    </div>
  </div>

  <section v-if="albumInfoStatus" class="album-enrichment">
    <span class="opml-new-label">{{ tr('New') }}</span>
    <h3>{{ tr('Album information') }}</h3>
    <div v-if="albumInfoStatus === 'loading'" role="status">{{ tr('Finding album information…') }}</div>
    <div v-else-if="albumInfoStatus === 'unavailable'" role="status">
      <p>{{ tr('Album information requires MusicArtistInfo.') }}</p>
      <button type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button>
    </div>
    <template v-else-if="albumInfoStatus === 'ready'">
      <p v-if="albumInfo.review" class="album-review" :class="{expanded: albumReviewExpanded}">{{ albumInfo.review }}</p>
      <button v-if="albumInfo.review" type="button" class="retry-command artist-biography-toggle"
              :aria-expanded="albumReviewExpanded ? 'true' : 'false'" @click="albumReviewExpanded = !albumReviewExpanded">
        {{ tr(albumReviewExpanded ? 'Show less' : 'Read review') }}
      </button>
      <div v-if="albumInfo.covers.length" class="album-cover-candidates" :aria-label="tr('Reference artwork')">
        <figure v-for="(cover, index) in albumInfo.covers.slice(0, 4)" :key="cover.url + index">
          <img :src="cover.url" :alt="tr('Reference artwork')"><figcaption>{{ cover.credits || cover.size }}</figcaption>
        </figure>
      </div>
      <p class="artist-enrichment-source">{{ tr('Provided by MusicArtistInfo from Last.fm, Discogs and MusicBrainz.') }} {{ tr('Retrieved') }} {{ albumInfoRetrieved }}</p>
      <div class="artist-enrichment-actions"><button type="button" @click="loadAlbumInfo">{{ tr('Refresh') }}</button><button type="button" @click="removeAlbumInfo">{{ tr('Hide for now') }}</button></div>
    </template>
    <div v-else-if="albumInfoStatus === 'removed'" role="status">{{ tr('Enrichment removed. Your local library is unchanged.') }} <button type="button" class="retry-command" @click="loadAlbumInfo">{{ tr('Find metadata') }}</button></div>
    <div v-else role="status">{{ tr('Album information is temporarily unavailable.') }} <button type="button" class="retry-command" @click="loadAlbumInfo">{{ tr('Try again') }}</button></div>
  </section>

  <div v-if="relatedArtists.length" ref="relatedRow" class="album-extra album-related"
       :class="{expanded: relatedExpanded}">
    <svg class="related-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 19.5v-1.3c0-2.1-1.8-3.7-4-3.7H7c-2.2 0-4 1.6-4 3.7v1.3M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 8h5M18.5 5.5v5"/>
    </svg>
    <div class="related-links">
      <strong>{{ tr('Local library') }}</strong>
      <template v-for="(a, index) in displayedRelatedArtists">
        <span v-if="index" :key="'separator-' + a.id" class="related-separator" aria-hidden="true">•</span>
        <button :key="a.id" @click="openRelatedArtist(a)">{{ a.name }}</button>
      </template>
    </div>
    <button v-if="hasHiddenRelated" class="related-more"
            :aria-expanded="String(relatedExpanded)" @click="relatedExpanded = !relatedExpanded">
      <span>{{ tr(relatedExpanded ? 'Show less' : 'Show more') }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 5 5-5"/></svg>
    </button>
  </div>

	  <button type="button" class="shufflerow pointer" @click="shuffle">
	    <svg viewBox="0 0 24 24"><path d="M16 3l4 4-4 4M4 7h16M8 21l-4-4 4-4M20 17H4"/></svg>
	    <span>Shuffle</span>
	  </button>

  <div v-if="loading" class="empty"><div class="p">Loading tracks…</div></div>
  <div v-else-if="error" class="empty">
    <div class="p">{{ error }}</div>
    <button class="retry-command" @click="load">Try again</button>
  </div>
  <template v-else>
	    <div v-for="t in tracks" :key="t.id" class="trow"
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
	        <span v-if="hires(t)" class="spec">{{ shortRate(t) }}</span>
	        <span class="dur">{{ dur(t.duration) }}</span>
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
	    <div v-if="!tracks.length" class="empty"><div class="p">This album returned no tracks.</div></div>
	    <div v-if="tracksHasMore" class="loading-more warning" role="status">
	      This album has more tracks than the screen loaded.
	    </div>
	  </template>
	</div>`,
  data: function () {
    return { store: LmsStore.state, ui: LmsUi.state, tracks: [], artFailed: false,
	             relatedArtists: [], relatedVisibleCount: 1, relatedExpanded: false,
	             tracksHasMore: false, albumInfoStatus: '', albumInfo: { review: '', covers: [] }, albumReviewExpanded: false,
	             albumInfoRequestToken: 0,
	             relatedObserver: null, loading: true, error: '' };
  },
  computed: {
    artUrl: function () { return (this.album.art || '').replace('_50x50', ''); },
    metaLine: function () {
      var n = this.tracks.length;
      /* A frase e montada por concatenacao, entao o texto pronto nunca bate
         com uma chave do dicionario. Traduz-se a unidade antes de juntar. */
      var unit = (n === 1) ? 'song' : 'songs';
      if (window.LmsStr) unit = LmsStr.t(unit);
      return [this.album.releaseType || '', n ? n + ' ' + unit : '']
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
    }
  },
  methods: {
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
      var i = this.tracks.findIndex(function (x) { return x.id === t.id; });
      LmsStore.playContainer('album_id', this.album.id, i > 0 ? i : 0);
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
      var id = this.album.id;
      LmsStore.playContainer('album_id', id, 0).then(function () {
        return LmsStore.cycleShuffle();
      });
    },
    loadAlbumInfo: async function () {
      var token = ++this.albumInfoRequestToken;
      this.albumInfoStatus = 'loading';
      this.albumReviewExpanded = false;
      try {
        var info = await LmsApi.musicAlbumInfo(this.store.playerId || '', this.album.id);
        if (token !== this.albumInfoRequestToken) return;
        if (!info.available) this.albumInfoStatus = 'unavailable';
        else if (!info.review && !info.covers.length && (info.reviewError || info.coversError)) this.albumInfoStatus = 'error';
        else {
          this.albumInfo = { review: info.review || '', covers: info.covers || [], retrievedAt: Date.now() };
          this.albumInfoStatus = 'ready';
        }
      } catch (e) { if (token === this.albumInfoRequestToken) this.albumInfoStatus = 'error'; }
    },
    removeAlbumInfo: function () {
      this.albumInfoRequestToken++;
      this.albumInfo = { review: '', covers: [] };
      this.albumInfoStatus = 'removed';
    },
    openPluginManager: function () {
      try { sessionStorage.setItem('echoclassic.plugin-search.v1', 'MusicArtistInfo'); } catch (e) {}
      this.ui.advancedSettingsPage = '/echoclassic/settings/server/plugins.html';
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Advanced LMS settings', advanced: true });
      this.ui.advancedSettings = true;
      this.ui.advancedSettingsDirty = false;
    },
    load: async function () {
	      this.loading = true;
	      this.error = '';
	      this.relatedArtists = [];
	      this.tracksHasMore = false;
      try {
        var pid = this.store.playerId || '';
        var result = await Promise.all([
          LmsApi.tracks(pid, this.album.id, 0, 500),
          LmsApi.artistsOfAlbum(pid, this.album.id).catch(function () { return []; })
        ]);
	        this.tracks = result[0];
	        this.tracksHasMore = (result[0].sourceCount == null ? result[0].length : result[0].sourceCount) === 500;
        var main = String(this.album.artist || (this.artist && this.artist.name) || '');
        var self = this;
        this.relatedArtists = result[1].filter(function (artist) {
          return self.normalizeName(artist.name) !== self.normalizeName(main);
        });
        this.$nextTick(this.measureRelatedWidth);
      } catch (e) {
        this.error = e && e.message ? e.message : String(e);
      }
      this.loading = false;
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
  beforeDestroy: function () {
    if (this.relatedObserver) this.relatedObserver.disconnect();
    else window.removeEventListener('resize', this.measureRelatedWidth);
  }
});
