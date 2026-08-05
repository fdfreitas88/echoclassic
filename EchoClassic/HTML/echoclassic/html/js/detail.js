
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
    <lms-album-block v-for="a in visibleBlocks" :key="a.id" :album="a" :artist="artist"></lms-album-block>
    <div v-if="discografiaTruncada" class="loading-more warning" role="status">
      This artist's discography has more than 200 albums and this screen shows the first 200.
    </div>
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

    <template v-if="ui.albumMode === 'tracks'">
      <lms-album-block v-for="a in albums" :key="'b' + a.id" :album="a"></lms-album-block>
      <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
    </template>

    <template v-else>
      <div class="albumgrid">
	        <button v-for="a in albums" :key="'g' + a.id" type="button"
	                class="gcell pointer" @click="openAlbum(a)">
	          <span class="gart" :class="{placeholder: !hasArt(a)}">
	            <img v-if="hasArt(a)" :src="largeArt(a.art)" alt="" @error="markArtFailed(a)">
	            <span v-else class="art-placeholder" aria-hidden="true">♫</span>
	          </span>
	          <span class="gtitle ell">{{ a.title }}</span>
	          <span class="gsub ell">{{ editionLine(a) }}</span>
	        </button>
      </div>
      <div v-if="!albums.length" class="empty"><div class="p">No albums for this item.</div></div>
    </template>
    <div v-if="listaTruncada" class="loading-more warning" role="status">
      This list has more than 1,000 albums and this screen shows the first 1,000.
    </div>
  </template>
</div>`,
  data: function () {
    return { store: LmsStore.state, ui: LmsUi.state, albums: [], blocks: [],
             artist: null, failedArt: {}, photoFailed: false,
             loading: true, error: '', requestToken: 0,
             discografiaTruncada: false, listaTruncada: false };
  },
  computed: {
    initial: function () {
      return ((this.frame.label || '?').trim().charAt(0) || '?').toUpperCase();
    },
    bigArt: function () { return this.frame.art ? this.frame.art.replace('_50x50', '') : ''; },
    artistName: function () {
      return this.artist ? this.artist.name : ((this.frame.sub || '').split(' • ')[0] || '—');
    },
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
    largeArt: function (url) { return (url || '').replace('_50x50', ''); },
    hasArt: function (album) { return !!album.art && !this.failedArt[album.id]; },
    markArtFailed: function (album) { this.$set(this.failedArt, album.id, true); },
    editionLine: function (album) {
      var parts = [];
      if (album.editionCount > 1) parts.push('Edition ' + (album.year || 'sem ano'));
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
      LmsNav.push('musica', {
        kind: 'artist', id: this.artist.id, ids: this.artist.ids,
        label: this.artist.name, art: null
      });
    },
    openAlbum: function (a) {
      LmsNav.push('musica', {
        kind: 'album', id: a.id, label: a.title,
        sub: [a.artist, a.year || null].filter(Boolean).join(' • '),
        art: a.art, year: a.year, originalYear: a.originalYear
      });
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
      this.artist = null;
      this.failedArt = {};
      this.photoFailed = false;
      this.discografiaTruncada = false;
      this.listaTruncada = false;
      var pid = this.store.playerId || '';
      var f = this.frame;
      try {
        if (f.kind === 'album') {
          /* O album escolhido vem primeiro e o resto da discografia abaixo, cada
             um como um bloco completo. Cada bloco busca as proprias faixas, entao
             a tela aparece em partes em vez de esperar todos os albuns. */
          var atual = {
            id: f.id, title: f.label, art: f.art,
            year: f.year || ((f.sub || '').split(' • ')[1] || ''),
            originalYear: f.originalYear || 0,
            artist: (f.sub || '').split(' • ')[0] || ''
          };
          this.blocks = [atual];
          this.loading = false;
          var quem = await LmsApi.artistOfAlbum(pid, f.id);
          if (token !== this.requestToken) return;
          this.artist = quem;
          if (this.artist) {
            var artistFilter = this.artist.ids && this.artist.ids.length > 1
              ? { artistIds: this.artist.ids }
              : { artistId: this.artist.id };
            var todos = await LmsApi.albums(pid, 0, 200, artistFilter);
            if (token !== this.requestToken) return;
            this.discografiaTruncada = todos.length >= 200;
            this.blocks = [atual].concat(todos
              .filter(function (x) { return x.id !== f.id; })
              .map(function (x) {
                return { id: x.id, title: x.title, year: x.year,
                         originalYear: x.originalYear, releaseType: x.releaseType,
                         artist: x.artist,
                         art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null };
              }));
            var marked = this.markEditions(this.blocks);
            var selected = marked.filter(function (album) { return album.id === f.id; })[0] || atual;
            this.blocks = [selected].concat(marked.filter(function (album) { return album.id !== f.id; }));
          }
          return;
        } else {
          var filter = {};
          if (f.kind === 'artist') {
            if (f.ids && f.ids.length > 1) filter.artistIds = f.ids;
            else filter.artistId = f.id;
          }
          else if (f.kind === 'genre') filter.genreId = f.id;
          else if (f.kind === 'year') filter.year = f.id;
          var al = await LmsApi.albums(pid, 0, 1000, filter);
          if (token !== this.requestToken) return;
          this.listaTruncada = al.length >= 1000;
          this.albums = this.markEditions(al.map(function (x) {
            return {
              id: x.id, title: x.title, year: x.year,
              originalYear: x.originalYear, releaseType: x.releaseType,
              artist: x.artist,
              art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null
            };
          }));
        }
      } catch (e) {
        if (token !== this.requestToken) return;
        /* Um erro depois de o bloco do album ja estar na tela nao pode apagar o
           que carregou certo: o pedido secundario falhou, o album nao. */
        if (this.blocks.length || this.albums.length) {
          LmsUi.notify('Part of this screen could not be loaded. ' +
            (e && e.message ? e.message : String(e)), 'error', 6500);
        } else {
          this.error = e && e.message ? e.message : String(e);
        }
      }
      if (token !== this.requestToken) return;
      this.loading = false;
    }
  },
  created: function () { this.load(); }
});
