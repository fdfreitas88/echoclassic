
/* Search global da biblioteca. O componente recebe apenas dados normalizados de
   api.js e leva cada resultado para a mesma pilha usada por Minha Musica. */
Vue.component('lms-search', {
  template: `
<div class="search-body scroller">
  <div class="advanced-search-bar">
    <button type="button" class="text-command" :class="{on: advancedOpen}"
            :aria-expanded="String(advancedOpen)" @click="advancedOpen = !advancedOpen">Filters</button>
    <span v-if="activeFilterCount" class="advanced-search-summary">{{ activeFilterCount }} active</span>
    <button v-if="activeFilterCount" type="button" class="text-command" @click="clearAdvanced">Clear</button>
  </div>
  <div v-if="advancedOpen" class="advanced-search-panel" aria-label="Advanced search filters">
    <div class="advanced-search-types" role="group" aria-label="Result types">
      <button v-for="type in searchTypeOptions" :key="type.key" type="button"
              :class="{on: searchTypes.indexOf(type.key) >= 0}" :aria-pressed="String(searchTypes.indexOf(type.key) >= 0)"
              @click="toggleSearchType(type.key)">{{ type.label }}</button>
    </div>
    <label>Year <input v-model.trim="yearFilter" inputmode="numeric" placeholder="e.g. 1965 or 1960–1969" aria-label="Filter by year"></label>
    <label>Source <select v-model="sourceFilter" aria-label="Filter by source"><option value="">Any source</option><option value="local">Local library</option><option value="stream">Streaming</option></select></label>
    <label>Format <input v-model.trim="formatFilter" placeholder="e.g. FLAC, MP3" aria-label="Filter by format"></label>
    <label>Release type <input v-model.trim="releaseTypeFilter" placeholder="e.g. Album, EP, Live" aria-label="Filter by release type"></label>
    <label>Composer <input v-model.trim="composerFilter" placeholder="Composer name" aria-label="Filter by composer"></label>
    <label>Work <input v-model.trim="workFilter" placeholder="Work title" aria-label="Filter by work title"></label>
    <fieldset v-if="roots.length > 1" class="advanced-search-roots"><legend>Search in</legend>
      <label v-for="root in roots" :key="root.key"><input type="checkbox" :checked="selectedRoots.indexOf(root.key) >= 0" @change="toggleRoot(root.key)"> {{ root.name }}</label>
    </fieldset>
    <p>Search artists, albums, classical works, tracks and playlists across one or more library roots.</p>
  </div>
  <div v-if="!effectiveQuery" class="empty">
    <div class="h">Search the library</div>
    <div class="p">Type an artist, album or track.</div>
  </div>
  <div v-else-if="loading && !total" class="empty"><div class="p">Searching…</div></div>
  <div v-else-if="error" class="empty">
    <div class="h">Search failed</div>
    <div class="p">{{ error }}</div>
    <button class="retry-command" @click="run">Try again</button>
  </div>
  <div v-else-if="!total" class="empty">
    <div class="h">No results</div>
    <div class="p">We did not find “{{ effectiveQuery }}” in your library.</div>
  </div>
  <template v-else>
    <div v-if="loading" class="search-refreshing" role="status" aria-live="polite">Searching…</div>
	    <section v-if="results.artists.length && typeVisible('artists')" class="search-group">
	      <h2 class="search-heading">Artists <span>{{ results.artists.length }}</span></h2>
	      <button v-for="a in results.artists" :key="'ar' + a.id"
	              type="button" class="row noart pointer search-result"
	              @click="openArtist(a)">
	        <span class="search-kind">A</span>
	        <span class="ell"><span class="t ell">{{ a.name }}</span></span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="results.albums.length && typeVisible('albums')" class="search-group">
	      <h2 class="search-heading">Albums <span>{{ results.albums.length }}</span></h2>
	      <button v-for="a in results.albums" :key="'al' + a.id"
	              type="button" class="row pointer search-result"
	              @click="openAlbum(a)">
	        <span class="art" :style="art(a.artworkTrackId)"></span>
	        <span class="ell">
	          <span class="t ell">{{ a.title }}</span>
	          <span v-if="albumSubtitle(a)" class="s ell">{{ albumSubtitle(a) }}</span>
	          <span v-if="a.rootName" class="s ell">{{ a.rootName }}</span>
	        </span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="(results.works || []).length && typeVisible('works')" class="search-group">
	      <h2 class="search-heading">Works <span>{{ results.works.length }}</span></h2>
	      <button v-for="w in results.works" :key="'wo' + w.id" type="button"
	              class="row noart pointer search-result" @click="openWork(w)">
	        <span class="search-kind">W</span>
	        <span class="ell"><span class="t ell">{{ w.title }}</span><span v-if="w.composer" class="s ell">{{ w.composer }}</span><span v-if="w.rootName" class="s ell">{{ w.rootName }}</span></span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="results.tracks.length && typeVisible('tracks')" class="search-group">
	      <h2 class="search-heading">Tracks <span>{{ results.tracks.length }}</span></h2>
	      <div v-for="t in results.tracks" :key="'tr' + t.id"
	           class="row search-result" role="group" :aria-label="trackLabel(t)">
	        <button type="button" class="row-main pointer" :aria-label="trackLabel(t)"
	                @click="openTrack(t, $event)">
	          <span class="art" :style="art(t.coverId)"></span>
	          <span class="ell">
	            <span class="t ell">{{ t.title }}</span>
	            <span class="s ell">{{ trackSubtitle(t) }}</span>
	          </span>
	        </button>
	        <button class="more-command" title="More actions"
	                :aria-label="'More actions for ' + t.title"
	                @click.stop="trackActions(t, $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle class="more-ring" cx="12" cy="12" r="8.5"/>
            <circle class="more-dot" cx="8.5" cy="12" r="1"/>
            <circle class="more-dot" cx="12" cy="12" r="1"/>
            <circle class="more-dot" cx="15.5" cy="12" r="1"/>
          </svg>
	        </button>
	      </div>
	    </section>

	    <section v-if="results.playlists.length && typeVisible('playlists')" class="search-group">
	      <h2 class="search-heading">Playlists <span>{{ results.playlists.length }}</span></h2>
	      <button v-for="p in results.playlists" :key="'pl' + p.id"
	              type="button" class="row noart pointer search-result"
	              @click="openPlaylist(p)">
	        <span class="search-kind">P</span>
	        <span class="ell"><span class="t ell">{{ p.name }}</span></span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>
    <button v-if="hasMore" class="load-more-command" :disabled="loading" @click="loadMore">
      {{ loading ? 'Searching…' : 'Show more results' }}
    </button>
  </template>
</div>`,
  data: function () {
    return {
      ui: LmsUi.state, store: LmsStore.state,
      results: { artists: [], albums: [], tracks: [], playlists: [] },
      loading: false, error: '', timer: null, request: 0, limit: 50,
      restoreScroll: 0, advancedOpen: false, searchTypes: [], yearFilter: '', sourceFilter: '',
      composerFilter: '', workFilter: '', formatFilter: '', releaseTypeFilter: '', roots: [], selectedRoots: [],
      searchTypeOptions: [
        { key: 'artists', label: 'Artists' }, { key: 'albums', label: 'Albums' },
        { key: 'works', label: 'Works' }, { key: 'tracks', label: 'Tracks' },
        { key: 'playlists', label: 'Playlists' }
      ]
    };
  },
  computed: {
    query: function () { return this.ui.query; },
    total: function () {
      return ['artists', 'albums', 'works', 'tracks', 'playlists'].reduce(function (sum, key) {
        return sum + (this.typeVisible(key) ? (this.results[key] || []).length : 0);
      }.bind(this), 0);
    },
    activeFilterCount: function () { return this.searchTypes.length + (this.yearFilter ? 1 : 0) +
      (this.sourceFilter ? 1 : 0) + (this.formatFilter ? 1 : 0) + (this.releaseTypeFilter ? 1 : 0) +
      (this.composerFilter ? 1 : 0) + (this.workFilter ? 1 : 0) +
      (this.selectedRoots.length > 1 ? 1 : 0); },
    effectiveQuery: function () { return [this.query.trim(), this.composerFilter, this.workFilter].filter(Boolean).join(' '); },
    hasMore: function () {
      var limit = this.limit;
      return ['artists', 'albums', 'works', 'tracks', 'playlists'].some(function (key) {
        return this.typeVisible(key) && (this.results[key] || []).length >= limit;
      }, this);
    }
  },
  watch: {
    query: function () { this.schedule(); },
    yearFilter: function () { this.schedule(); },
    sourceFilter: function () { this.schedule(); },
    formatFilter: function () { this.schedule(); },
    releaseTypeFilter: function () { this.schedule(); },
    composerFilter: function () { this.schedule(); },
    workFilter: function () { this.schedule(); },
    selectedRoots: { deep: true, handler: function () { this.schedule(); } }
  },
  methods: {
    loadRoots: async function () {
      this.roots = LmsApi.libraryRoots
        ? await LmsApi.libraryRoots(this.store.playerId || '')
        : [{ type: 'all', id: '', key: 'all', name: 'All music' }];
      if (!this.selectedRoots.length) this.selectedRoots = [this.ui.rootKey || 'all'];
      this.selectedRoots = this.selectedRoots.filter(function (key) {
        return this.roots.some(function (root) { return root.key === key; });
      }, this);
      if (!this.selectedRoots.length) this.selectedRoots = ['all'];
    },
    typeVisible: function (key) { return !this.searchTypes.length || this.searchTypes.indexOf(key) >= 0; },
    toggleSearchType: function (key) {
      var at = this.searchTypes.indexOf(key);
      if (at < 0) this.searchTypes.push(key); else this.searchTypes.splice(at, 1);
    },
    toggleRoot: function (key) {
      var at = this.selectedRoots.indexOf(key);
      if (at < 0) {
        if (key === 'all') this.selectedRoots = ['all'];
        else {
          this.selectedRoots = this.selectedRoots.filter(function (item) { return item !== 'all'; });
          this.selectedRoots.push(key);
        }
      }
      else if (this.selectedRoots.length > 1) this.selectedRoots.splice(at, 1);
    },
    clearAdvanced: function () {
      this.searchTypes = []; this.yearFilter = ''; this.sourceFilter = '';
      this.formatFilter = ''; this.releaseTypeFilter = ''; this.composerFilter = ''; this.workFilter = '';
      this.selectedRoots = [this.ui.rootKey || 'all'];
    },
    applyAdvanced: function (found) {
      var year = String(this.yearFilter || '').match(/^(\d{4})(?:\s*[-–]\s*(\d{4}))?$/);
      var from = year ? Number(year[1]) : 0;
      var to = year ? Number(year[2] || year[1]) : 0;
      function inYear(item) {
        if (!from) return true;
        var value = Number(item.originalYear || item.year || 0);
        return value >= Math.min(from, to) && value <= Math.max(from, to);
      }
      found.albums = found.albums.filter(inYear);
      var releaseType = String(this.releaseTypeFilter || '').toLocaleLowerCase();
      if (releaseType) found.albums = found.albums.filter(function (album) {
        return String(album.releaseType || '').toLocaleLowerCase().indexOf(releaseType) >= 0;
      });
      found.tracks = found.tracks.filter(inYear).filter(function (track) {
        if (!this.sourceFilter) return true;
        var local = track.source === 'Local library';
        return this.sourceFilter === 'local' ? local : !local;
      }, this);
      var format = String(this.formatFilter || '').toLocaleLowerCase();
      if (format) found.tracks = found.tracks.filter(function (track) {
        return String(track.format || '').toLocaleLowerCase().indexOf(format) >= 0;
      });
      if (releaseType) found.tracks = found.tracks.filter(function (track) {
        return String(track.releaseType || '').toLocaleLowerCase().indexOf(releaseType) >= 0;
      });
      var composer = String(this.composerFilter || '').toLocaleLowerCase();
      var work = String(this.workFilter || '').toLocaleLowerCase();
      if (composer) found.works = (found.works || []).filter(function (item) {
        return String(item.composer || '').toLocaleLowerCase().indexOf(composer) >= 0;
      });
      if (work) found.works = (found.works || []).filter(function (item) {
        return String(item.title || '').toLocaleLowerCase().indexOf(work) >= 0;
      });
      return found;
    },
	    art: function (id) {
	      var url = LmsFmt.coverUrl(id, 50);
	      return url ? { backgroundImage: 'url(' + url + ')', backgroundSize: 'cover' } : {};
	    },
	    trackSubtitle: function (t) {
	      return [t.artist, t.album, this.tr(t.source), t.rootName].filter(Boolean).join(' • ');
	    },
	    albumSubtitle: function (a) {
	      return [a.artist, a.year || null].filter(Boolean).join(' • ');
	    },
	    tr: function (text) {
	      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
	    },
	    trackLabel: function (t) {
	      return [t.title, this.trackSubtitle(t)].filter(Boolean).join(', ');
	    },
    schedule: function () {
      clearTimeout(this.timer);
      this.error = '';
      if (!this.effectiveQuery) {
        this.loading = false;
        this.results = { artists: [], albums: [], tracks: [], playlists: [] };
        return;
      }
      this.limit = 50;
      this.loading = true;
      var self = this;
      this.timer = setTimeout(function () { self.run(); }, 250);
    },
    run: async function () {
      var token = ++this.request;
      /* Zerar aqui: sem isso um retry bem-sucedido continuava preso na tela de
         erro, porque so schedule() limpava o erro. */
      this.error = '';
      this.loading = true;
      try {
        var chosenRoots = this.roots.filter(function (root) { return this.selectedRoots.indexOf(root.key) >= 0; }, this);
        var found = await LmsApi.searchRoots(this.store.playerId || '', this.effectiveQuery, this.limit, chosenRoots);
        found = this.applyAdvanced(found);
        if (token === this.request) this.results = found;
      } catch (e) {
        // texto em portugues; a string do protocolo fica no console (friendlyError)
        if (token === this.request) {
          this.error = LmsStore.friendlyError(e, 'The search did not complete.');
        }
      }
      if (token === this.request) this.loading = false;
    },
    loadMore: function () {
      // run() ja liga o loading; a lista atual fica na tela e a rolagem se mantem
      this.limit += 50;
      this.run();
    },
    /* NAV-01: sair para um resultado nao pode custar a consulta. O termo, a
       lista e a rolagem ficam guardados no LmsUi -- que sobrevive a este
       componente, destruido no instante em que a busca fecha -- e o frame
       empilhado leva a marca que o Back usa para voltar para ca. */
    suspend: function (tab, frame) {
      frame.fromSearch = true;
      LmsUi.suspendSearch({
        tab: tab,
        query: this.ui.query,
        results: this.results,
        scroll: this.$el ? this.$el.scrollTop : 0,
        limit: this.limit, advancedOpen: this.advancedOpen,
        searchTypes: this.searchTypes.slice(), yearFilter: this.yearFilter,
        sourceFilter: this.sourceFilter, composerFilter: this.composerFilter,
        workFilter: this.workFilter, selectedRoots: this.selectedRoots.slice()
      });
      return frame;
    },
    enterMusic: function (view, frame) {
      this.suspend('music', frame);
      if (frame.rootKey && frame.rootKey !== this.ui.rootKey) {
        LmsNav.switchMusicRoot(frame.rootKey);
        LmsUi.setLibraryRoot(frame.rootKey);
      }
      LmsUi.setTab('music');
      LmsUi.setMusicView(view);
      LmsNav.reset('music');
      /* Fechar a busca remonta lms-browse, cujo carregamento limpa a pilha.
         Empilhar no proximo tick garante que o destino sobreviva a remontagem. */
      this.$nextTick(function () { LmsNav.push('music', frame); });
    },
    openArtist: function (a) {
      this.enterMusic('artists', {
        kind: 'artist', id: a.id, ids: a.ids,
        label: a.name, art: null, rootKey: a.rootKey
      });
    },
    openAlbum: function (a) {
      this.enterMusic('albums', {
        kind: 'album', id: a.id, label: a.title,
        sub: [a.artist, a.year || null].filter(Boolean).join(' • '),
        art: LmsFmt.coverUrl(a.artworkTrackId, 50) || null,
        year: a.year, originalYear: a.originalYear, rootKey: a.rootKey
      });
    },
    openWork: function (w) {
      this.enterMusic('works', { kind: 'work', id: w.id, label: w.title,
        sub: w.composer || '', composerId: w.composerId, rootKey: w.rootKey });
    },
    openTrack: function (t, event) {
      if (t.albumId == null) {
        this.trackActions(t, event);
        LmsUi.notify('This track does not belong to an album. Use the actions to play it or add it to the queue.');
        return;
      }
      this.enterMusic('albums', {
        kind: 'album', id: t.albumId, label: t.album || t.title,
        sub: t.artist || '', art: LmsFmt.coverUrl(t.coverId, 50) || null, rootKey: t.rootKey
      });
    },
    trackActions: function (t, event) {
      LmsUi.openActions({
        kind: 'track', id: t.id, title: t.title, artist: t.artist,
        album: t.album, url: t.url, coverId: t.coverId
      }, event && event.currentTarget);
    },
    openPlaylist: function (p) {
      var frame = this.suspend('playlists', { kind: 'playlist', id: p.id, label: p.name });
      LmsUi.setTab('playlists');
      LmsNav.reset('playlists');
      this.$nextTick(function () {
        LmsNav.push('playlists', frame);
      });
    }
  },
  /* Voltar de um resultado remonta este componente com o termo ja no lugar. O
     instantaneo devolve a lista e a rolagem, e a consulta nao e refeita: a
     rede so entra de novo quando o termo muda. */
  created: function () {
    var snapshot = LmsUi.takeSearchSnapshot ? LmsUi.takeSearchSnapshot() : null;
    if (snapshot && snapshot.query === this.ui.query) {
      if (snapshot.results) this.results = snapshot.results;
      if (snapshot.limit) this.limit = snapshot.limit;
      this.restoreScroll = snapshot.scroll || 0;
      this.advancedOpen = !!snapshot.advancedOpen;
      this.searchTypes = snapshot.searchTypes || [];
      this.yearFilter = snapshot.yearFilter || '';
      this.sourceFilter = snapshot.sourceFilter || '';
      this.composerFilter = snapshot.composerFilter || '';
      this.workFilter = snapshot.workFilter || '';
      this.selectedRoots = snapshot.selectedRoots || [];
    }
    this.loadRoots();
  },
  mounted: function () {
    if (!this.restoreScroll) return;
    var self = this;
    this.$nextTick(function () {
      if (self.$el) self.$el.scrollTop = self.restoreScroll;
      self.restoreScroll = 0;
    });
  },
  beforeDestroy: function () { clearTimeout(this.timer); }
});
