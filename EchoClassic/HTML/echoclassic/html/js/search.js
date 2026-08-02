
/* Busca global da biblioteca. O componente recebe apenas dados normalizados de
   api.js e leva cada resultado para a mesma pilha usada por Minha Musica. */
Vue.component('lms-search', {
  template: `
<div class="search-body scroller">
  <div v-if="!query.trim()" class="empty">
    <div class="h">Buscar na biblioteca</div>
    <div class="p">Digite um artista, álbum ou faixa.</div>
  </div>
  <div v-else-if="loading && !total" class="empty"><div class="p">Buscando…</div></div>
  <div v-else-if="error" class="empty">
    <div class="h">Não deu para buscar</div>
    <div class="p">{{ error }}</div>
    <button class="retry-command" @click="run">Tentar novamente</button>
  </div>
  <div v-else-if="!total" class="empty">
    <div class="h">Nenhum resultado</div>
    <div class="p">Não encontramos “{{ query.trim() }}” na sua biblioteca.</div>
  </div>
  <template v-else>
    <div v-if="loading" class="search-refreshing" role="status" aria-live="polite">Buscando…</div>
	    <section v-if="results.artists.length" class="search-group">
	      <h2 class="search-heading">Artistas <span>{{ results.artists.length }}</span></h2>
	      <button v-for="a in results.artists" :key="'ar' + a.id"
	              type="button" class="row noart pointer search-result"
	              @click="openArtist(a)">
	        <span class="search-kind">A</span>
	        <span class="ell"><span class="t ell">{{ a.name }}</span></span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="results.albums.length" class="search-group">
	      <h2 class="search-heading">Álbuns <span>{{ results.albums.length }}</span></h2>
	      <button v-for="a in results.albums" :key="'al' + a.id"
	              type="button" class="row pointer search-result"
	              @click="openAlbum(a)">
	        <span class="art" :style="art(a.artworkTrackId)"></span>
	        <span class="ell">
	          <span class="t ell">{{ a.title }}</span>
	          <span v-if="a.artist" class="s ell">{{ a.artist }}</span>
	        </span>
	        <svg class="ic chev" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	      </button>
	    </section>

	    <section v-if="results.tracks.length" class="search-group">
	      <h2 class="search-heading">Faixas <span>{{ results.tracks.length }}</span></h2>
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
	        <button class="more-command" title="Mais ações"
	                :aria-label="'Mais ações para ' + t.title"
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

	    <section v-if="results.playlists.length" class="search-group">
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
      {{ loading ? 'Buscando…' : 'Mostrar mais resultados' }}
    </button>
  </template>
</div>`,
  data: function () {
    return {
      ui: LmsUi.state, store: LmsStore.state,
      results: { artists: [], albums: [], tracks: [], playlists: [] },
      loading: false, error: '', timer: null, request: 0, limit: 50
    };
  },
  computed: {
    query: function () { return this.ui.query; },
    total: function () {
      return this.results.artists.length + this.results.albums.length +
             this.results.tracks.length + this.results.playlists.length;
    },
    hasMore: function () {
      var limit = this.limit;
      return ['artists', 'albums', 'tracks', 'playlists'].some(function (key) {
        return this.results[key].length >= limit;
      }, this);
    }
  },
  watch: {
    query: function () { this.schedule(); }
  },
  methods: {
	    art: function (id) {
	      var url = LmsFmt.coverUrl(id, 50);
	      return url ? { backgroundImage: 'url(' + url + ')', backgroundSize: 'cover' } : {};
	    },
	    trackSubtitle: function (t) {
	      return [t.artist, t.album, t.source].filter(Boolean).join(' • ');
	    },
	    trackLabel: function (t) {
	      return [t.title, this.trackSubtitle(t)].filter(Boolean).join(', ');
	    },
    schedule: function () {
      clearTimeout(this.timer);
      this.error = '';
      if (!this.query.trim()) {
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
        var found = await LmsApi.search(this.store.playerId || '', this.query, this.limit);
        if (token === this.request) this.results = found;
      } catch (e) {
        // texto em portugues; a string do protocolo fica no console (friendlyError)
        if (token === this.request) {
          this.error = LmsStore.friendlyError(e, 'A busca não foi concluída.');
        }
      }
      if (token === this.request) this.loading = false;
    },
    loadMore: function () {
      // run() ja liga o loading; a lista atual fica na tela e a rolagem se mantem
      this.limit += 50;
      this.run();
    },
    enterMusic: function (view, frame) {
      LmsUi.setTab('musica');
      LmsUi.setMusicView(view);
      LmsNav.reset('musica');
      /* Fechar a busca remonta lms-browse, cujo carregamento limpa a pilha.
         Empilhar no proximo tick garante que o destino sobreviva a remontagem. */
      this.$nextTick(function () { LmsNav.push('musica', frame); });
    },
    openArtist: function (a) {
      this.enterMusic('artistas', {
        kind: 'artist', id: a.id, ids: a.ids,
        label: a.name, art: null
      });
    },
    openAlbum: function (a) {
      this.enterMusic('albuns', {
        kind: 'album', id: a.id, label: a.title,
        sub: [a.artist, a.year || null].filter(Boolean).join(' • '),
        art: LmsFmt.coverUrl(a.artworkTrackId, 50) || null,
        year: a.year, originalYear: a.originalYear
      });
    },
    openTrack: function (t, event) {
      if (t.albumId == null) {
        this.trackActions(t, event);
        LmsUi.notify('Esta faixa não pertence a um álbum. Use as ações para reproduzir ou adicionar à fila.');
        return;
      }
      this.enterMusic('albuns', {
        kind: 'album', id: t.albumId, label: t.album || t.title,
        sub: t.artist || '', art: LmsFmt.coverUrl(t.coverId, 50) || null
      });
    },
    trackActions: function (t, event) {
      LmsUi.openActions({
        kind: 'track', id: t.id, title: t.title, artist: t.artist,
        album: t.album, url: t.url, coverId: t.coverId
      }, event && event.currentTarget);
    },
    openPlaylist: function (p) {
      LmsUi.setTab('playlists');
      LmsNav.reset('playlists');
      this.$nextTick(function () {
        LmsNav.push('playlists', { kind: 'playlist', id: p.id, label: p.name });
      });
    }
  },
  beforeDestroy: function () { clearTimeout(this.timer); }
});
