
/* Search global da biblioteca. O componente recebe apenas dados normalizados de
   api.js e leva cada resultado para a mesma pilha usada por Minha Musica. */
Vue.component('lms-search', {
  template: `
<div class="search-body scroller" @keydown="onKeydown">
  <header v-if="effectiveQuery" class="search-context">
    <h1>Results for “{{ effectiveQuery }}”</h1>
    <div class="search-scopes" role="group" aria-label="Result type">
      <button type="button" :class="{on: !searchTypes.length}" :aria-pressed="String(!searchTypes.length)"
              @click="selectSearchType('')">All</button>
      <button v-for="type in searchTypeOptions" :key="type.key" type="button"
              :class="{on: searchTypes[0] === type.key}" :aria-pressed="String(searchTypes[0] === type.key)"
              @click="selectSearchType(type.key)">{{ type.label }}</button>
    </div>
    <div class="advanced-search-bar">
      <button type="button" class="text-command" :class="{on: advancedOpen || advancedFilterCount}"
              :aria-expanded="String(advancedOpen)" @click="advancedOpen = !advancedOpen">Filter · {{ filterSummary }} ›</button>
      <span class="advanced-search-summary">{{ total }} {{ total === 1 ? 'result' : 'results' }} in {{ rootSummary }}</span>
      <button v-if="advancedFilterCount" type="button" class="text-command" @click="clearAdvancedFilters">Clear</button>
    </div>
  </header>
  <div v-if="advancedOpen && effectiveQuery" class="advanced-search-panel" aria-label="Advanced search filters">
    <div class="advanced-search-panel-title"><strong>Refine results</strong><button type="button" class="text-command" @click="advancedOpen = false">Done</button></div>
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
    <div v-if="recentSearches.length" class="recent-searches" aria-label="Recent searches">
      <span>Recent searches</span>
      <button v-for="term in recentSearches" :key="term" type="button" @click="useRecentSearch(term)">{{ term }}</button>
    </div>
  </div>
  <div v-else-if="loading && !total" class="system-state system-loading" role="status" aria-live="polite">
    <div class="state-skeleton" aria-hidden="true"><span class="state-skeleton-art"></span><span><i></i><i class="short"></i></span><span class="state-skeleton-art"></span><span><i></i><i class="short"></i></span></div>
    <div class="state-progress-copy"><span>Searching the library…</span></div>
    <div class="state-progress indeterminate" role="progressbar" aria-label="Searching the library"><i></i></div>
  </div>
  <div v-else-if="error" class="empty">
    <div class="state-error-mark" aria-hidden="true">!</div>
    <div class="h">Search failed</div>
    <div class="p">{{ error }} Your search and filters are still here.</div>
    <div class="state-actions"><button class="retry-command primary" @click="run">Try again</button><button class="retry-command" @click="clearSearch">Clear search</button></div>
  </div>
  <div v-else-if="!total" class="empty">
    <div class="state-empty-mark" aria-hidden="true">⌕</div>
    <div class="h">No results</div>
    <div class="p">We did not find “{{ effectiveQuery }}” with the current filters.</div>
    <div class="state-actions"><button v-if="advancedFilterCount" class="retry-command primary" @click="clearAdvancedFilters">Clear filters</button><button class="retry-command" @click="clearSearch">Change search</button></div>
  </div>
  <template v-else>
    <div v-if="loading" class="search-refreshing" role="status" aria-live="polite">Searching…</div>
	    <section v-if="bestMatch && !searchTypes.length" class="search-best" aria-label="Best match">
	      <span v-if="bestMatch.kind === 'album' || bestMatch.kind === 'track'" class="art" :style="art(bestMatch.artId)"></span>
	      <span v-else class="search-kind">{{ bestMatch.initial }}</span>
	      <div class="search-best-copy"><span>Best match · {{ bestMatch.label }}</span><strong>{{ bestMatch.title }}</strong><small>{{ bestMatch.subtitle }}</small>
	        <div class="search-best-actions"><button type="button" class="primary" @click="playBest">Play</button><button type="button" @click="openBest">Open</button><button type="button" aria-label="More actions for best match" @click="bestActions($event)">•••</button></div>
	      </div>
	    </section>
	    <section v-if="results.artists.length && typeVisible('artists')" class="search-group">
	      <h2 class="search-heading">Artists <button v-if="canSeeAll('artists')" @click="selectSearchType('artists')">See all {{ results.artists.length }}</button><span v-else>{{ results.artists.length }}</span></h2>
	      <button v-for="a in visibleResults('artists')" :key="'ar' + a.id"
	              type="button" class="row noart pointer search-result"
	              @click="openArtist(a)">
	        <span class="search-kind">A</span>
	        <span class="ell"><span class="t ell">{{ a.name }}</span></span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="results.albums.length && typeVisible('albums')" class="search-group">
	      <h2 class="search-heading">Albums <button v-if="canSeeAll('albums')" @click="selectSearchType('albums')">See all {{ results.albums.length }}</button><span v-else>{{ results.albums.length }}</span></h2>
	      <button v-for="a in visibleResults('albums')" :key="'al' + a.id"
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
	      <h2 class="search-heading">Works <button v-if="canSeeAll('works')" @click="selectSearchType('works')">See all {{ results.works.length }}</button><span v-else>{{ results.works.length }}</span></h2>
	      <button v-for="w in visibleResults('works')" :key="'wo' + w.id" type="button"
	              class="row noart pointer search-result" @click="openWork(w)">
	        <span class="search-kind">W</span>
	        <span class="ell"><span class="t ell">{{ w.title }}</span><span v-if="w.composer" class="s ell">{{ w.composer }}</span><span v-if="w.rootName" class="s ell">{{ w.rootName }}</span></span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="results.tracks.length && typeVisible('tracks')" class="search-group">
	      <h2 class="search-heading">Tracks <button v-if="canSeeAll('tracks')" @click="selectSearchType('tracks')">See all {{ results.tracks.length }}</button><span v-else>{{ results.tracks.length }}</span></h2>
	      <div v-for="t in visibleResults('tracks')" :key="'tr' + t.id"
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
	      <h2 class="search-heading">Playlists <button v-if="canSeeAll('playlists')" @click="selectSearchType('playlists')">See all {{ results.playlists.length }}</button><span v-else>{{ results.playlists.length }}</span></h2>
	      <button v-for="p in visibleResults('playlists')" :key="'pl' + p.id"
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
      recentSearches: [],
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
    advancedFilterCount: function () { return this.activeFilterCount - this.searchTypes.length; },
    filterSummary: function () { return this.advancedFilterCount ? this.advancedFilterCount + ' active' : 'All'; },
    rootSummary: function () {
      var selected = this.roots.filter(function (root) { return this.selectedRoots.indexOf(root.key) >= 0; }, this);
      return selected.length === 1 ? selected[0].name : selected.length + ' libraries';
    },
    bestMatch: function () {
      var candidates = [];
      (this.results.artists || []).forEach(function (item) { candidates.push({ kind: 'artist', label: 'Artist', title: item.name, subtitle: '', initial: 'A', item: item }); });
      (this.results.albums || []).forEach(function (item) { candidates.push({ kind: 'album', label: 'Album', title: item.title, subtitle: this.albumSubtitle(item), initial: 'A', artId: item.artworkTrackId, item: item }); }, this);
      (this.results.tracks || []).forEach(function (item) { candidates.push({ kind: 'track', label: 'Track', title: item.title, subtitle: this.trackSubtitle(item), initial: 'T', artId: item.coverId, item: item }); }, this);
      (this.results.playlists || []).forEach(function (item) { candidates.push({ kind: 'playlist', label: 'Playlist', title: item.name, subtitle: '', initial: 'P', item: item }); });
      var query = String(this.query || '').trim().toLocaleLowerCase();
      return candidates.sort(function (a, b) {
        var ae = a.title.toLocaleLowerCase() === query ? 0 : 1;
        var be = b.title.toLocaleLowerCase() === query ? 0 : 1;
        return ae - be;
      })[0] || null;
    },
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
    clearSearch: function () {
      this.ui.query = '';
      this.error = '';
      this.results = { artists: [], albums: [], tracks: [], playlists: [], works: [] };
    },
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
    selectSearchType: function (key) { this.searchTypes = key ? [key] : []; },
    visibleResults: function (key) { var rows = this.results[key] || []; return this.searchTypes.length ? rows : rows.slice(0, 3); },
    canSeeAll: function (key) { return !this.searchTypes.length && (this.results[key] || []).length > 3; },
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
    clearAdvancedFilters: function () {
      this.yearFilter = ''; this.sourceFilter = ''; this.formatFilter = ''; this.releaseTypeFilter = '';
      this.composerFilter = ''; this.workFilter = ''; this.selectedRoots = [this.ui.rootKey || 'all'];
    },
    useRecentSearch: function (term) { this.ui.query = term; },
    onKeydown: function (event) {
      if (event.key === 'Escape') {
        var input = document.querySelector('.searchwrap input[type="search"], .searchwrap input');
        if (input) { event.preventDefault(); input.focus(); }
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var rows = Array.prototype.slice.call(this.$el.querySelectorAll('.search-result.row, button.search-result'));
      if (!rows.length) return;
      var active = document.activeElement;
      var current = rows.findIndex(function (row) { return row === active || row.contains(active); });
      var next = event.key === 'ArrowDown' ? Math.min(rows.length - 1, current + 1) : Math.max(0, current < 0 ? 0 : current - 1);
      var target = rows[next].matches('button') ? rows[next] : rows[next].querySelector('button');
      if (target) { event.preventDefault(); target.focus(); target.scrollIntoView({ block: 'nearest' }); }
    },
    rememberSearch: function () {
      var term = String(this.query || '').trim();
      if (!term || !this.total) return;
      this.recentSearches = [term].concat(this.recentSearches.filter(function (item) { return item !== term; })).slice(0, 5);
      try { localStorage.setItem('echoclassic.recent-searches.v1', JSON.stringify(this.recentSearches)); } catch (e) {}
    },
    openBest: function () {
      if (!this.bestMatch) return;
      var item = this.bestMatch.item;
      if (this.bestMatch.kind === 'artist') this.openArtist(item);
      else if (this.bestMatch.kind === 'album') this.openAlbum(item);
      else if (this.bestMatch.kind === 'track') this.openTrack(item);
      else this.openPlaylist(item);
    },
    playBest: function () {
      if (!this.bestMatch) return;
      var kind = this.bestMatch.kind, item = this.bestMatch.item;
      if (kind === 'artist') LmsStore.playContainer('artist_id', item.id, 0);
      else if (kind === 'album') LmsStore.playContainer('album_id', item.id, 0);
      else if (kind === 'track' && LmsApi.loadTrack) LmsApi.loadTrack(this.store.playerId || '', item.id);
      else this.openBest();
    },
    bestActions: function (event) {
      if (!this.bestMatch) return;
      var item = this.bestMatch.item;
      LmsUi.openActions({ kind: this.bestMatch.kind, id: item.id, title: this.bestMatch.title,
        artist: item.artist, album: item.album, url: item.url, coverId: item.coverId || item.artworkTrackId }, event && event.currentTarget);
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
        if (token === this.request) { this.results = found; this.$nextTick(this.rememberSearch); }
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
        workFilter: this.workFilter, formatFilter: this.formatFilter,
        releaseTypeFilter: this.releaseTypeFilter, selectedRoots: this.selectedRoots.slice()
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
    try { this.recentSearches = JSON.parse(localStorage.getItem('echoclassic.recent-searches.v1') || '[]').slice(0, 5); } catch (e) { this.recentSearches = []; }
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
      this.formatFilter = snapshot.formatFilter || '';
      this.releaseTypeFilter = snapshot.releaseTypeFilter || '';
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
