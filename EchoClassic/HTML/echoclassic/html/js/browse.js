
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

/* Fora do componente de proposito: `methods` so aceita funcao, e o Vue embrulha
   qualquer outro valor -- uma string ali vira uma funcao vazia, e a chave de
   storage vira o texto do corpo dessa funcao. */
var LMS_MEDIA_CACHE_KEY = 'echoclassic.media.v1';

Vue.component('lms-browse', {
  template: `
<div ref="split" class="split-body" :class="{'split-locked': splitLocked}"
     :style="{'--pane-current': paneWidth + 'px'}">
  <div class="pane-left">
    <div class="library-tools" :class="{tight: toolbarTight}">
      <input v-model="ui.filter" type="search" placeholder="Filtrar"
             :aria-label="'Filtrar ' + viewLabel.toLowerCase()">
      <button ref="filterTrigger" class="icon-command filter-command" :class="{on: toolsActive}"
              :title="filterTitle" :aria-label="filterTriggerLabel" aria-haspopup="dialog"
              :aria-expanded="String(ui.filterPanel)" @click="openFilters">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5h17l-6.5 7.6v5.6l-4 2.3v-7.9z"/></svg>
        <span v-if="filterCount" class="filter-badge" aria-hidden="true">{{ filterCount }}</span>
      </button>
      <select :value="sortKey" :aria-label="sortSelectLabel" @change="chooseSort($event.target.value)">
        <option v-if="view === 'recentes'" value="recent">Adicionados recentemente</option>
        <option :value="primaryOptionValue">{{ primaryOptionLabel }}</option>
        <option v-if="view === 'albuns' || view === 'recentes'" value="artist">Artista</option>
        <option v-if="view === 'albuns' || view === 'recentes'" value="year">Ano</option>
        <option v-if="allowsMediaFilter" value="format">Formato</option>
        <option v-if="allowsMediaFilter" value="source">Biblioteca local primeiro</option>
        <option v-if="allowsMediaFilter" value="quality">Maior resolução primeiro</option>
      </select>
	      <button class="icon-command" :title="sortTitle" :aria-label="sortLabel"
	              :aria-pressed="String(sortDesc)"
	              @click="LmsUi.toggleSortDir()">
        <span aria-hidden="true">{{ sortDesc ? '↓' : '↑' }}</span>
      </button>
      <button v-if="!ui.selectionMode" class="text-command select-command"
              :class="{tight: toolbarTight}" :title="toolbarTight ? 'Selecionar' : null"
              aria-label="Selecionar" @click="toggleSelect">
        <svg v-if="toolbarTight" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 6.5h15M4.5 12h15M4.5 17.5h15"/><circle cx="8" cy="6.5" r="2.2"/>
          <circle cx="14" cy="12" r="2.2"/><circle cx="10" cy="17.5" r="2.2"/>
        </svg>
        <span v-else>Selecionar</span>
      </button>
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
    <div v-if="activeChips.length" class="filter-chip">
      <template v-if="compact">
        <span class="filter-chip-label">{{ compactSummary }}</span>
        <button type="button" class="filter-chip-clear" @click="openFilters">Ver filtros</button>
        <button type="button" class="filter-chip-clear" @click="clearAllTools">Limpar tudo</button>
      </template>
      <template v-else>
        <span class="filter-chip-label">Ativos:</span>
        <span class="filter-pill-strip">
          <button v-for="c in activeChips" :key="c.key" type="button" class="filter-pill"
                  :class="'pill-' + c.kind" :aria-label="c.removeLabel" @click="c.remove()">
            <span class="filter-pill-mark" aria-hidden="true">{{ c.mark }}</span>
            <span class="ell">{{ c.label }}</span><span class="filter-pill-x" aria-hidden="true">×</span>
          </button>
        </span>
        <span class="filter-chip-count">{{ resultCount }}</span>
        <button type="button" class="filter-chip-clear" @click="clearAllTools">Limpar tudo</button>
      </template>
    </div>
    <div v-if="listNotes.length" class="filter-chip notes" role="status">
      <span v-for="n in listNotes" :key="n">{{ n }}</span>
    </div>
    <div v-if="filtersIgnored" class="filter-chip warning" role="status">
      <span class="ell">Artista relacionado monta a lista a partir dos artistas do servidor, então os filtros
        de mídia não se aplicam aqui.</span>
    </div>
    <p aria-live="polite" class="visually-hidden">{{ liveSummary }}</p>
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
	        <template v-for="it in windowed">
	          <div v-if="it.type === 'header'" :key="it.key" class="sec-head"
	               role="heading" aria-level="3">
	            <span class="ell">{{ it.label }}</span>
	            <span class="sec-count">{{ it.count }}</span>
	          </div>
	          <div v-else :key="it.key" class="row"
	             :class="{sel: isSelected(it.row), chosen: selected(it.row), artistrow: it.row.kind === 'artist',
	                      noart: !it.row.art, albumrow: showsAlbums}"
	             role="group" :aria-label="rowLabel(it.row)">
	          <button type="button" class="row-main pointer" :aria-label="rowLabel(it.row)"
	                  :aria-pressed="ui.selectionMode ? String(selected(it.row)) : null"
	                  @click="rowClick(it.row)">
	            <span v-if="ui.selectionMode" class="select-mark" :class="{on: selected(it.row)}"></span>
	            <span v-if="it.row.art" class="art" :style="artStyle(it.row)"></span>
	            <span class="ell">
	              <span class="t ell">{{ it.row.label }}</span>
	              <span v-if="it.row.sub" class="s ell">{{ it.row.sub }}</span>
	            </span>
	          </button>
	          <button v-if="!ui.selectionMode" class="more-command" title="Mais ações"
	                  :aria-label="'Mais ações para ' + it.row.label" @click.stop="actions(it.row, $event)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle class="more-ring" cx="12" cy="12" r="8.5"/>
              <circle class="more-dot" cx="8.5" cy="12" r="1"/>
              <circle class="more-dot" cx="12" cy="12" r="1"/>
              <circle class="more-dot" cx="15.5" cy="12" r="1"/>
            </svg>
          </button>
	          </div>
	        </template>
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
	      loadingMore: false, limitWarning: '', requestToken: 0, unknownCount: 0,
	      artistIndexTruncated: false,
      rootSelection: null,
      first: 0, visible: 14, activeRail: '',
      mediaIndex: null,
      /* Largura real, nao nome de aparelho: a mesma tela vira estreita quando o
         usuario divide a janela ou aumenta a fonte. 700px e o ponto que o CSS
         desta skin ja usa para passar a uma coluna. */
      compact: typeof window !== 'undefined' && window.innerWidth <= 700,
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
    /* O select passou a fazer uma coisa so. Enquanto ele acumulava filtro e
       agrupamento, o rotulo tinha de mudar por view para nao mentir sobre o que
       aquele controle fazia ali; agora ele ordena, em qualquer raiz. */
    sortSelectLabel: function () { return this.tr('Ordenar por'); },
    frame: function () { return LmsNav.top('musica') || this.rootSelection; },
    sortKey: function () { return (this.ui.sort[0] || {}).key || 'name'; },
    sortDesc: function () { return !!(this.ui.sort[0] || {}).desc; },
    groupsAlbumsByArtist: function () {
      return this.ui.group.indexOf('artist') >= 0;
    },
    groupsMainArtists: function () {
      return this.view === 'artistas' || this.groupsAlbumsByArtist;
    },
    groupsAlbumsByRelatedArtist: function () {
      return this.ui.group.indexOf('relatedArtist') >= 0;
    },
	    selectionCount: function () { return Object.keys(this.ui.selected).length; },
	    selectionCountLabel: function () {
	      var n = this.selectionCount;
	      if (!n) return 'Nenhum item selecionado';
	      return n + (n === 1 ? ' item selecionado' : ' itens selecionados');
	    },
	    sortLabel: function () {
	      return 'Ordem atual: ' + (this.sortDesc ? 'decrescente' : 'crescente') +
	        '. Alternar ordem';
	    },
	    sortTitle: function () {
	      return this.sortDesc ? 'Mudar para ordem crescente' : 'Mudar para ordem decrescente';
	    },
    allowsMediaFilter: function () { return LmsUi.allowsMediaFilter(this.view); },
    /* Uma leitura so do modo, com padrao explicito: 'none' e o estado em que
       nada e reordenado, e e ele que vale quando a preferencia nunca foi
       tocada. */
    preferMode: function () { return this.ui.prefer || 'none'; },
    hasMediaFilter: function () {
      return this.allowsMediaFilter && this.ui.filters.length > 0;
    },
    /* Artista relacionado monta a lista a partir do endpoint de artistas: nao ha
       album para conferir, entao o filtro nao tem como ser aplicado. Dizer isso
       na tela e o oposto do bug C -- ali a promessa era vazia e ninguem avisava. */
    filtersIgnored: function () {
      return this.hasMediaFilter && this.groupsAlbumsByRelatedArtist;
    },
    activeFilters: function () {
      return this.ui.filters.map(function (key) {
        return { key: key, label: this.filterLabel(key) };
      }, this);
    },
    sectionKey: function () {
      return this.allowsMediaFilter ? (this.ui.sections[0] || '') : '';
    },
    /* Contagem do badge: quantos filtros o usuario ligou. Agrupamento, ordem e
       preferencia mudam a apresentacao, nao o conjunto -- eles acendem o icone
       mas nao entram no numero. */
    filterCount: function () { return this.activeFilters.length; },
    toolsActive: function () {
      return this.filterCount > 0 || !!this.sectionKey || this.ui.group.length > 0 ||
             this.preferMode !== 'none';
    },
    filterTitle: function () {
      return this.filterCount
        ? this.tr('Filtros') + ' (' + this.filterCount + ')'
        : this.tr('Filtros');
    },
    filterTriggerLabel: function () {
      if (!this.filterCount) return this.tr('Filtros');
      return this.tr('Filtros') + ': ' + this.filterCount + ' ' +
        this.tr(this.filterCount === 1 ? 'filtro ativo' : 'filtros ativos');
    },
    /* Uma pilula por coisa ligada, com a marca do conceito a que ela pertence --
       filtro exclui, secao agrupa, estrela e preferencia. Sao tres efeitos
       diferentes e a fileira nunca deixa parecer que sao o mesmo. */
    activeChips: function () {
      var self = this;
      var chips = this.activeFilters.map(function (f) {
        return {
          key: 'f:' + f.key, kind: 'filter', mark: '◫', label: f.label,
          removeLabel: self.tr('Remover filtro') + ' ' + f.label,
          remove: function () { LmsUi.toggleFilter(f.key); }
        };
      });
      if (this.ui.group.length) {
        var groupKey = this.ui.group[0];
        chips.push({
          key: 'g:' + groupKey, kind: 'group', mark: '⚙',
          label: this.tr(groupKey === 'artist' ? 'Artista' : 'Artista relacionado'),
          removeLabel: self.tr('Remover agrupamento'),
          remove: function () { LmsUi.clearGroup(); }
        });
      }
      if (this.sectionKey) {
        chips.push({
          key: 's:' + this.sectionKey, kind: 'group', mark: '⚙',
          label: this.sectionFacetLabel(this.sectionKey),
          removeLabel: self.tr('Remover agrupamento'),
          remove: function () { LmsUi.clearSections(); }
        });
      }
      if (this.preferMode !== 'none') {
        chips.push({
          key: 'p:' + this.preferMode, kind: 'prefer', mark: '★',
          label: this.preferLabel(this.preferMode),
          removeLabel: self.tr('Remover preferência de reprodução'),
          remove: function () { LmsUi.setPrefer('none'); }
        });
      }
      return chips;
    },
    resultCount: function () { return this.displayRows.length; },
    /* A barra tem seis controles e o painel esquerdo comeca em 360px: sem
       encolher nada, ela quebrava em tres linhas e comia a lista logo na
       primeira abertura. O que encolhe e o rotulo do comando secundario -- a
       busca e o funil ficam, do tamanho que estavam. */
    toolbarTight: function () { return this.paneWidth < 430; },
    /* Dois numeros que existiam so na memoria do componente. Contar sem dizer e
       a mesma familia do bug B: o dado sumia e nada na tela explicava. */
    listNotes: function () {
      var notes = [];
      if (this.unknownCount) {
        notes.push(this.tr(this.unknownCount === 1
          ? '1 álbum ficou de fora por não ter informação de mídia.'
          : '{n} álbuns ficaram de fora por não terem informação de mídia.'
        ).replace('{n}', this.unknownCount));
      }
      if (this.sectionOverlap) {
        notes.push(this.tr('Alguns álbuns aparecem em mais de uma seção.'));
      }
      return notes;
    },
    compactSummary: function () {
      var n = this.activeChips.length;
      return n + ' ' + this.tr(n === 1 ? 'ajuste ativo' : 'ajustes ativos');
    },
    liveSummary: function () {
      if (!this.activeChips.length) return '';
      return this.activeChips.map(function (c) { return c.label; }).join(', ') + ' — ' +
        this.displayRows.length + ' ' +
        this.tr(this.displayRows.length === 1 ? 'resultado' : 'resultados');
    },
    /* O indice de midia deixa de ser exclusivo do filtro: seccionar por formato
       e ordenar por resolucao leem a mesma tabela, e a preferencia de
       reproducao tambem. Sem estender o gatilho, essas tres sairiam vazias --
       e vazio em silencio e o defeito que esta versao inteira ataca. */
    needsMediaIndex: function () {
      if (!this.allowsMediaFilter) return false;
      if (this.hasMediaFilter) return true;
      if (LmsUi.sectionNeedsMedia(this.sectionKey)) return true;
      if (LmsUi.sortNeedsMedia(this.sortKey)) return true;
      return this.preferMode !== 'none';
    },
    showsAlbums: function () {
      return (this.view === 'albuns' && !this.groupsAlbumsByArtist &&
              !this.groupsAlbumsByRelatedArtist) || this.view === 'recentes';
    },
    hasRail: function () {
      /* O indice alfabetico so faz sentido sobre uma lista alfabetica; em
         'recent' as letras nao sobem e saltar levaria a lugar nenhum. Com
         secoes a lista tambem deixa de ser monotonica: a letra M aparece uma
         vez por secao, e o salto escolheria uma delas sem criterio. */
      return !this.loading && this.rows.length > 30 && this.sortKey !== 'recent' &&
             !this.sectionKey && !LmsUi.sortNeedsMedia(this.sortKey) &&
             (this.view === 'artistas' || this.view === 'albuns' || this.view === 'recentes');
    },
    rowH: function () { return this.showsAlbums ? 88 : 72; },
    headerH: function () { return 34; },
    displayRows: function () {
      var q = this.normalize(this.ui.filter);
      var rows = q ? this.rows.filter(function (r) {
        return this.normalize([r.label, r.sub, r.artist, r.year].filter(Boolean).join(' ')).indexOf(q) >= 0;
      }, this) : this.rows.slice();
      /* 'recent' e a ordem em que o servidor devolveu (sort:new). Reordenar
         aqui era o que fazia Recentes aparecer em ordem alfabetica. */
      if ((this.ui.sort[0] || {}).key !== 'recent') rows.sort(this.rowComparator());
      return rows;
    },
    /* A lista que a tela desenha: linhas, e cabecalhos quando ha secao. Uma
       linha pode aparecer em mais de uma secao -- um album com FLAC e MP3 esta
       nas duas -- entao a chave leva o prefixo da secao. */
    displayItems: function () {
      var rows = this.displayRows;
      if (!this.sectionKey) {
        return rows.map(function (row) { return { type: 'row', key: row.key, row: row }; });
      }
      var buckets = Object.create(null);
      var order = [];
      rows.forEach(function (row) {
        this.sectionValuesFor(row).forEach(function (value) {
          if (!buckets[value.key]) {
            buckets[value.key] = { label: value.label, rank: value.rank, rows: [] };
            order.push(value.key);
          }
          buckets[value.key].rows.push(row);
        });
      }, this);
      order.sort(function (a, b) {
        if (buckets[a].rank !== buckets[b].rank) return buckets[a].rank - buckets[b].rank;
        return String(buckets[a].label).localeCompare(String(buckets[b].label), 'pt-BR',
          { sensitivity: 'base' });
      });
      var out = [];
      order.forEach(function (key) {
        var bucket = buckets[key];
        out.push({ type: 'header', key: 'h:' + key, label: bucket.label, count: bucket.rows.length });
        bucket.rows.forEach(function (row) {
          out.push({ type: 'row', key: key + '|' + row.key, row: row });
        });
      });
      return out;
    },
    /* Virtualizacao por soma de prefixos. Enquanto tudo tinha a mesma altura,
       indice x altura bastava; com cabecalho no meio essa multiplicacao mente,
       e o sintoma seria a lista saltando durante a rolagem. */
    itemOffsets: function () {
      var items = this.displayItems;
      var offsets = new Array(items.length + 1);
      var acc = 0;
      for (var i = 0; i < items.length; i++) {
        offsets[i] = acc;
        acc += items[i].type === 'header' ? this.headerH : this.rowH;
      }
      offsets[items.length] = acc;
      return offsets;
    },
    windowed: function () { return this.displayItems.slice(this.first, this.first + this.visible + 12); },
    topPad: function () {
      return this.itemOffsets[Math.min(this.first, this.displayItems.length)] || 0;
    },
    botPad: function () {
      var end = Math.min(this.first + this.windowed.length, this.displayItems.length);
      return Math.max(0, this.itemOffsets[this.displayItems.length] - this.itemOffsets[end]);
    },
    /* Uma faceta multivalorada faz o mesmo album contar em duas secoes; a soma
       dos cabecalhos passa do total, e quem le precisa saber por que. */
    sectionOverlap: function () {
      if (!this.sectionKey) return 0;
      var rowItems = this.displayItems.filter(function (it) { return it.type === 'row'; });
      return Math.max(0, rowItems.length - this.displayRows.length);
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
    /* Filtrar e agrupar mudam o que e carregado; ordenar so reordena o que ja
       esta na tela, e displayRows cuida disso sozinho. Antes qualquer troca de
       sortKey em Albuns recarregava a biblioteca inteira, inclusive para mudar
       de A-Z para Ano. */
    'ui.filters': function () { this.reload(false); },
    'ui.group': function () { this.reload(false); },
    /* Seccionar, ordenar e preferir nao mudam o CONJUNTO carregado -- so a
       apresentacao. Recarregar a biblioteca para acrescentar cabecalhos seria
       cobrar dez segundos por uma mudanca de layout. O que pode faltar e o
       indice de midia, e so ele e buscado. */
    'ui.sections': function () { this.ensureMediaIndex(); },
    'ui.prefer': function () { this.ensureMediaIndex(); },
    'ui.sort': function () { this.ensureMediaIndex(); },
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
    /* Busca binaria sobre a soma de prefixos: qual item ocupa esta altura de
       rolagem. Substitui a divisao por altura fixa, que so valia enquanto todos
       os itens da lista tinham o mesmo tamanho. */
    indexAtOffset: function (offset) {
      var offsets = this.itemOffsets;
      var lo = 0;
      var hi = Math.max(0, offsets.length - 2);
      while (lo < hi) {
        var mid = Math.floor((lo + hi + 1) / 2);
        if (offsets[mid] <= offset) lo = mid; else hi = mid - 1;
      }
      return lo;
    },
    onScroll: function (e) {
      var top = this.indexAtOffset(Math.max(0, e.target.scrollTop));
      this.first = Math.max(0, top - 6);
      this.visible = Math.ceil(e.target.clientHeight / this.rowH);
      var item = this.displayItems[top];
      if (item && item.type === 'row') this.activeRail = this.railLetter(item.row);
    },
    jump: function (L) {
      var self = this;
      var i = this.displayItems.findIndex(function (it) {
        return it.type === 'row' && self.railLetter(it.row) === L;
      });
      if (i >= 0 && this.$refs.scroller) {
        this.activeRail = L;
        this.$refs.scroller.scrollTop = this.itemOffsets[i];
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
    /* O <select> agora e so ordenacao. Filtrar e agrupar tem controle proprio --
       o icone de funil --, e com isso desaparece o roteamento que mandava tres
       conceitos pelo mesmo campo. Sem guarda aqui de proposito: LmsUi.setSort ja
       recusa chave invalida para a view corrente. */
    chooseSort: function (value) {
      LmsUi.setSort([{ key: value, desc: this.sortDesc }]);
    },
    openFilters: function () { LmsUi.openFilterPanel(this.$refs.filterTrigger); },
    clearAllTools: function () { LmsUi.resetView(); },
    onToolsResize: function () {
      this.compact = window.innerWidth <= 700;
    },
    filterValues: function (facet) {
      return this.ui.filters.filter(function (key) {
        return LmsUi.filterFacet(key) === facet;
      }).map(function (key) { return key.slice(key.indexOf(':') + 1); });
    },
    metaFor: function (id) {
      return (this.mediaIndex && this.mediaIndex[String(id)]) || null;
    },
    /* Ano e um intervalo, e intervalo nao cabe no indice de midia: ele mora na
       propria linha do album. Filtrado aqui, junto do resto, para que a lista
       vazia continue tendo uma unica explicacao. */
    yearMatches: function (album) {
      var ranges = this.filterValues('year');
      if (!ranges.length) return true;
      var year = Number(album && album.year);
      if (!year) return false;
      return ranges.some(function (range) {
        var parts = String(range).split('-');
        return year >= Number(parts[0]) && year <= Number(parts[1]);
      });
    },
    albumPasses: function (album) {
      return this.yearMatches(album) && this.mediaMatches(album && album.id);
    },
    preferLabel: function (mode) {
      var labels = {
        local: 'Preferir biblioteca local', stream: 'Preferir streaming',
        quality: 'Preferir maior resolução'
      };
      return this.tr(labels[mode] || 'Sem preferência');
    },
    sectionFacetLabel: function (key) {
      var labels = {
        decade: 'Década', format: 'Formato', quality: 'Resolução',
        origin: 'Origem', stream: 'Serviço de streaming'
      };
      return this.tr(labels[key] || key);
    },
    /* Um album pode cair em mais de uma secao. Devolver uma lista, e nao um
       valor, e o que impede a escolha silenciosa de "o formato principal" --
       um album com FLAC e MP3 aparece nos dois cabecalhos, e a contagem diz. */
    sectionValuesFor: function (row) {
      var key = this.sectionKey;
      if (key === 'decade') {
        var year = Number(row.year);
        if (!year) return [{ key: 'unknown', label: this.tr('Ano desconhecido'), rank: 1 }];
        var decade = Math.floor(year / 10) * 10;
        return [{ key: 'd' + decade, label: this.tr('Anos') + ' ' + decade, rank: 0 }];
      }
      var meta = this.metaFor(row.id);
      var unknown = [{ key: 'unknown', label: this.tr('Sem informação de mídia'), rank: 1 }];
      if (!meta) return unknown;
      var out = [];
      if (key === 'format') {
        out = Object.keys(meta.formats).map(function (f) {
          return { key: 'f' + f, label: this.filterLabel('format:' + f), rank: 0 };
        }, this);
      } else if (key === 'quality') {
        if (meta.hires) out.push({ key: 'hires', label: this.filterLabel('quality:hires'), rank: 0 });
        if (meta.standard) out.push({ key: 'standard', label: this.filterLabel('quality:standard'), rank: 0 });
      } else if (key === 'origin') {
        if (meta.local) out.push({ key: 'local', label: this.filterLabel('origin:local'), rank: 0 });
        if (meta.remote) out.push({ key: 'remote', label: this.filterLabel('origin:remote'), rank: 0 });
      } else if (key === 'stream') {
        out = Object.keys(meta.providers).map(function (p) {
          return { key: 'p' + p, label: this.filterLabel('stream:' + p), rank: 0 };
        }, this);
        if (!out.length && meta.local) {
          out = [{ key: 'nostream', label: this.tr('Sem serviço de streaming'), rank: 1 }];
        }
      }
      return out.length ? out : unknown;
    },
    /* Recentes tem ordem propria: 'recent' e a ordem em que o servidor devolveu
       (sort:new). Devolver 'name' aqui reordenaria em ordem alfabetica e apagaria
       justamente o criterio que da nome a pagina. */
    clearMediaFilter: function () {
      LmsUi.clearFilters();
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
    ensureMediaIndex: async function () {
      if (!this.needsMediaIndex || this.mediaIndex) return;
      var token = this.requestToken;
      await this.loadMediaIndex(this.store.playerId || '', token);
    },
    /* Edicoes irmas: mesma obra, arquivos diferentes. O casamento e por titulo e
       artista normalizados, e e de proposito que ele seja estrito -- "Head
       Hunters" e "Head Hunters (Remastered)" tem titulos diferentes e ficam
       separados. Casamento incerto sempre erra para o lado de NAO juntar:
       perder uma edicao e pior do que mostrar duas. */
    editionsFor: function (row) {
      if (!row || row.kind !== 'album') return [];
      var self = this;
      var key = this.normalize([row.label, row.artist].join('|'));
      var siblings = this.rows.filter(function (r) {
        return r.kind === 'album' && self.normalize([r.label, r.artist].join('|')) === key;
      });
      if (siblings.length < 2) return [];
      return siblings.slice().sort(function (a, b) {
        return LmsFmt.compareEditions(self.metaFor(a.id), self.metaFor(b.id), self.preferMode) ||
               (Number(a.id) || 0) - (Number(b.id) || 0);
      }).map(function (r) {
        return { id: r.id, label: r.label, source: self.editionSource(self.metaFor(r.id)) };
      });
    },
    editionSource: function (meta) {
      if (!meta) return this.tr('Sem informação de mídia');
      var providers = Object.keys(meta.providers);
      var where = providers.length ? this.filterLabel('stream:' + providers[0])
        : this.tr(meta.local ? 'Biblioteca local' : 'Remoto / streaming');
      var formats = Object.keys(meta.formats).map(function (f) {
        return this.filterLabel('format:' + f);
      }, this);
      var spec = [formats[0], meta.hires ? 'Hi-Res' : null].filter(Boolean).join(' ');
      return [where, spec].filter(Boolean).join(' · ');
    },
    /* A folha de acoes leva as edicoes junto: e ela quem toca, e a escolha de
       qual edicao tocar so pode ser feita por quem sabe quais existem. */
    actions: function (r, event) {
      var item = r;
      if (this.preferMode !== 'none') {
        var editions = this.editionsFor(r);
        if (editions.length > 1) {
          item = Object.assign({}, r, { editions: editions, prefer: this.preferMode });
        }
      }
      LmsUi.openActions(item, event && event.currentTarget);
    },
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
    /* Rotulo montado em tempo de execucao e colado no subtitulo da linha: nao
       passa pelo translateTemplate, entao precisa do tr() na mao. Sem ele,
       "Biblioteca local" aparecia em portugues numa sessao em ingles -- visto
       na tela, na propria foto do README. */
    sourceLabel: function (track) {
      var provider = this.providerFromUrl(track && track.url);
      if (provider === 'qobuz') return 'Qobuz';
      if (provider === 'youtube') return 'YouTube';
      if ((track && track.remote) || (provider && provider !== 'file')) return this.tr('Streaming');
      return this.tr('Biblioteca local');
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
    /* O indice ocupa ~150 KB em memoria e ~31 KB compactado. Guardar em
       localStorage e suficiente e mantem o idioma do resto do codigo; o
       IndexedDB so se pagaria numa biblioteca uma ordem de grandeza maior.
       Formato: [formatos, provedores, bits] -- objetos de booleanos gastariam
       cinco vezes mais espaco para a mesma informacao. */
    packMedia: function (index) {
      var out = {};
      Object.keys(index).forEach(function (id) {
        var m = index[id];
        out[id] = [
          Object.keys(m.formats).join(','),
          Object.keys(m.providers).join(','),
          (m.hires ? 1 : 0) | (m.standard ? 2 : 0) | (m.local ? 4 : 0) | (m.remote ? 8 : 0)
        ];
      });
      return out;
    },
    unpackMedia: function (packed) {
      var index = Object.create(null);
      Object.keys(packed || {}).forEach(function (id) {
        var row = packed[id];
        if (!Array.isArray(row)) return;
        var meta = { formats: Object.create(null), providers: Object.create(null),
                     hires: !!(row[2] & 1), standard: !!(row[2] & 2),
                     local: !!(row[2] & 4), remote: !!(row[2] & 8) };
        String(row[0] || '').split(',').forEach(function (f) { if (f) meta.formats[f] = true; });
        String(row[1] || '').split(',').forEach(function (p) { if (p) meta.providers[p] = true; });
        index[id] = meta;
      });
      return index;
    },
    readMediaCache: function (lastscan) {
      if (!lastscan) return null;
      try {
        var saved = JSON.parse(localStorage.getItem(LMS_MEDIA_CACHE_KEY) || '');
        if (!saved || saved.lastscan !== lastscan) return null;
        var index = this.unpackMedia(saved.index);
        return Object.keys(index).length ? index : null;
      } catch (e) { return null; }
    },
    writeMediaCache: function (lastscan, index) {
      if (!lastscan) return;
      try {
        localStorage.setItem(LMS_MEDIA_CACHE_KEY,
          JSON.stringify({ lastscan: lastscan, index: this.packMedia(index) }));
      } catch (e) {
        /* Cota estourada nao pode derrubar a navegacao: sem cache a skin so
           volta a levar os dez segundos de sempre. */
      }
    },
    loadMediaIndex: async function (pid, token) {
      if (this.mediaIndex) return this.mediaIndex;
      /* O lastscan muda quando a biblioteca muda; enquanto ele for o mesmo, o
         indice guardado continua valendo e a espera de ~10s desaparece. */
      var lastscan = '';
      try { lastscan = (await LmsApi.serverInfo()).lastscan; } catch (e) { lastscan = ''; }
      if (token !== this.requestToken) return null;
      var cached = this.readMediaCache(lastscan);
      if (cached) { this.mediaIndex = cached; return cached; }
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
      this.writeMediaCache(lastscan, index);
      return index;
    },
    /* Ordem total. Sem desempate encadeado, dois albuns com o mesmo valor no
       criterio escolhido trocam de lugar entre renderizacoes -- o comparador
       nao era determinístico. O id e unico, entao encerra qualquer empate.
       Nulo vai sempre ao fim, nos DOIS sentidos: em crescente "sem ano" no topo
       e ruido, e em decrescente tambem. */
    rowComparator: function () {
      var criteria = (this.ui.sort || []).slice();
      var self = this;
      var prefer = this.preferMode || 'none';
      /* 'format', 'source' e 'quality' saem do indice de midia. Sem entrada no
         indice o valor e nulo, e nulo vai ao fim -- nunca some. */
      var valueOf = function (row, key) {
        if (key === 'year') return row.year == null || row.year === '' ? null : Number(row.year);
        if (key === 'artist') return row.artist || row.label || '';
        if (key === 'format' || key === 'source' || key === 'quality') {
          var meta = self.metaFor(row.id);
          if (!meta) return null;
          if (key === 'format') return Object.keys(meta.formats).sort()[0] || null;
          if (key === 'source') return meta.local ? 0 : (meta.remote ? 1 : null);
          var rank = LmsFmt.editionRank(meta, 'quality');
          return rank[2] * 10 + rank[3];   // codec pesa mais que resolucao
        }
        return row.label || '';
      };
      var texto = function (a, b) {
        return String(a).localeCompare(String(b), 'pt-BR', { sensitivity: 'base' });
      };
      var vazio = function (v) {
        return v == null || v === '' || (typeof v === 'number' && !isFinite(v));
      };
      var cmpOne = function (a, b, key, desc) {
        var av = valueOf(a, key), bv = valueOf(b, key);
        if (vazio(av) && vazio(bv)) return 0;
        if (vazio(av)) return 1;
        if (vazio(bv)) return -1;
        var r = (typeof av === 'number' && typeof bv === 'number') ? av - bv : texto(av, bv);
        return desc ? -r : r;
      };
      return function (a, b) {
        for (var i = 0; i < criteria.length; i++) {
          if (criteria[i].key === 'recent') continue;
          var r = cmpOne(a, b, criteria[i].key, criteria[i].desc);
          if (r) return r;
        }
        var t = texto(a.label || '', b.label || '');
        if (t) return t;
        t = texto(a.artist || '', b.artist || '');
        if (t) return t;
        /* Aqui, e so aqui, entra a preferencia: dois itens que empataram em
           titulo e artista sao a mesma obra em edicoes diferentes. Colocar isso
           antes do desempate por titulo faria a preferencia reordenar a
           biblioteca inteira -- isso e ordenar por origem, que e outra escolha
           e tem chave propria. */
        if (prefer !== 'none') {
          var e = LmsFmt.compareEditions(self.metaFor(a.id), self.metaFor(b.id), prefer);
          if (e) return e;
        }
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      };
    },
    matchesValue: function (meta, facet, value) {
      if (facet === 'format') return !!meta.formats[value];
      if (facet === 'quality') {
        if (value === 'hires' || value === 'standard') return !!meta[value];
        var formats = Object.keys(meta.formats);
        var hasLossless = formats.some(function (f) { return LmsFmt.isLossless(f); });
        var hasLossy = formats.some(function (f) { return !LmsFmt.isLossless(f); });
        return value === 'lossless' ? hasLossless : hasLossy;
      }
      if (facet === 'origin') return !!meta[value];
      if (facet === 'stream') return !!meta.providers[value];
      return true;
    },
    /* Dentro de uma faceta os valores somam; entre facetas eles restringem.
       "FLAC ou ALAC" e uma escolha dentro do cartao Formato; pedir Hi-Res junto
       e um segundo cartao, e os dois precisam valer. A UI nunca diz AND nem OR. */
    mediaMatches: function (albumId) {
      /* So as facetas que vivem no indice de midia entram aqui. Genero e
         resolvido pelo servidor e ano vive na propria linha; se as tres
         passassem por este caminho, filtrar por genero sem indice carregado
         reprovaria a biblioteca inteira no `if (!meta)` abaixo. */
      var mediaKeys = this.ui.filters.filter(function (key) {
        return /^(format|quality|origin|stream):/.test(key);
      });
      if (!this.allowsMediaFilter || !mediaKeys.length) return true;
      var meta = this.mediaIndex && this.mediaIndex[String(albumId)];
      /* Sem entrada no indice o album nao casa -- mas isso passa a ser CONTADO
         e dito na tela. Some em silencio foi o bug B. */
      if (!meta) { this.unknownCount++; return false; }
      var groups = Object.create(null);
      mediaKeys.forEach(function (key) {
        var at = key.indexOf(':');
        var facet = key.slice(0, at);
        (groups[facet] = groups[facet] || []).push(key.slice(at + 1));
      });
      var self = this;
      return Object.keys(groups).every(function (facet) {
        return groups[facet].some(function (value) {
          return self.matchesValue(meta, facet, value);
        });
      });
    },
    filterLabel: function (key) {
      var labels = {
        'quality:hires': 'Hi-Res', 'quality:standard': 'Resolução padrão',
        'quality:lossless': 'Sem perdas', 'quality:lossy': 'Com perdas',
        'origin:local': 'Biblioteca local', 'origin:remote': 'Remoto / streaming',
        'stream:qobuz': 'Qobuz', 'stream:youtube': 'YouTube'
      };
      if (labels[key]) return this.tr(labels[key]);
      var facet = LmsUi.filterFacet(key);
      var raw = String(key || '').slice(String(key || '').indexOf(':') + 1);
      /* O ano e um intervalo, e um intervalo de um ano so se le melhor como o
         proprio ano: "1975", nao "1975-1975". */
      if (facet === 'year') {
        var parts = raw.split('-');
        return parts[0] === parts[1] ? parts[0] : parts[0] + '–' + parts[1];
      }
      if (facet === 'genre') return LmsUi.genreName(raw) || this.tr('Gênero') + ' ' + raw;
      var format = String(key || '').split(':')[1] || '';
      var found = this.MEDIA_FORMATS.filter(function (item) { return item.key === format; })[0];
      return found ? found.label : format.toUpperCase();
    },
    /* Mantido para a tela vazia, que fala de um filtro so quando ha um so. */
    mediaDescriptor: function () {
      if (!this.hasMediaFilter) return '';
      return this.activeFilters.map(function (f) { return f.label; }).join(' · ');
    },
    loadPagedRoot: async function (pid, token) {
      var pageSize = 500;
      var keepGoing = true;
      var mainArtistIndex = this.groupsMainArtists
        ? await this.loadArtistIndex(pid, token) : null;
      /* Contador dos albuns que o indice de artistas nao soube atribuir. Sem
         ele, a perda continuaria invisivel mesmo com a linha sendo mostrada. */
      var unattributed = 0;
      if (token !== this.requestToken || (this.groupsMainArtists && !mainArtistIndex)) return;
      if (this.needsMediaIndex) {
        await this.loadMediaIndex(pid, token);
        if (token !== this.requestToken) return;
      }
      /* Genero e a unica faceta que o servidor sabe aplicar, e ele aceita um
         genero por consulta. Varios generos viram varias passadas cujo
         resultado se soma -- o mesmo OU que vale dentro de qualquer faceta.
         appendRows ja deduplica pela chave, entao album em dois generos entra
         uma vez so. */
      var genreIds = this.filterValues('genre');
      var passes = genreIds.length ? genreIds : [null];
      for (var p = 0; p < passes.length; p++) {
      var genreId = passes[p];
      var start = 0;
      keepGoing = true;
      while (keepGoing && start < 10000) {
        var page;
        if (this.groupsAlbumsByRelatedArtist) {
          page = await LmsApi.artists(pid, start, pageSize);
        } else {
          page = await LmsApi.albums(pid, start, pageSize,
            genreId == null ? null : { genreId: genreId });
        }
        if (token !== this.requestToken) return;
        var sourceCount = page.sourceCount == null ? page.length : page.sourceCount;
        var relatedArtistRows = this.groupsAlbumsByRelatedArtist;
        var rows = relatedArtistRows ? page.map(function (x) {
          return {
            key: 'ar' + x.id, kind: 'artist', id: x.id, ids: x.ids,
            label: x.name, art: null
          };
        }) : this.groupsMainArtists ? page.filter(function (x) {
          /* Filtrar antes de mapear para artista. Sem isto, agrupar por artista
             com um filtro ligado mostrava a pilula "FLAC" acesa sobre uma lista
             que ninguem tinha filtrado -- a promessa vazia do bug C, de volta
             pela porta que a separacao dos estados abriu. */
          return this.albumPasses(x);
        }, this).map(function (x) {
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
          return this.albumPasses(x);
        }, this).map(function (x) {
          return {
            key: 'al' + x.id, kind: 'album', id: x.id, label: x.title,
            /* O descritor do filtro saiu daqui: com filtros combinados ele
               repetia a fileira de pilulas inteira em cada uma das centenas de
               linhas. A fileira e permanente e diz a mesma coisa uma vez. */
            sub: [x.artist, x.year || null].filter(Boolean).join(' • '),
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
	      this.unknownCount = 0;
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
          if (this.needsMediaIndex) {
            await this.loadMediaIndex(pid, token);
            if (token !== this.requestToken) return;
          }
	          /* Mesma regra de Albuns: cada genero e uma consulta, e as consultas
	             se somam. Sem isto, filtrar Recentes por genero mostraria a
	             pilula acesa sobre a lista inteira. */
	          var recentGenres = this.filterValues('genre');
	          var al;
	          if (recentGenres.length) {
	            var batches = await Promise.all(recentGenres.map(function (id) {
	              return LmsApi.albums(pid, 0, 250, { sort: 'new', genreId: id });
	            }));
	            if (token !== this.requestToken) return;
	            var seenAlbum = Object.create(null);
	            al = [];
	            batches.forEach(function (batch) {
	              batch.forEach(function (album) {
	                if (seenAlbum[album.id]) return;
	                seenAlbum[album.id] = true;
	                al.push(album);
	              });
	            });
	          } else {
	            al = await LmsApi.albums(pid, 0, 250, { sort: 'new' });
	          }
	          if (token !== this.requestToken) return;
	          var recentSourceCount = al.sourceCount == null ? al.length : al.sourceCount;
          this.rows = al.filter(function (x) {
            return this.albumPasses(x);
          }, this).map(function (x) {
            return {
              key: 'al' + x.id, kind: 'album', id: x.id, label: x.title,
              sub: [x.artist, x.year || null].filter(Boolean).join(' • '),
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
    window.addEventListener('resize', this.onToolsResize);
    document.addEventListener('pointerdown', this.closeSplitMenu);
    this.onToolsResize();
  },
  beforeDestroy: function () {
    window.removeEventListener('resize', this.onSplitWindowResize);
    window.removeEventListener('resize', this.onToolsResize);
    document.removeEventListener('pointerdown', this.closeSplitMenu);
    document.body.classList.remove('resizing-split');
  }
});
