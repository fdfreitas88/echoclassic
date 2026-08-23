
/* v2 invalidates biographies cached before the API boundary converted the
   plugin's optional HTML payload to readable text. */
var ECHOCLASSIC_ARTIST_INFO_CACHE_KEY = 'echoclassic.artist-info.v2';
var ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT = 40;

/* The right-hand pane of Minha Musica. An artist, a genre or a year all resolve
   to a list of albums; an album resolves to its tracks. Selecting an album from
   inside an artist pushes a second frame, which is what gives the nav bar its
   back label. */
Vue.component('lms-detail', {
  props: { frame: { type: Object, required: true } },
  template: `
<div class="detail">
  <div v-if="loading" class="empty"><div class="p">Loading…</div></div>
  <div v-else-if="error" class="empty">
    <div class="h">Could not open</div><div class="p">{{ error }}</div>
    <button class="retry-command" @click="load">Try again</button>
  </div>

  <template v-else-if="frame.kind === 'album'">
    <lms-album-block v-for="a in visibleBlocks" :key="a.id" :album="a" :artist="artist" :enrich="a.id === frame.id"></lms-album-block>
    <div v-if="discographyTruncated" class="loading-more warning" role="status">
      This artist's discography has more than 200 albums and this screen shows the first 200.
    </div>
  </template>

  <template v-else-if="frame.kind === 'musicfolder'">
    <div class="hero"><div class="photo placeholder"><span aria-hidden="true">⌂</span></div><div class="name ell">{{ frame.label }}</div></div>
    <button v-for="item in folderItems" :key="item.key" type="button" class="row noart pointer" @click="openFolderItem(item)">
      <span class="search-kind">{{ item.type === 'folder' ? '⌂' : '♪' }}</span>
      <span class="ell"><span class="t ell">{{ item.name }}</span><span v-if="item.path" class="s ell">{{ item.path }}</span></span>
      <svg v-if="item.type === 'folder'" class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
    </button>
    <div v-if="!folderItems.length" class="empty"><div class="p">This folder is empty.</div></div>
  </template>

  <template v-else>
    <div class="hero">
      <div class="photo" :class="{placeholder: !frame.art || photoFailed}">
        <img v-if="frame.art && !photoFailed" :src="largeArt(frame.art)"
             alt="" @error="photoFailed = true">
        <span v-else aria-hidden="true">{{ initial }}</span>
      </div>
      <div class="name ell">{{ frame.label }}</div>
    </div>

    <section v-if="frame.kind === 'artist'" class="artist-enrichment" aria-labelledby="artist-enrichment-title">
      <span class="opml-new-label">{{ tr('New') }}</span>
      <h2 id="artist-enrichment-title">{{ tr('Artist information') }}</h2>
      <p v-if="frame.id != null" class="artist-enrichment-match">{{ tr('Matched by stable local artist identity.') }}</p>
      <div v-if="enrichmentLoading" class="artist-enrichment-status" role="status">
        {{ tr('Finding artist information…') }}
      </div>
      <div v-else-if="enrichmentStatus === 'unavailable'" class="artist-enrichment-status">
        <p>{{ tr('Artist information requires MusicArtistInfo.') }}</p>
        <button type="button" class="retry-command" @click="openPluginManager">{{ tr('Install plugin') }}</button>
      </div>
      <div v-else-if="enrichmentStatus === 'error'" class="artist-enrichment-status" role="status">
        <p>{{ tr('MusicArtistInfo is temporarily unavailable. Your local library is unchanged.') }}</p>
        <button type="button" class="retry-command" @click="retryEnrichment">{{ tr('Try again') }}</button>
      </div>
      <div v-else-if="enrichmentStatus === 'review'" class="artist-enrichment-status">
        <p>{{ tr('Review match: only the artist name is available. Confirm before loading enrichment.') }}</p>
        <button type="button" class="retry-command" @click="acceptNameMatch">{{ tr('Use this match') }}</button>
      </div>
      <div v-else-if="enrichmentStatus === 'removed'" class="artist-enrichment-status">
        <p>{{ tr('Enrichment removed. Your local library is unchanged.') }}</p>
        <button type="button" class="retry-command" @click="retryEnrichment">{{ tr('Find metadata') }}</button>
      </div>
      <template v-else-if="enrichmentStatus === 'ready'">
        <div class="artist-enrichment-content">
          <img v-if="enrichment.photoUrl" class="artist-enrichment-photo" :src="enrichment.photoUrl"
               :alt="tr('Artist photo')" @error="enrichment.photoUrl = ''">
          <p v-if="enrichment.biography" class="artist-biography" :class="{expanded: enrichmentExpanded}">{{ enrichment.biography }}</p>
          <p v-else class="artist-enrichment-status">{{ tr('No artist biography was found.') }}</p>
        </div>
        <button v-if="enrichment.biography" type="button" class="retry-command artist-biography-toggle"
                :aria-expanded="enrichmentExpanded ? 'true' : 'false'"
                @click="enrichmentExpanded = !enrichmentExpanded">
          {{ tr(enrichmentExpanded ? 'Show less' : 'Read biography') }}
        </button>
        <p v-if="enrichment.photoCredits" class="artist-enrichment-credit">
          {{ tr('Photo credit') }}: {{ enrichment.photoCredits }}
        </p>
        <p class="artist-enrichment-source">
          {{ tr('Provided by MusicArtistInfo from Wikipedia, Last.fm, Discogs and MusicBrainz.') }}
          {{ tr('Retrieved') }} {{ enrichmentRetrieved }}
        </p>
        <div class="artist-enrichment-actions">
          <button type="button" @click="retryEnrichment">{{ tr('Refresh') }}</button>
          <button type="button" @click="removeEnrichment">{{ tr('Hide for now') }}</button>
        </div>
      </template>
    </section>

    <section v-if="classicalWorks.length" class="classical-work-list" aria-labelledby="classical-works-title">
      <h2 id="classical-works-title" class="sectitle">{{ tr('Works') }} · {{ classicalWorks.length }}</h2>
      <button v-for="work in classicalWorks" :key="'work-' + work.id" type="button"
              class="row noart pointer" @click="openWork(work)">
        <span class="search-kind">W</span>
        <span class="ell"><span class="t ell">{{ work.title }}</span><span v-if="work.composer" class="s ell">{{ work.composer }}</span></span>
        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
      </button>
    </section>

    <template v-if="ui.albumMode === 'tracks'">
      <lms-album-block v-for="a in albums" :key="'b' + a.id" :album="a" :enrich="false"></lms-album-block>
      <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
    </template>

    <template v-else>
      <div class="sectitle">{{ tr('Local library') }} · {{ localAlbums.length }}</div>
      <div class="albumgrid">
	        <button v-for="a in localAlbums" :key="'g' + a.id" type="button"
	                class="gcell pointer" @click="openAlbum(a)">
	          <span class="gart" :class="{placeholder: !hasArt(a)}">
	            <img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)">
	            <span v-else class="art-placeholder" aria-hidden="true">♫</span>
	          </span>
	          <span class="gtitle ell">{{ a.title }}</span>
	          <span class="gsub ell">{{ editionLine(a) }}</span>
	        </button>
      </div>
      <template v-if="connectedAlbums.length">
        <div class="sectitle">{{ tr('Also on connected services') }}</div>
        <div class="albumgrid">
          <button v-for="a in connectedAlbums" :key="'remote' + a.id" type="button" class="gcell pointer" @click="openAlbum(a)">
            <span class="gart" :class="{placeholder: !hasArt(a)}"><img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)"><span v-else class="art-placeholder" aria-hidden="true">♫</span></span>
            <span class="gtitle ell">{{ a.title }}</span><span class="gsub ell">{{ a.source }}</span>
          </button>
        </div>
      </template>
      <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
    </template>
    <div v-if="listTruncated" class="loading-more warning" role="status">
      This list has more than 1,000 albums and this screen shows the first 1,000.
    </div>
  </template>
</div>`,
  data: function () {
    return { store: LmsStore.state, ui: LmsUi.state, albums: [], blocks: [], classicalWorks: [], folderItems: [],
             artist: null, failedArt: {}, photoFailed: false,
             loading: true, error: '', requestToken: 0,
             enrichmentLoading: false, enrichmentStatus: '', enrichment: {}, enrichmentExpanded: false,
             nameMatchAccepted: false,
             discographyTruncated: false, listTruncated: false };
  },
  computed: {
    initial: function () {
      return ((this.frame.label || '?').trim().charAt(0) || '?').toUpperCase();
    },
    bigArt: function () { return this.frame.art ? this.frame.art.replace('_50x50', '') : ''; },
    artistName: function () {
      return this.artist ? this.artist.name : ((this.frame.sub || '').split(' • ')[0] || '—');
    },
    enrichmentRetrieved: function () {
      if (!this.enrichment.retrievedAt) return '';
      try { return new Date(this.enrichment.retrievedAt).toLocaleString(); }
      catch (e) { return String(this.enrichment.retrievedAt); }
    },
    localAlbums: function () { return this.albums.filter(function (a) { return !a.source || a.source === 'Local library'; }); },
    connectedAlbums: function () { return this.albums.filter(function (a) { return a.source && a.source !== 'Local library'; }); },
    /* No modo Albuns a pagina mostra so o album escolhido; no modo Faixas ela
       empilha a discografia inteira. */
    visibleBlocks: function () {
      return this.ui.albumMode === 'tracks' ? this.blocks : this.blocks.slice(0, 1);
    }
  },
  watch: {
    frame: function () { this.load(); }
  },
  methods: {
    openFolderItem: function (item) {
      if (item.type === 'folder') {
        LmsNav.push('music', { kind: 'musicfolder', id: item.id, label: item.name, path: item.path });
      } else {
        LmsUi.openActions({ kind: 'track', id: item.id, title: item.title || item.name, url: item.url });
      }
    },
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    /* Mesma familia do ERR-01 que a tela de Apps mostrava: aqui o catch
       tambem entregava e.message inteiro, com o marcador do tipo de falha e o
       comando RPC. friendlyError deixa a string do protocolo no console; a
       tela recebe a familia da falha e a acao humana. */
    serviceError: function (e) {
      return this.tr(LmsStore.friendlyError(e, 'This screen did not load.')) + ' ' +
        this.tr('Check the connection or the service status and try again.');
    },
    largeArt: function (url) { return (url || '').replace('_50x50', ''); },
    hasArt: function (album) { return !!album.art && !this.failedArt[album.id]; },
    markArtFailed: function (album) { this.$set(this.failedArt, album.id, true); },
    artistInfoCacheRead: function () {
      try {
        var parsed = JSON.parse(localStorage.getItem(ECHOCLASSIC_ARTIST_INFO_CACHE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    },
    artistInfoCacheGet: function (id) {
      var key = String(id == null ? '' : id);
      var entry = this.artistInfoCacheRead().filter(function (item) {
        return item && item.key === key && item.value;
      })[0];
      return entry ? entry.value : null;
    },
    artistInfoCachePut: function (id, value) {
      var key = String(id == null ? '' : id);
      var safe = {
        biography: value.biography || '', photoCredits: value.photoCredits || '',
        /* Never persist provider query strings or remote URLs. Relative LMS
           image-proxy paths without a query are safe to retain. */
        photoUrl: /^\/?(?:imageproxy\/|music\/)/.test(value.photoUrl || '') &&
          String(value.photoUrl).indexOf('?') < 0 ? value.photoUrl : '',
        retrievedAt: value.retrievedAt
      };
      var rows = this.artistInfoCacheRead().filter(function (item) { return item && item.key !== key; });
      rows.unshift({ key: key, retrievedAt: value.retrievedAt, value: safe });
      try { localStorage.setItem(ECHOCLASSIC_ARTIST_INFO_CACHE_KEY,
        JSON.stringify(rows.slice(0, ECHOCLASSIC_ARTIST_INFO_CACHE_LIMIT))); } catch (e) {}
    },
    loadEnrichment: async function (token, force) {
      if (this.frame.kind !== 'artist') return;
      if (this.frame.id == null && !this.nameMatchAccepted) {
        this.enrichmentStatus = 'review';
        this.enrichmentLoading = false;
        return;
      }
      var cacheKey = this.frame.id != null ? this.frame.id : this.frame.label;
      var cached = !force && this.artistInfoCacheGet(cacheKey);
      if (cached) {
        this.enrichment = cached;
        this.enrichmentStatus = 'ready';
        this.enrichmentLoading = false;
        return;
      }
      this.enrichmentLoading = true;
      this.enrichmentStatus = '';
      try {
        var result = await LmsApi.musicArtistInfo(this.store.playerId || '', this.frame.id, this.frame.label);
        if (token !== this.requestToken) return;
        if (!result.available) {
          this.enrichmentStatus = 'unavailable';
        } else if (!result.biography && !result.photoUrl &&
                   (result.biographyError || result.photoError)) {
          this.enrichmentStatus = 'error';
        } else {
          this.enrichment = {
            biography: result.biography || '', photoUrl: result.photoUrl || '',
            photoCredits: result.photoCredits || '', retrievedAt: Date.now()
          };
          this.enrichmentStatus = 'ready';
          this.artistInfoCachePut(cacheKey, this.enrichment);
        }
      } catch (e) {
        if (token !== this.requestToken) return;
        this.enrichmentStatus = 'error';
      }
      if (token === this.requestToken) this.enrichmentLoading = false;
    },
    retryEnrichment: function () { this.requestToken++; this.loadEnrichment(this.requestToken, true); },
    acceptNameMatch: function () { this.nameMatchAccepted = true; this.requestToken++; this.loadEnrichment(this.requestToken, true); },
    removeEnrichment: function () {
      this.requestToken++;
      this.enrichment = {};
      this.enrichmentStatus = 'removed';
    },
    openPluginManager: function () {
      try { sessionStorage.setItem('echoclassic.plugin-search.v1', 'MusicArtistInfo'); } catch (e) {}
      this.ui.advancedSettingsPage = '/echoclassic/settings/server/plugins.html';
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Advanced LMS settings', advanced: true });
      this.ui.advancedSettings = true;
      this.ui.advancedSettingsDirty = false;
    },
    editionLine: function (album) {
      var parts = [];
      if (album.editionCount > 1) parts.push('Edition ' + (album.year || 'Not specified'));
      else if (album.year) parts.push(String(album.year));
      if (album.originalYear) parts.push('original ' + album.originalYear);
      if (!parts.length && album.artist) parts.push(album.artist);
      return parts.join(' • ');
    },
    editionBase: function (title) {
      return String(title || '').toLowerCase()
        .replace(/\s*[\[(](deluxe|expanded|remaster(?:ed)?|anniversary|edition|edição|reissue|mono|stereo).*?[\])]\s*/gi, '')
        .replace(/\s*[-–—]\s*(deluxe|expanded|remaster(?:ed)?|anniversary|edition|edição|reissue).*$/gi, '')
        .trim();
    },
    markEditions: function (albums) {
      var self = this;
      var counts = {};
      albums.forEach(function (a) {
        var key = self.editionBase(a.title);
        counts[key] = (counts[key] || 0) + 1;
      });
      albums.forEach(function (a) { a.editionCount = counts[self.editionBase(a.title)] || 1; });
      return albums.sort(function (a, b) {
        var base = self.editionBase(a.title).localeCompare(self.editionBase(b.title), 'pt-BR');
        return base || Number(a.year || 0) - Number(b.year || 0);
      });
    },
    fmtDur: function (s) { return LmsFmt.duration(s); },
    hires: function (t) { return LmsFmt.isHiRes(t.sampleRate, t.sampleSize); },
    shortRate: function (t) {
      if (!t.sampleRate) return '';
      return t.sampleRate >= 2822400 ? 'DSD' : Math.round(t.sampleRate / 1000) + 'k';
    },
    openArtist: function () {
      if (!this.artist) return;
      LmsNav.push('music', {
        kind: 'artist', id: this.artist.id, ids: this.artist.ids,
        label: this.artist.name, art: null
      });
    },
    openAlbum: function (a) {
      LmsNav.push('music', {
        kind: 'album', id: a.id, label: a.title,
        sub: [a.artist, a.year || null].filter(Boolean).join(' • '),
        art: a.art, year: a.year, originalYear: a.originalYear
      });
    },
    openWork: function (work) {
      LmsNav.push('music', { kind: 'work', id: work.id, label: work.title,
        sub: work.composer || this.frame.label, composerId: work.composerId });
    },
    /* Carregar o album inteiro e saltar para a faixa e o que o LMS faz. Mandar
       so a faixa deixava a fila do servidor com um item e sem "proxima". */
    playTrack: function (t) {
      var i = this.tracks.findIndex(function (x) { return x.id === t.id; });
      LmsStore.playContainer('album_id', this.frame.id, i > 0 ? i : 0);
    },
    playAll: function () {
      if (this.tracks.length) LmsStore.playContainer('album_id', this.frame.id, 0);
    },
    shuffle: function () {
      if (!this.tracks.length) return;
      LmsStore.playContainer('album_id', this.frame.id, 0).then(function () {
        return LmsStore.cycleShuffle();
      });
    },
    load: async function () {
      /* O componente e reaproveitado entre quadros (browse.js o renderiza sem
         :key) e o watch de frame dispara um load novo por cima do anterior. Sem
         token, a resposta lenta do artista A sobrescrevia a tela do artista B
         ja renderizada. Mesmo padrao de browse.js. */
      var token = ++this.requestToken;
      this.loading = true;
      this.error = '';
      this.albums = [];
      this.blocks = [];
      this.classicalWorks = [];
      this.folderItems = [];
      this.artist = null;
      this.failedArt = {};
      this.photoFailed = false;
      this.enrichmentLoading = false;
      this.enrichmentStatus = '';
      this.enrichment = {};
      this.enrichmentExpanded = false;
      this.nameMatchAccepted = false;
      this.discographyTruncated = false;
      this.listTruncated = false;
      var pid = this.store.playerId || '';
      var f = this.frame;
      try {
        if (f.kind === 'musicfolder') {
          this.folderItems = await LmsApi.musicFolders(pid, f.id);
          if (token !== this.requestToken) return;
          this.loading = false;
          return;
        } else if (f.kind === 'album') {
          /* O album escolhido vem primeiro e o resto da discografia abaixo, cada
             um como um bloco completo. Cada bloco busca as proprias faixas, entao
             a tela aparece em partes em vez de esperar all os albuns. */
          var current = {
            id: f.id, title: f.label, art: f.art,
            year: f.year || ((f.sub || '').split(' • ')[1] || ''),
            originalYear: f.originalYear || 0,
            artist: (f.sub || '').split(' • ')[0] || ''
          };
          this.blocks = [current];
          this.loading = false;
          var quem = await LmsApi.artistOfAlbum(pid, f.id);
          if (token !== this.requestToken) return;
          this.artist = quem;
          if (this.artist) {
            var artistFilter = this.artist.ids && this.artist.ids.length > 1
              ? { artistIds: this.artist.ids }
              : { artistId: this.artist.id };
            var all = await LmsApi.albums(pid, 0, 200, artistFilter);
            if (token !== this.requestToken) return;
            this.discographyTruncated = all.length >= 200;
            this.blocks = [current].concat(all
              .filter(function (x) { return x.id !== f.id; })
              .map(function (x) {
                return { id: x.id, title: x.title, year: x.year,
                         originalYear: x.originalYear, releaseType: x.releaseType,
                         artist: x.artist,
                         art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null };
              }));
            var marked = this.markEditions(this.blocks);
            var selected = marked.filter(function (album) { return album.id === f.id; })[0] || current;
            this.blocks = [selected].concat(marked.filter(function (album) { return album.id !== f.id; }));
          }
          return;
        } else {
          var filter = {};
          if (/^(artist|composer|conductor|ensemble)$/.test(f.kind)) {
            this.loadEnrichment(token, false);
            if (f.ids && f.ids.length > 1) filter.artistIds = f.ids;
            else filter.artistId = f.id;
            if (f.kind !== 'artist') {
              var roleId = f.kind === 'composer' ? 2 : f.kind === 'conductor' ? 3 : 4;
              this.classicalWorks = await LmsApi.works(pid, 0, 1000, { composerId: f.id, roleId: roleId });
              if (token !== this.requestToken) return;
            }
          }
          else if (f.kind === 'genre') filter.genreId = f.id;
          else if (f.kind === 'year') filter.year = f.id;
          else if (f.kind === 'work') filter.workId = f.id;
          else if (f.kind === 'releasetype') filter.releaseType = f.label;
          var al = await LmsApi.albums(pid, 0, 1000, filter);
          if (token !== this.requestToken) return;
          this.listTruncated = al.length >= 1000;
          this.albums = this.markEditions(al.map(function (x) {
            return {
              id: x.id, title: x.title, year: x.year,
              originalYear: x.originalYear, releaseType: x.releaseType,
              artist: x.artist,
              source: x.source || 'Local library',
              art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null
            };
          }));
        }
      } catch (e) {
        if (token !== this.requestToken) return;
        /* Um erro depois de o bloco do album ja estar na tela nao pode apagar o
           que carregou certo: o pedido secundario falhou, o album nao. */
        if (this.blocks.length || this.albums.length) {
          LmsUi.notify(this.tr('Part of this screen could not be loaded. ') +
            this.serviceError(e), 'error', 6500);
        } else {
          this.error = this.serviceError(e);
        }
      }
      if (token !== this.requestToken) return;
      this.loading = false;
    }
  },
  created: function () { this.load(); }
});
