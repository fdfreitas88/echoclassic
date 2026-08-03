
/* Minha Musica: the split view. Left is the current root list (artists, albums,
   genres, years), right is whatever is selected. Below 700px the CSS collapses
   this to one column and the nav stack pushes instead of splitting.

   The list is windowed rather than fully rendered: this library has 1591
   artists and 1459 albums, and the server includes composers and one
   blank-named contributor that api.js drops. */
var LmsSplitPane = {
  defaultWidth: 360,
  minLeft: 300,
  minRight: 360,
  storageKey: 'echoclassic.split.v1',
  load: function () {
    try {
      var saved = JSON.parse(localStorage.getItem(this.storageKey) || '') || {};
      return {
        width: Number(saved.width) || this.defaultWidth,
        locked: !!saved.locked
      };
    } catch (e) {
      return { width: this.defaultWidth, locked: false };
    }
  }
};

Vue.component('lms-browse', {
  template: `
<div ref="split" class="split-body" :class="{'split-locked': splitLocked}"
     :style="{'--pane-current': paneWidth + 'px'}">
  <div class="pane-left">
    <div class="library-tools">
      <input v-model="ui.filter" type="search" placeholder="Filtrar"
             :aria-label="'Filtrar ' + viewLabel.toLowerCase()">
      <select :value="ui.sortKey" :aria-label="sortSelectLabel" @change="setSort($event.target.value)">
        <optgroup :label="displayGroupLabel">
          <option v-if="view === 'recentes'" value="recent">Adicionados recentemente</option>
          <option :value="primaryOptionValue">{{ primaryOptionLabel }}</option>
          <option v-if="view === 'albuns' || view === 'recentes'" value="artist">Artista</option>
          <option v-if="view === 'albuns'" value="relatedArtist">Artista relacionado</option>
          <option v-if="view === 'albuns' || view === 'recentes'" value="year">Ano</option>
        </optgroup>
        <optgroup label="Formato" :disabled="!allowsMediaFilter">
          <option v-for="f in MEDIA_FORMATS" :key="f.key" :value="'format:' + f.key">{{ f.label }}</option>
        </optgroup>
        <optgroup label="Resolução" :disabled="!allowsMediaFilter">
          <option value="quality:hires">Hi-Res</option>
          <option value="quality:standard">Resolução padrão</option>
        </optgroup>
        <optgroup label="Local" :disabled="!allowsMediaFilter">
          <option value="origin:local">Biblioteca local</option>
          <option value="origin:remote">Remoto / streaming</option>
        </optgroup>
        <optgroup label="Serviços de streaming" :disabled="!allowsMediaFilter">
          <option value="stream:qobuz">Qobuz</option>
          <option value="stream:youtube">YouTube</option>
        </optgroup>
      </select>
	      <button class="icon-command" :title="sortTitle" :aria-label="sortLabel"
	              :aria-pressed="String(ui.sortDesc)"
	              @click="LmsUi.setSort(ui.sortKey, !ui.sortDesc)">
        <span aria-hidden="true">{{ ui.sortDesc ? '↓' : '↑' }}</span>
      </button>
      <button v-if="!ui.selectionMode" class="text-command" @click="toggleSelect">Selecionar</button>
      <div v-else class="selection-tools">
	        <span class="selection-count" aria-live="polite">{{ selectionCountLabel }}</span>
        <button class="selection-add-command" :disabled="!selectionCount"
                title="Adicionar à fila de reprodução" aria-label="Adicionar à fila de reprodução"
                @click="queueSelection">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6h12M9 12h12M9 18h12M3 6h2M3 12h2M3 18h2M17 3v6M14 6h6"/>
          </svg>
          <span>Adicionar<span class="selection-wide-label"> à fila</span></span>
        </button>
        <button class="text-command selection-done-command" @click="toggleSelect">Concluído</button>
      </div>
      <button ref="splitOptionsButton" class="icon-command split-options-command"
              title="Opções da divisão" :aria-expanded="String(splitMenuOpen)"
              @click="splitMenuOpen = !splitMenuOpen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5h17v13h-17zM10 5.5v13M14 9l2-2 2 2M18 15l-2 2-2-2"/></svg>
      </button>
      <div v-if="splitMenuOpen" ref="splitMenu" class="split-options" role="menu">
        <button role="menuitem" @click="resetSplit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v5h5M5.5 16a7 7 0 1 0 .3-8.3L4 9"/></svg>
          <span>Restaurar divisão</span>
        </button>
        <button role="menuitem" @click="toggleSplitLock">
          <svg v-if="splitLocked" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 9.6-2M5 10h14v11H5zM3 3l18 18"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"/></svg>
          <span>{{ splitLocked ? 'Desbloquear divisão' : 'Bloquear divisão' }}</span>
        </button>
      </div>
    </div>
    <div v-if="view === 'recentes' && store.history.length" class="history-strip">
      <div class="sectitle">Reproduzidos recentemente</div>
      <div class="history-scroll">
        <button v-for="h in store.history.slice(0, 12)" :key="h.id + '-' + h.playedAt"
                class="history-item" :aria-label="historyLabel(h)" @click="historyAction(h)">
          <span class="art" :style="historyArt(h)"></span>
          <span class="history-copy">
            <span class="history-title">{{ h.title }}</span>
            <span v-if="h.artist" class="history-meta ell">{{ h.artist }}</span>
          </span>
        </button>
      </div>
    </div>
    <div v-if="hasMediaFilter" class="filter-chip" role="status">
      <span class="filter-chip-text ell">Filtro ativo: {{ mediaDescriptor() }}</span>
      <button type="button" class="filter-chip-clear" @click="clearMediaFilter">Limpar filtro</button>
    </div>
    <div class="scroller" ref="scroller" @scroll="onScroll">
      <div v-if="loading" class="empty"><div class="p">Carregando…</div></div>
      <div v-else-if="error" class="empty">
        <div class="h">Não deu para ler a biblioteca</div>
        <div class="p">{{ error }}</div>
        <button class="retry-command" @click="reload(true)">Tentar novamente</button>
      </div>
      <div v-else-if="!rows.length" class="empty">
        <div class="h">{{ viewLabel }}</div>
        <div v-if="hasMediaFilter" class="p">Nada nesta categoria corresponde ao filtro {{ mediaDescriptor() }}.</div>
        <div v-else class="p">Nenhum item encontrado nesta categoria.</div>
        <button v-if="hasMediaFilter" class="retry-command" @click="clearMediaFilter">Limpar filtro</button>
      </div>
      <template v-else>
        <div :style="{height: topPad + 'px'}"></div>
	        <div v-for="r in windowed" :key="r.key" class="row"
	             :class="{sel: isSelected(r), chosen: selected(r), artistrow: r.kind === 'artist',
	                      noart: !r.art, albumrow: showsAlbums}"
	             role="group" :aria-label="rowLabel(r)">
	          <button type="button" class="row-main pointer" :aria-label="rowLabel(r)"
	                  :aria-pressed="ui.selectionMode ? String(selected(r)) : null"
	                  @click="rowClick(r)">
	            <span v-if="ui.selectionMode" class="select-mark" :class="{on: selected(r)}"></span>
	            <span v-if="r.art" class="art" :style="artStyle(r)"></span>
	            <span class="ell">
	              <span class="t ell">{{ r.label }}</span>
	              <span v-if="r.sub" class="s ell">{{ r.sub }}</span>
	            </span>
	          </button>
	          <button v-if="!ui.selectionMode" class="more-command" title="Mais ações"
	                  :aria-label="'Mais ações para ' + r.label" @click.stop="actions(r, $event)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle class="more-ring" cx="12" cy="12" r="8.5"/>
              <circle class="more-dot" cx="8.5" cy="12" r="1"/>
              <circle class="more-dot" cx="12" cy="12" r="1"/>
              <circle class="more-dot" cx="15.5" cy="12" r="1"/>
            </svg>
          </button>
        </div>
	        <div :style="{height: botPad + 'px'}"></div>
	        <div v-if="loadingMore" class="loading-more" role="status">Carregando mais itens…</div>
	        <div v-if="limitWarning" class="loading-more warning" role="status">{{ limitWarning }}</div>
	      </template>
    </div>
    <div v-if="hasRail" class="rail" role="slider" tabindex="0"
         aria-label="Índice alfabético" aria-valuemin="0" :aria-valuemax="RAIL.length - 1"
         :aria-valuenow="railIndex" :aria-valuetext="activeRail || 'Início'"
         @keydown.up.prevent="stepRail(-1)" @keydown.left.prevent="stepRail(-1)"
         @keydown.down.prevent="stepRail(1)" @keydown.right.prevent="stepRail(1)"
         @touchstart.prevent="scrubRail" @touchmove.prevent="scrubRail">
      <span v-for="L in RAIL" :key="L" :data-letter="L" aria-hidden="true"
            :class="{dim: !railHas[L], active: activeRail === L}"
            @click="jump(L)">{{ L }}</span>
    </div>
  </div>

  <div class="split-divider" role="separator" aria-orientation="vertical"
       :aria-label="splitLocked ? 'Divisão bloqueada' : 'Redimensionar painéis'"
       :aria-valuemin="splitMin" :aria-valuemax="splitMax" :aria-valuenow="Math.round(paneWidth)"
       :tabindex="splitLocked ? -1 : 0"
       @pointerdown="startSplitResize" @pointermove="moveSplitResize"
       @pointerup="endSplitResize" @pointercancel="endSplitResize"
       @keydown.left.prevent="nudgeSplit(-16)" @keydown.right.prevent="nudgeSplit(16)"
       @keydown.home.prevent="resetSplit">
    <span aria-hidden="true"></span>
  </div>

  <div class="pane-right">
    <lms-detail v-if="frame" :frame="frame"></lms-detail>
    <div v-else class="empty">
      <div class="h">{{ viewLabel }}</div>
      <div class="p">Escolha um item na lista à esquerda.</div>
    </div>
  </div>
</div>`,
  data: function () {
    var split = LmsSplitPane.load();
    return {
      ui: LmsUi.state, store: LmsStore.state, LmsUi: LmsUi,
      rows: [], loading: true, error: '',
	      loadingMore: false, limitWarning: '', requestToken: 0,
	      artistIndexTruncated: false,
      rootSelection: null,
      first: 0, visible: 14, activeRail: '',
      mediaIndex: null,
      paneWidth: split.width, splitLocked: split.locked, splitMenuOpen: false,
      splitMin: LmsSplitPane.minLeft, splitMax: LmsSplitPane.defaultWidth,
      splitDragging: false, splitStartX: 0, splitStartWidth: 0,
      RAIL: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split(''),
      MEDIA_FORMATS: [
        { key: 'flac', label: 'FLAC' }, { key: 'mp3', label: 'MP3' },
        { key: 'aac', label: 'AAC' }, { key: 'alac', label: 'ALAC' },
        { key: 'wav', label: 'WAV' }, { key: 'aiff', label: 'AIFF' },
        { key: 'ape', label: 'APE' }, { key: 'wavpack', label: 'WavPack' },
        { key: 'dsd', label: 'DSD' }, { key: 'ogg', label: 'Ogg Vorbis' },
        { key: 'opus', label: 'Opus' }
      ]
    };
  },
  computed: {
    view: function () { return LmsUi.state.musicView; },
    viewLabel: function () { return LmsUi.viewLabel(); },
    primaryOptionLabel: function () {
      return {
        artistas: 'Artista', albuns: 'Álbum', recentes: 'Álbum',
        generos: 'Gênero', anos: 'Ano'
      }[this.view] || 'Nome';
    },
    primaryOptionValue: function () { return this.view === 'anos' ? 'year' : 'name'; },
    /* Em Albuns, "Artista" produz linhas de artista -- agrupa. Em Recentes a
       mesma opcao apenas reordena albuns, porque Recentes nao passa por
       loadPagedRoot e sempre desenha album. Chamar os dois de "Exibicao" era o
       que fazia procurar Beatles em Recentes devolver albuns em vez de uma
       entrada de artista. */
    displayGroupLabel: function () {
      return this.tr(this.view === 'albuns' ? 'Agrupar ou ordenar' : 'Ordenar por');
    },
    sortSelectLabel: function () {
      if (this.view === 'albuns') return this.tr('Agrupar, ordenar ou filtrar');
      if (this.view === 'recentes') return this.tr('Ordenar ou filtrar');
      return this.tr('Ordenar');
    },
    frame: function () { return LmsNav.top('musica') || this.rootSelection; },
    groupsAlbumsByArtist: function () {
      return this.view === 'albuns' && this.ui.sortKey === 'artist';
    },
    groupsMainArtists: function () {
      return this.view === 'artistas' || this.groupsAlbumsByArtist;
    },
    groupsAlbumsByRelatedArtist: function () {
      return this.view === 'albuns' && this.ui.sortKey === 'relatedArtist';
    },
	    selectionCount: function () { return Object.keys(this.ui.selected).length; },
	    selectionCountLabel: function () {
	      var n = this.selectionCount;
	      if (!n) return 'Nenhum item selecionado';
	      return n + (n === 1 ? ' item selecionado' : ' itens selecionados');
	    },
	    sortLabel: function () {
	      return 'Ordem atual: ' + (this.ui.sortDesc ? 'decrescente' : 'crescente') +
	        '. Alternar ordem';
	    },
	    sortTitle: function () {
	      return this.ui.sortDesc ? 'Mudar para ordem crescente' : 'Mudar para ordem decrescente';
	    },
    allowsMediaFilter: function () { return LmsUi.allowsMediaFilter(this.view); },
    hasMediaFilter: function () {
      return this.allowsMediaFilter &&
        /^(format|quality|origin|stream):/.test(this.ui.sortKey);
    },
    showsAlbums: function () {
      return (this.view === 'albuns' && !this.groupsAlbumsByArtist &&
              !this.groupsAlbumsByRelatedArtist) || this.view === 'recentes';
    },
    hasRail: function () {
      /* O indice alfabetico so faz sentido sobre uma lista alfabetica; em
         'recent' as letras nao sobem e saltar levaria a lugar nenhum. */
      return !this.loading && this.rows.length > 30 && this.ui.sortKey !== 'recent' &&
             (this.view === 'artistas' || this.view === 'albuns' || this.view === 'recentes');
    },
    rowH: function () { return this.showsAlbums ? 88 : 72; },
    displayRows: function () {
      var q = this.normalize(this.ui.filter);
      var rows = q ? this.rows.filter(function (r) {
        return this.normalize([r.label, r.sub, r.artist, r.year].filter(Boolean).join(' ')).indexOf(q) >= 0;
      }, this) : this.rows.slice();
      var key = this.ui.sortKey;
      /* 'recent' e a ordem em que o servidor devolveu (sort:new). Reordenar
         aqui era o que fazia Recentes aparecer em ordem alfabetica. */
      if (key !== 'recent') {
        rows.sort(function (a, b) {
          var av = key === 'year' ? Number(a.year || 0) :
                   (key === 'artist' || key === 'relatedArtist') ?
                     String(a.artist || a.label || '') : String(a.label || '');
          var bv = key === 'year' ? Number(b.year || 0) :
                   (key === 'artist' || key === 'relatedArtist') ?
                     String(b.artist || b.label || '') : String(b.label || '');
          return typeof av === 'number' ? av - bv : av.localeCompare(bv, 'pt-BR', { sensitivity: 'base' });
        });
      }
      if (this.ui.sortDesc) rows.reverse();
      return rows;
    },
    windowed: function () { return this.displayRows.slice(this.first, this.first + this.visible + 12); },
    topPad: function () { return this.first * this.rowH; },
    botPad: function () {
      return Math.max(0, this.displayRows.length - this.first - this.windowed.length) * this.rowH;
    },
    railHas: function () {
      var seen = {};
      this.RAIL.forEach(function (L) { seen[L] = false; });
      this.displayRows.forEach(function (r) {
        var c = (r.label || '').trim().charAt(0).toUpperCase();
        seen[/[A-Z]/.test(c) ? c : '#'] = true;
      });
      return seen;
    },
    railIndex: function () { return Math.max(0, this.RAIL.indexOf(this.activeRail)); }
  },
  watch: {
    view: function () { this.reload(false); },
    'ui.sortKey': function (next, previous) {
      var media = /^(format|quality|origin|stream):/;
      if (this.view === 'albuns' ||
          (this.view === 'recentes' && (media.test(next || '') || media.test(previous || '')))) {
        this.reload(false);
      }
    },
    'ui.filter': function () {
      this.first = 0;
      var self = this;
      this.$nextTick(function () {
        if (self.$refs.scroller) self.$refs.scroller.scrollTop = 0;
      });
    }
  },
  methods: {
    splitBounds: function () {
      var width = this.$refs.split ? this.$refs.split.clientWidth : window.innerWidth;
      return {
        min: LmsSplitPane.minLeft,
        max: Math.max(LmsSplitPane.minLeft, width - LmsSplitPane.minRight - 14)
      };
    },
    setPaneWidth: function (width, save) {
      var bounds = this.splitBounds();
      this.splitMin = bounds.min;
      this.splitMax = bounds.max;
      this.paneWidth = Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
      if (save !== false) this.persistSplit();
    },
    persistSplit: function () {
      try {
        localStorage.setItem(LmsSplitPane.storageKey, JSON.stringify({
          width: this.paneWidth, locked: this.splitLocked
        }));
      } catch (e) {}
    },
    startSplitResize: function (event) {
      if (this.splitLocked || window.innerWidth <= 700 || event.button !== 0) return;
      this.splitDragging = true;
      this.splitStartX = event.clientX;
      this.splitStartWidth = this.paneWidth;
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.classList.add('resizing-split');
    },
    moveSplitResize: function (event) {
      if (!this.splitDragging) return;
      this.setPaneWidth(this.splitStartWidth + event.clientX - this.splitStartX, false);
    },
    endSplitResize: function (event) {
      if (!this.splitDragging) return;
      this.splitDragging = false;
      if (event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      document.body.classList.remove('resizing-split');
      this.persistSplit();
    },
    nudgeSplit: function (amount) {
      if (!this.splitLocked && window.innerWidth > 700) this.setPaneWidth(this.paneWidth + amount);
    },
    resetSplit: function () {
      this.setPaneWidth(LmsSplitPane.defaultWidth);
      this.splitMenuOpen = false;
    },
    toggleSplitLock: function () {
      this.splitLocked = !this.splitLocked;
      this.splitMenuOpen = false;
      this.persistSplit();
    },
    onSplitWindowResize: function () {
      if (window.innerWidth > 700) {
        this.setPaneWidth(this.paneWidth, false);
        this.ensureRecentSelection();
      }
    },
    closeSplitMenu: function (event) {
      if (!this.splitMenuOpen) return;
      var menu = this.$refs.splitMenu;
      var button = this.$refs.splitOptionsButton;
      if ((!menu || !menu.contains(event.target)) && (!button || !button.contains(event.target))) {
        this.splitMenuOpen = false;
      }
    },
    artStyle: function (r) {
      return r.art ? { backgroundImage: 'url(' + r.art + ')', backgroundSize: 'cover' } : {};
    },
    isSelected: function (r) {
      var selectedFrame = this.frame;
      if (r.kind === 'artist') {
        var frames = LmsNav.stacks.musica || [];
        for (var i = frames.length - 1; i >= 0; i--) {
          if (frames[i].kind === 'artist') {
            selectedFrame = frames[i];
            break;
          }
        }
      }
      if (!selectedFrame || selectedFrame.kind !== r.kind) return false;
      var rowIds = (r.ids || [r.id]).map(String);
      var frameIds = (selectedFrame.ids || [selectedFrame.id]).map(String);
      return rowIds.some(function (id) { return frameIds.indexOf(id) >= 0; });
    },
    railLetter: function (row) {
      var c = ((row && row.label) || '').trim().charAt(0).toUpperCase();
      return /[A-Z]/.test(c) ? c : '#';
    },
    onScroll: function (e) {
      var top = Math.max(0, Math.floor(e.target.scrollTop / this.rowH));
      this.first = Math.max(0, top - 6);
      this.visible = Math.ceil(e.target.clientHeight / this.rowH);
      if (this.displayRows[top]) this.activeRail = this.railLetter(this.displayRows[top]);
    },
    jump: function (L) {
      var self = this;
      var i = this.displayRows.findIndex(function (r) { return self.railLetter(r) === L; });
      if (i >= 0 && this.$refs.scroller) {
        this.activeRail = L;
        this.$refs.scroller.scrollTop = i * this.rowH;
      }
    },
    stepRail: function (delta) {
      var current = this.railIndex;
      var next = Math.max(0, Math.min(this.RAIL.length - 1, current + delta));
      while (next > 0 && next < this.RAIL.length - 1 && !this.railHas[this.RAIL[next]]) {
        next += delta < 0 ? -1 : 1;
      }
      this.jump(this.RAIL[Math.max(0, Math.min(this.RAIL.length - 1, next))]);
    },
    scrubRail: function (e) {
      var touch = e.touches && e.touches[0];
      if (!touch) return;
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      var letter = target && target.getAttribute('data-letter');
      if (letter) this.jump(letter);
    },
    open: function (r) {
      this.rootSelection = null;
      LmsNav.reset('musica');
      LmsNav.push('musica', {
        kind: r.kind, id: r.id, ids: r.ids,
        label: r.label, sub: r.sub, art: r.art,
        year: r.year, originalYear: r.originalYear
      });
    },
    selectWithoutDrill: function (r) {
      if (!r) return;
      this.rootSelection = {
        kind: r.kind, id: r.id, ids: r.ids,
        label: r.label, sub: r.sub, art: r.art,
        year: r.year, originalYear: r.originalYear
      };
    },
    ensureRecentSelection: function () {
      if (this.view !== 'recentes' || window.innerWidth <= 700) return;
      /* A guarda precisa ser sobre a lista que o usuario ve: com um filtro que
         nao casa com nada, rows tem itens e displayRows nao, e redimensionar a
         janela lia displayRows[0] indefinido. */
      var first = this.displayRows[0];
      if (!first) return;
      var current = this.frame;
      var currentExists = current && current.kind === 'album' && this.rows.some(function (row) {
        return String(row.id) === String(current.id);
      });
      if (currentExists) return;

      this.selectWithoutDrill(first);
    },
    normalize: function (value) {
      var s = String(value || '').toLowerCase();
      return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    },
    /* Rotulo calculado nao passa pelo translateTemplate: a lista ATTRS do i18n
       so cobre atributo estatico. Mesmo idioma do tr() de search.js. */
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    /* Sem guarda aqui, de proposito: LmsUi.setSort ja recusa chave invalida para
       a view corrente, e o menu desabilita o que nao se aplica. Uma terceira
       copia da regra so daria mais um lugar para divergir -- e era exatamente
       essa copia que trocava a view do usuario para fazer a escolha caber. */
    setSort: function (key) {
      LmsUi.setSort(key, this.ui.sortDesc);
    },
    /* Recentes tem ordem propria: 'recent' e a ordem em que o servidor devolveu
       (sort:new). Devolver 'name' aqui reordenaria em ordem alfabetica e apagaria
       justamente o criterio que da nome a pagina. */
    clearMediaFilter: function () {
      LmsUi.setSort(this.view === 'recentes' ? 'recent' : 'name', this.ui.sortDesc);
    },
    toggleSelect: function () {
      if (this.ui.selectionMode) LmsUi.clearSelection();
      else this.ui.selectionMode = true;
    },
    queueSelection: function () { LmsUi.queueSelection(); },
    selected: function (r) { return !!this.ui.selected[LmsUi.selectionKey(r)]; },
    rowLabel: function (r) {
      return [r.label, r.sub].filter(Boolean).join(', ');
    },
    rowClick: function (r) {
      if (this.ui.selectionMode) LmsUi.toggleSelection(r); else this.open(r);
    },
    actions: function (r, event) { LmsUi.openActions(r, event && event.currentTarget); },
    historyAction: function (h) {
      if (h.albumId != null) {
        this.rootSelection = null;
        LmsNav.reset('musica');
        LmsNav.push('musica', {
          kind: 'album', id: h.albumId, label: h.album || h.title,
          art: LmsFmt.coverUrl(h.coverId, 50), artist: h.artist || ''
        });
        return;
      }
      LmsUi.openActions({
        kind: 'track', id: h.id, title: h.title, artist: h.artist,
        album: h.album, coverId: h.coverId
      });
    },
    historyLabel: function (h) {
      return [h.title, h.artist, h.album].filter(Boolean).join(', ');
    },
    historyArt: function (h) {
      var url = LmsFmt.coverUrl(h.coverId, 80);
      return url ? { backgroundImage: 'url(' + url + ')', backgroundSize: 'cover' } : {};
    },
    appendRows: function (items) {
      var byKey = Object.create(null);
      var byArtist = Object.create(null);
      this.rows.forEach(function (row) {
        byKey[row.key] = row;
        if (row.kind === 'artist') byArtist[this.normalize(row.label)] = row;
      }, this);
      items.forEach(function (row) {
        var existing = byKey[row.key] || (row.kind === 'artist' && byArtist[this.normalize(row.label)]);
        if (existing && row.kind === 'artist') {
          existing.ids = (existing.ids || []).concat(row.ids || []).filter(function (id, i, all) {
            return all.indexOf(id) === i;
          });
        } else if (!existing) {
          byKey[row.key] = row;
          if (row.kind === 'artist') byArtist[this.normalize(row.label)] = row;
          this.rows.push(row);
        }
      }, this);
    },
    loadArtistIndex: async function (pid, token) {
      var start = 0;
      var pageSize = 500;
      var index = Object.create(null);
      var keepGoing = true;
	      while (keepGoing && start < 10000) {
        var page = await LmsApi.artists(pid, start, pageSize);
        if (token !== this.requestToken) return null;
        page.forEach(function (artist) {
          index[this.normalize(artist.name)] = artist;
        }, this);
        var sourceCount = page.sourceCount == null ? page.length : page.sourceCount;
        start += sourceCount;
        keepGoing = sourceCount === pageSize;
      }
      /* O laco irmao em loadPagedRoot avisa quando bate no teto; este apenas
         devolvia o indice truncado. E o efeito aqui e pior: todo album de um
         artista alem do limite deixa de ser atribuido. */
      this.artistIndexTruncated = keepGoing;
      return index;
    },
    canonicalFormat: function (value) {
      var type = String(value || '').toLowerCase();
      if (type === 'flc' || type === 'flac') return 'flac';
      if (/^(alc|alac|alcx)$/.test(type)) return 'alac';
      if (/^(wvp|wv)$/.test(type)) return 'wavpack';
      if (/^(dsf|dff|dsd)$/.test(type)) return 'dsd';
      if (/^(aif|aiff)$/.test(type)) return 'aiff';
      if (/^(ogg|ogf|vorbis)$/.test(type)) return 'ogg';
      return type;
    },
    providerFromUrl: function (url) {
      var match = String(url || '').match(/^([a-z][a-z0-9+.-]*):\/\//i);
      var scheme = match ? match[1].toLowerCase() : '';
      if (/^(youtube|yt|ytmusic)$/.test(scheme)) return 'youtube';
      return scheme;
    },
    sourceLabel: function (track) {
      var provider = this.providerFromUrl(track && track.url);
      if (provider === 'qobuz') return 'Qobuz';
      if (provider === 'youtube') return 'YouTube';
      if ((track && track.remote) || (provider && provider !== 'file')) return 'Streaming';
      return 'Biblioteca local';
    },
    disambiguateDuplicateAlbums: async function (pid, token) {
      var groups = Object.create(null);
      this.rows.forEach(function (row) {
        if (row.kind !== 'album') return;
        var key = this.normalize([row.label, row.artist, row.year].join('|'));
        (groups[key] || (groups[key] = [])).push(row);
      }, this);
      var duplicates = Object.keys(groups).reduce(function (all, key) {
        return groups[key].length > 1 ? all.concat(groups[key]) : all;
      }, []);
      await Promise.all(duplicates.map(async function (row) {
        try {
          var tracks = await LmsApi.tracks(pid, row.id, 0, 1);
          if (token !== this.requestToken) return;
          row.source = tracks.length ? this.sourceLabel(tracks[0]) : '';
          row.sub = [row.artist, row.year || null, row.source || null].filter(Boolean).join(' • ');
        } catch (e) {
          /* A origem ajuda a distinguir duplicatas, mas nao deve bloquear a biblioteca. */
        }
      }, this));
    },
    loadMediaIndex: async function (pid, token) {
      if (this.mediaIndex) return this.mediaIndex;
      var index = Object.create(null);
      var start = 0;
      var pageSize = 2000;
      var keepGoing = true;
      this.loadingMore = true;
      while (keepGoing && start < 100000) {
        var page = await LmsApi.libraryTracks(pid, start, pageSize);
        if (token !== this.requestToken) return null;
        page.forEach(function (track) {
          var key = String(track.albumId);
          var meta = index[key];
          if (!meta) {
            meta = index[key] = {
              formats: Object.create(null), providers: Object.create(null),
              hires: false, standard: false, local: false, remote: false
            };
          }
          var format = this.canonicalFormat(track.format);
          if (format) meta.formats[format] = true;
          var hires = LmsFmt.isHiRes(track.sampleRate, track.sampleSize);
          meta.hires = meta.hires || hires;
          meta.standard = meta.standard || !hires;
          var provider = this.providerFromUrl(track.url);
          var remote = track.remote || (!!provider && provider !== 'file');
          meta.remote = meta.remote || remote;
          meta.local = meta.local || !remote;
          if (remote && provider) meta.providers[provider] = true;
        }, this);
        var sourceCount = page.sourceCount == null ? page.length : page.sourceCount;
        start += sourceCount;
        keepGoing = sourceCount === pageSize;
      }
      this.mediaIndex = index;
      return index;
    },
    mediaMatches: function (albumId) {
      if (!this.hasMediaFilter) return true;
      var meta = this.mediaIndex && this.mediaIndex[String(albumId)];
      if (!meta) return false;
      var parts = this.ui.sortKey.split(':');
      if (parts[0] === 'format') return !!meta.formats[parts[1]];
      if (parts[0] === 'quality') return !!meta[parts[1] === 'hires' ? 'hires' : 'standard'];
      if (parts[0] === 'origin') return !!meta[parts[1]];
      if (parts[0] === 'stream') return !!meta.providers[parts[1]];
      return true;
    },
    mediaDescriptor: function () {
      if (!this.hasMediaFilter) return '';
      var labels = {
        'quality:hires': 'Hi-Res', 'quality:standard': 'Resolução padrão',
        'origin:local': 'Biblioteca local', 'origin:remote': 'Remoto / streaming',
        'stream:qobuz': 'Qobuz', 'stream:youtube': 'YouTube'
      };
      if (labels[this.ui.sortKey]) return labels[this.ui.sortKey];
      var format = this.ui.sortKey.split(':')[1];
      var found = this.MEDIA_FORMATS.filter(function (item) { return item.key === format; })[0];
      return found ? found.label : format.toUpperCase();
    },
    loadPagedRoot: async function (pid, token) {
      var start = 0;
      var pageSize = 500;
      var keepGoing = true;
      var mainArtistIndex = this.groupsMainArtists
        ? await this.loadArtistIndex(pid, token) : null;
      /* Contador dos albuns que o indice de artistas nao soube atribuir. Sem
         ele, a perda continuaria invisivel mesmo com a linha sendo mostrada. */
      var unattributed = 0;
      if (token !== this.requestToken || (this.groupsMainArtists && !mainArtistIndex)) return;
      if (this.hasMediaFilter) {
        await this.loadMediaIndex(pid, token);
        if (token !== this.requestToken) return;
      }
      while (keepGoing && start < 10000) {
        var page;
        if (this.groupsAlbumsByRelatedArtist) {
          page = await LmsApi.artists(pid, start, pageSize);
        } else {
          page = await LmsApi.albums(pid, start, pageSize);
        }
        if (token !== this.requestToken) return;
        var sourceCount = page.sourceCount == null ? page.length : page.sourceCount;
        var relatedArtistRows = this.groupsAlbumsByRelatedArtist;
        var rows = relatedArtistRows ? page.map(function (x) {
          return {
            key: 'ar' + x.id, kind: 'artist', id: x.id, ids: x.ids,
            label: x.name, art: null
          };
        }) : this.groupsMainArtists ? page.map(function (x) {
          var artist = mainArtistIndex[this.normalize(x.artist)];
          /* Antes: `if (!artist) return null`, e o .filter(Boolean) logo abaixo
             apagava a linha. O album sumia da lista sem contagem e sem aviso.
             Isso alcanca muito mais do que "album sem artista": artista de
             album composto ("A & B"), coletanea de varios artistas, artista que
             so existe como contribuidor de faixa, e o nome abreviado que
             canonicalizeArtists nao conseguiu resolver.

             A linha passa a ser o proprio album. E uma linha que ja funciona em
             todo o resto da tela: clicar abre o album. O que ela nao faz e
             agrupar sob um artista que o indice desconhece — e isso agora e
             dito na tela, em vez de acontecer em silencio. */
          if (!artist) {
            unattributed++;
            return {
              key: 'al' + x.id, kind: 'album', id: x.id, label: x.title,
              sub: [x.artist, x.year || null].filter(Boolean).join(' • '),
              artist: x.artist, year: x.year, originalYear: x.originalYear,
              art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null
            };
          }
          return {
            key: 'main-ar' + artist.id, kind: 'artist', id: artist.id, ids: artist.ids,
            label: artist.name, art: null
          };
        }, this).filter(Boolean) : page.filter(function (x) {
          return this.mediaMatches(x.id);
        }, this).map(function (x) {
          return {
            key: 'al' + x.id, kind: 'album', id: x.id, label: x.title,
            sub: [x.artist, x.year || null, this.mediaDescriptor()].filter(Boolean).join(' • '),
            artist: x.artist, year: x.year, originalYear: x.originalYear,
            art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null
          };
        }, this);
        this.appendRows(rows);
        this.loading = false;
        start += sourceCount;
        keepGoing = sourceCount === pageSize;
        this.loadingMore = keepGoing;
	        if (keepGoing) await new Promise(function (resolve) { setTimeout(resolve, 0); });
	      }
	      if (keepGoing) {
	        this.limitWarning = 'A biblioteca tem mais itens do que esta tela carregou. Use o filtro para refinar a lista.';
	      } else if (this.artistIndexTruncated) {
	        this.limitWarning = 'O índice de artistas parou em 10.000 nomes. Álbuns de artistas além desse ponto aparecem como álbum nesta lista.';
	      } else if (unattributed) {
	        /* O numero entra por {n}, depois da traducao. Concatenar o total na
	           frente produzia uma frase que nunca batia com uma chave do
	           dicionario -- este aviso aparecia em portugues numa sessao em
	           ingles. O marcador tambem deixa o tradutor mover o numero. */
	        this.limitWarning = this.tr(unattributed === 1
	          ? '1 álbum não pôde ser atribuído a um artista do índice e aparece como álbum nesta lista.'
	          : '{n} álbuns não puderam ser atribuídos a um artista do índice e aparecem como álbum nesta lista.'
	        ).replace('{n}', unattributed);
	      }
	      if (!this.groupsAlbumsByArtist && !this.groupsAlbumsByRelatedArtist && !this.hasMediaFilter) {
	        await this.disambiguateDuplicateAlbums(pid, token);
      }
    },
    reload: async function (preserveNavigation) {
      var token = ++this.requestToken;
      this.loading = true;
	      this.loadingMore = false;
	      this.limitWarning = '';
	      this.artistIndexTruncated = false;
      this.error = '';
      this.rows = [];
      this.first = 0;
      this.activeRail = '';
      if (!preserveNavigation) {
        this.rootSelection = null;
        LmsNav.reset('musica');
      }
      var pid = this.store.playerId || '';
      try {
        if (this.view === 'artistas' || this.view === 'albuns') {
          await this.loadPagedRoot(pid, token);
        } else if (this.view === 'recentes') {
          if (this.hasMediaFilter) {
            await this.loadMediaIndex(pid, token);
            if (token !== this.requestToken) return;
          }
	          var al = await LmsApi.albums(pid, 0, 250, { sort: 'new' });
	          var recentSourceCount = al.sourceCount == null ? al.length : al.sourceCount;
          this.rows = al.filter(function (x) {
            return this.mediaMatches(x.id);
          }, this).map(function (x) {
            return {
              key: 'al' + x.id, kind: 'album', id: x.id, label: x.title,
              sub: [x.artist, x.year || null, this.mediaDescriptor()].filter(Boolean).join(' • '),
              artist: x.artist, year: x.year, originalYear: x.originalYear,
              art: LmsFmt.coverUrl(x.artworkTrackId, 50) || null
            };
          }, this);
	          await this.disambiguateDuplicateAlbums(pid, token);
	          if (recentSourceCount === 250) {
	            this.limitWarning = 'Recentes mostra os 250 álbuns mais novos. Use o filtro para refinar.';
	          }
        } else if (this.view === 'generos') {
          var g = await LmsApi.genres(pid, 0, 2000);
          if (token !== this.requestToken) return;
          if (g.length >= 2000) this.limitWarning = 'Esta biblioteca tem mais de 2.000 gêneros; esta tela mostra os 2.000 primeiros.';
          this.rows = g.map(function (x) {
            return { key: 'g' + x.id, kind: 'genre', id: x.id, label: x.name, art: null };
          });
        } else {
          var y = await LmsApi.years(pid, 0, 500);
          if (token !== this.requestToken) return;
          if (y.length >= 500) this.limitWarning = 'Esta biblioteca tem mais de 500 anos distintos; esta tela mostra os 500 primeiros.';
          this.rows = y.map(function (x) {
            return { key: 'y' + x.year, kind: 'year', id: x.year, label: String(x.year), art: null };
          });
        }
      } catch (e) {
        if (token !== this.requestToken) return;
        this.error = e && e.message ? e.message : String(e);
      }
      if (token !== this.requestToken) return;
      this.loading = false;
      this.loadingMore = false;
      if (this.rows.length) this.activeRail = this.railLetter(this.rows[0]);
      var self = this;
      this.$nextTick(function () {
        if (self.$refs.scroller) {
          self.$refs.scroller.scrollTop = 0;
          self.visible = Math.ceil(self.$refs.scroller.clientHeight / self.rowH) || 14;
        }
        self.ensureRecentSelection();
      });
    }
  },
  created: function () { this.reload(true); },
  mounted: function () {
    this.setPaneWidth(this.paneWidth, false);
    window.addEventListener('resize', this.onSplitWindowResize);
    document.addEventListener('pointerdown', this.closeSplitMenu);
  },
  beforeDestroy: function () {
    window.removeEventListener('resize', this.onSplitWindowResize);
    document.removeEventListener('pointerdown', this.closeSplitMenu);
    document.body.classList.remove('resizing-split');
  }
});
