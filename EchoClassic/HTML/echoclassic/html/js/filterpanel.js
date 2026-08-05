
/* Painel de filtros, ordenacao, agrupamento e preferencia de reproducao.

   Um controle so para quatro conceitos foi o defeito que a 3.2.0 comecou a
   desfazer: o <select> da barra decidia filtro, agrupamento e ordem ao mesmo
   tempo, e por isso nunca foi possivel combinar dois filtros pela tela. Aqui
   cada conceito tem sua secao, com o rotulo dizendo o que ele faz -- filtrar
   exclui, agrupar organiza, preferir escolhe o que toca.

   O painel trabalha em RASCUNHO. Cada troca de filtro recarrega a biblioteca
   (segundos), e o usuario costuma montar a pergunta em varios cliques; aplicar
   a cada clique cobraria o preco inteiro por clique. "Apply" entrega tudo de
   uma vez, "Cancel" descarta. Fora do painel -- na fileira de pilulas -- a
   remocao continua imediata, porque ali a acao ja e uma so.

   Tres formas, escolhidas pela largura disponivel e nao por nome de aparelho,
   nos mesmos pontos de quebra que o CSS da skin ja usa (700 e 900):
     ate 700   folha de tela cheia, uma coluna
     701-899   gaveta ancorada na borda
     900+      painel suspenso sobre a lista, ~metade da area util */
(function () {
  'use strict';

  var MEDIA_FORMATS = [
    { key: 'flac', label: 'FLAC' }, { key: 'alac', label: 'ALAC' },
    { key: 'wav', label: 'WAV' }, { key: 'aiff', label: 'AIFF' },
    { key: 'ape', label: 'APE' }, { key: 'wavpack', label: 'WavPack' },
    { key: 'dsd', label: 'DSD' }, { key: 'mp3', label: 'MP3' },
    { key: 'aac', label: 'AAC' }, { key: 'ogg', label: 'Ogg Vorbis' },
    { key: 'opus', label: 'Opus' }
  ];

  Vue.component('lms-filter-panel', {
    template: `
<div v-if="ui.filterPanel" class="filter-stage" :class="'filter-' + mode">
  <div class="filter-back" @click="cancel"></div>
  <section ref="panel" class="filter-panel" :class="'filter-' + mode" :style="panelStyle"
           role="dialog" aria-modal="true" aria-labelledby="filter-panel-title" tabindex="-1"
           @keydown.esc.stop.prevent="cancel" @keydown.tab="trapFocus">
    <header class="filter-head">
      <button ref="first" class="back-command" @click="cancel">
        <span v-if="mode === 'small'" aria-hidden="true">‹ </span>Cancel
      </button>
      <h2 id="filter-panel-title" class="ttl">Filters</h2>
      <button class="back-command filter-apply" @click="apply">Apply</button>
    </header>

    <div class="filter-body scroller">
      <label class="filter-search">
        <span class="visually-hidden">Search within filters</span>
        <input v-model="needle" type="search" placeholder="Search within filters">
      </label>

      <p v-if="!allowsFilters" class="filter-note">
        This root cannot filter by media. Source, format, resolution, genre and year filters apply in Albums and in Recently added.
      </p>

      <fieldset v-if="allowsFilters && show('Source')" class="filter-group">
        <legend>Source</legend>
        <button v-for="o in sourceOptions" :key="o.key" type="button" class="filter-option"
                :class="{on: has(o.key)}" :aria-pressed="String(has(o.key))"
                @click="toggle(o.key)">{{ o.label }}</button>
      </fieldset>

      <fieldset v-if="allowsFilters && show('Genre')" class="filter-group">
        <legend>Genre</legend>
        <div v-if="genresLoading" class="filter-note">Loading genres…</div>
        <button v-for="g in visibleGenres" :key="g.id" type="button" class="filter-option"
                :class="{on: has('genre:' + g.id)}" :aria-pressed="String(has('genre:' + g.id))"
                @click="toggle('genre:' + g.id)">{{ g.name }}</button>
        <div v-if="genreOverflow" class="filter-note">
          The genre list is long. Use the search above to find the rest.
        </div>
      </fieldset>

      <fieldset v-if="allowsFilters && show('Format')" class="filter-group">
        <legend>Format</legend>
        <button v-for="f in visibleFormats" :key="f.key" type="button" class="filter-option"
                :class="{on: has('format:' + f.key)}" :aria-pressed="String(has('format:' + f.key))"
                @click="toggle('format:' + f.key)">{{ f.label }}</button>
      </fieldset>

      <fieldset v-if="allowsFilters && show('Year')" class="filter-group filter-years">
        <legend>Year</legend>
        <label class="filter-year">
          <span>From</span>
          <input v-model="yearFrom" type="number" inputmode="numeric" min="1000" max="2999"
                 aria-label="Start year" @change="commitYears">
        </label>
        <label class="filter-year">
          <span>To</span>
          <input v-model="yearTo" type="number" inputmode="numeric" min="1000" max="2999"
                 aria-label="End year" @change="commitYears">
        </label>
        <button v-if="yearFrom || yearTo" type="button" class="filter-chip-clear"
                @click="clearYears">Clear year</button>
        <p v-if="yearError" class="filter-note">{{ yearError }}</p>
      </fieldset>

      <details v-if="allowsFilters && show('Qualidade')" class="filter-advanced">
        <summary>Audio quality</summary>
        <fieldset class="filter-group">
          <legend class="visually-hidden">Audio quality</legend>
          <button v-for="q in qualityOptions" :key="q.key" type="button" class="filter-option"
                  :class="{on: has(q.key)}" :aria-pressed="String(has(q.key))"
                  @click="toggle(q.key)">{{ q.label }}</button>
        </fieldset>
        <p class="filter-note">
          High resolution is not proof of better mastering. These filters describe what the file is, not how good it sounds.
        </p>
      </details>

      <fieldset v-if="show('Sort')" class="filter-group">
        <legend>Sort by</legend>
        <button v-for="s in sortOptions" :key="s.key" type="button" class="filter-option"
                :class="{on: draft.sort[0] && draft.sort[0].key === s.key}"
                :aria-pressed="String(!!draft.sort[0] && draft.sort[0].key === s.key)"
                @click="chooseSort(s.key)">{{ s.label }}</button>
        <button type="button" class="filter-option" :aria-pressed="String(sortDesc)"
                :class="{on: sortDesc}" @click="toggleDir">
          {{ sortDesc ? 'Descending order (Z–A)' : 'Ascending order (A–Z)' }}
        </button>
      </fieldset>

      <fieldset v-if="show('Agrupar')" class="filter-group">
        <legend>Group by</legend>
        <button v-for="g in groupOptions" :key="g.value" type="button" class="filter-option"
                :class="{on: groupChoice === g.value}" :aria-pressed="String(groupChoice === g.value)"
                @click="chooseGroup(g.value)">{{ g.label }}</button>
        <p class="filter-note">
          Grouping organises the list and never removes anything from it. An album with more than one format appears in each section it belongs to.
        </p>
      </fieldset>

      <fieldset v-if="show('Preferência')" class="filter-group">
        <legend>Playback preference</legend>
        <button v-for="p in preferOptions" :key="p.key" type="button" class="filter-option"
                :class="{on: draft.prefer === p.key}" :aria-pressed="String(draft.prefer === p.key)"
                @click="draft.prefer = p.key">{{ p.label }}</button>
        <p class="filter-note">
          The preference ranks equivalent editions and picks which one plays. It never hides the others: they stay in the list.
        </p>
      </fieldset>

      <fieldset v-if="show('Saved views')" class="filter-group filter-views">
        <legend>Saved views</legend>
        <div v-for="v in ui.views" :key="v.id" class="filter-view-row">
          <button type="button" class="filter-option filter-view-name"
                  :class="{on: ui.defaultView === v.id}" @click="loadView(v)">
            {{ v.name }}<span v-if="ui.defaultView === v.id" class="filter-view-tag"> · padrão</span>
          </button>
          <button type="button" class="filter-chip-clear"
                  :aria-label="'Definir ' + v.name + ' como padrão'"
                  @click="LmsUi.setDefaultView(v.id)">Default</button>
          <button type="button" class="filter-chip-clear" :aria-label="'Rename' + v.name"
                  @click="rename(v)">Rename</button>
          <button type="button" class="filter-chip-clear" :aria-label="'Duplicate' + v.name"
                  @click="LmsUi.duplicateView(v.id)">Duplicate</button>
          <button type="button" class="filter-chip-clear destructive"
                  :aria-label="'Delete' + v.name" @click="LmsUi.deleteView(v.id)">Delete</button>
        </div>
        <div v-if="!ui.views.length" class="filter-note">No saved views yet.</div>
        <label class="filter-search">
          <span class="visually-hidden">View name</span>
          <input v-model="viewName" type="text" placeholder="View name" @keydown.enter="saveView">
        </label>
        <button type="button" class="filter-option" :disabled="!viewName.trim()"
                @click="saveView">Save view</button>
      </fieldset>
    </div>

    <footer class="filter-actions">
      <button type="button" class="filter-chip-clear" @click="clearAll">Clear all</button>
      <span class="filter-actions-spacer"></span>
      <button ref="last" type="button" class="filter-option filter-apply-main"
              @click="apply">Apply</button>
    </footer>
  </section>
</div>`,
    data: function () {
      return {
        ui: LmsUi.state, LmsUi: LmsUi,
        draft: LmsUi.currentDraft(),
        needle: '', viewName: '',
        yearFrom: '', yearTo: '', yearError: '',
        genres: [], genresLoading: false,
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
        previousFocus: null
      };
    },
    computed: {
      /* Largura real da janela, com os mesmos pontos de quebra do CSS: a mesma
         tela vira estreita quando o usuario divide a janela, aumenta o zoom ou
         sobe o corpo de letra. Nada aqui pergunta o nome do aparelho. */
      mode: function () {
        if (this.width <= 700) return 'small';
        return this.width < 900 ? 'medium' : 'large';
      },
      panelStyle: function () {
        if (this.mode !== 'large') return {};
        /* 45-55% da area util, com teto para nao virar uma coluna de texto
           larga demais em monitor grande, e chao para nao espremer os rotulos. */
        var width = Math.max(420, Math.min(720, Math.round(this.width * 0.5)));
        return { width: width + 'px', maxHeight: Math.round(this.height * 0.8) + 'px' };
      },
      allowsFilters: function () { return LmsUi.allowsMediaFilter(this.ui.musicView); },
      sourceOptions: function () {
        return [
          { key: 'origin:local', label: this.tr('Local library') },
          { key: 'origin:remote', label: this.tr('Remote / streaming') },
          { key: 'stream:qobuz', label: 'Qobuz' },
          { key: 'stream:youtube', label: 'YouTube' }
        ];
      },
      qualityOptions: function () {
        return [
          { key: 'quality:lossless', label: this.tr('Lossless') },
          { key: 'quality:lossy', label: this.tr('Lossy') },
          { key: 'quality:standard', label: this.tr('Standard resolution') },
          { key: 'quality:hires', label: this.tr('Hi-Res') }
        ];
      },
      sortOptions: function () {
        var view = this.ui.musicView;
        var all = [
          { key: 'recent', label: this.tr('Recently added') },
          { key: 'name', label: view === 'anos' ? this.tr('Year') : this.tr('Name') },
          { key: 'artist', label: this.tr('Artist') },
          { key: 'year', label: this.tr('Year') },
          { key: 'format', label: this.tr('Format') },
          { key: 'source', label: this.tr('Local library first') },
          { key: 'quality', label: this.tr('Highest resolution first') }
        ];
        return all.filter(function (option) {
          return LmsUi.validSortKey(view, option.key);
        });
      },
      groupOptions: function () {
        var view = this.ui.musicView;
        var out = [{ value: '', label: this.tr('No grouping') }];
        if (LmsUi.validGroup(view, 'artist')) {
          out.push({ value: 'artist', label: this.tr('Artist (the list switches to artists)') });
          out.push({ value: 'relatedArtist', label: this.tr('Related artist') });
        }
        [['decade', 'Decade'], ['format', 'Format'], ['quality', 'Resolution'],
         ['origin', 'Source'], ['stream', 'Streaming service']].forEach(function (pair) {
          if (LmsUi.validSection(view, pair[0])) {
            out.push({ value: 'sec:' + pair[0], label: this.tr(pair[1]) });
          }
        }, this);
        return out;
      },
      preferOptions: function () {
        return [
          { key: 'none', label: this.tr('No preference') },
          { key: 'local', label: this.tr('Prefer local library') },
          { key: 'stream', label: this.tr('Prefer streaming') },
          { key: 'quality', label: this.tr('Prefer highest resolution') }
        ];
      },
      groupChoice: function () {
        if (this.draft.group.length) return this.draft.group[0];
        return this.draft.sections.length ? 'sec:' + this.draft.sections[0] : '';
      },
      sortDesc: function () { return !!(this.draft.sort[0] || {}).desc; },
      visibleFormats: function () {
        var self = this;
        return MEDIA_FORMATS.filter(function (f) { return self.matches(f.label); });
      },
      /* Vistos na tela: 60 generos empurravam Formato, Ano, Ordenar e Agrupar
         para fora do alcance -- em tela estreita, cada um ocupa uma linha
         inteira. Sem busca a secao mostra uma amostra curta; com busca ela
         abre, porque ai o usuario ja disse o que procura. */
      genreLimit: function () { return this.needle ? 60 : 8; },
      matchingGenres: function () {
        var self = this;
        return this.genres.filter(function (g) { return self.matches(g.name); });
      },
      visibleGenres: function () { return this.matchingGenres.slice(0, this.genreLimit); },
      genreOverflow: function () { return this.matchingGenres.length > this.genreLimit; }
    },
    watch: {
      'ui.filterPanel': function (open) {
        if (!open) {
          if (typeof document !== 'undefined' && document.body) {
            document.body.classList.remove('filter-panel-open');
          }
          return;
        }
        this.reset();
        this.loadGenres();
        if (typeof document !== 'undefined') {
          this.previousFocus = document.activeElement;
          if (document.body) document.body.classList.add('filter-panel-open');
        }
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.first && self.$refs.first.focus) self.$refs.first.focus();
        });
      }
    },
    methods: {
      tr: function (text) {
        return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
      },
      matches: function (label) {
        var needle = String(this.needle || '').toLowerCase();
        if (!needle) return true;
        return String(label || '').toLowerCase().indexOf(needle) >= 0;
      },
      /* A busca dentro dos filtros tambem esconde secao inteira quando o nome da
         secao nao casa e nonea opcao dela sobrou. Sem isso, procurar "rock"
         deixaria na tela cinco cabecalhos vazios. */
      show: function (title) {
        if (!this.needle) return true;
        if (this.matches(title)) return true;
        if (title === 'Format') return this.visibleFormats.length > 0;
        if (title === 'Genre') return this.visibleGenres.length > 0;
        return false;
      },
      reset: function () {
        this.draft = LmsUi.currentDraft();
        this.needle = '';
        this.viewName = '';
        this.yearError = '';
        this.syncYearInputs();
      },
      /* Os dois campos de ano sao a face de uma chave so ("year:1971-1977").
         Ler a chave de volta para os campos e o que faz reabrir o painel, ou
         carregar uma vista, mostrar o intervalo que esta valendo. */
      syncYearInputs: function () {
        var range = this.draft.filters.filter(function (key) {
          return LmsUi.filterFacet(key) === 'year';
        })[0];
        var parts = range ? range.slice(range.indexOf(':') + 1).split('-') : ['', ''];
        this.yearFrom = parts[0] || '';
        this.yearTo = parts[1] || '';
      },
      has: function (key) { return this.draft.filters.indexOf(key) >= 0; },
      toggle: function (key) {
        var at = this.draft.filters.indexOf(key);
        if (at >= 0) this.draft.filters.splice(at, 1);
        else this.draft.filters.push(key);
      },
      /* Um ano so preenchido vale como intervalo aberto: "de 1971" e
         1971-agora, "ate 1977" e o comeco da biblioteca ate 1977. Exigir os
         dois campos transformaria a pergunta mais comum em erro. */
      commitYears: function () {
        var from = String(this.yearFrom || '').replace(/\D/g, '');
        var to = String(this.yearTo || '').replace(/\D/g, '');
        this.draft.filters = this.draft.filters.filter(function (key) {
          return LmsUi.filterFacet(key) !== 'year';
        });
        this.yearError = '';
        if (!from && !to) return;
        if (!from) from = '1000';
        if (!to) to = String(new Date().getFullYear());
        if (from.length !== 4 || to.length !== 4) {
          this.yearError = this.tr('Use four-digit years.');
          return;
        }
        if (Number(from) > Number(to)) {
          this.yearError = this.tr('The start year must be lower than or equal to the end year.');
          return;
        }
        this.draft.filters.push('year:' + from + '-' + to);
      },
      clearYears: function () {
        this.yearFrom = '';
        this.yearTo = '';
        this.commitYears();
      },
      chooseSort: function (key) {
        this.draft.sort = [{ key: key, desc: this.sortDesc }];
      },
      toggleDir: function () {
        var current = this.draft.sort[0] || { key: 'name', desc: false };
        this.draft.sort = [{ key: current.key, desc: !current.desc }];
      },
      /* Agrupar por artista troca a natureza da linha; agrupar por decada ou
         formato mantem a linha e acrescenta cabecalho. Sao dois estados
         diferentes justamente porque fazem coisas diferentes -- o menu mostra
         uma escolha so porque, para quem usa, e uma escolha so. */
      chooseGroup: function (value) {
        if (!value) { this.draft.group = []; this.draft.sections = []; return; }
        if (value.indexOf('sec:') === 0) {
          this.draft.group = [];
          this.draft.sections = [value.slice(4)];
          return;
        }
        this.draft.sections = [];
        this.draft.group = [value];
      },
      clearAll: function () {
        this.draft = { view: this.ui.musicView, filters: [], group: [], sections: [],
                       sort: [], prefer: 'none' };
        this.yearFrom = '';
        this.yearTo = '';
        this.yearError = '';
      },
      apply: function () {
        LmsUi.applyDraft(this.draft);
        this.close();
      },
      cancel: function () { this.close(); },
      close: function () {
        /* O gatilho vem primeiro: no macOS o clique nao foca o botao, entao
           document.activeElement na abertura costuma ser o <body> -- e devolver
           o foco para o body e o mesmo que perde-lo. */
        var previous = LmsUi.filterTrigger() || this.previousFocus;
        LmsUi.closeFilterPanel();
        /* O foco volta para o funil que abriu o painel. Sem isto ele cai no
           corpo do documento e a navegacao por teclado recomeca do topo. */
        setTimeout(function () { if (previous && previous.focus) previous.focus(); }, 0);
      },
      saveView: function () {
        var name = String(this.viewName || '').trim();
        if (!name) return;
        LmsUi.applyDraft(this.draft);
        var saved = LmsUi.saveCurrentView(name);
        if (saved) {
          this.viewName = '';
          LmsUi.notify(this.tr('View saved.'), 'success', 2500);
        }
      },
      loadView: function (view) {
        this.draft = {
          view: view.view, filters: view.filters.slice(),
          sort: view.sort.map(function (s) { return { key: s.key, desc: s.desc }; }),
          group: view.group.slice(), sections: view.sections.slice(), prefer: view.prefer
        };
        this.syncYearInputs();
      },
      rename: function (view) {
        var name = typeof prompt === 'function' ? prompt(this.tr('New name'), view.name) : null;
        if (name) LmsUi.renameView(view.id, name);
      },
      loadGenres: async function () {
        if (this.genres.length || this.genresLoading) return;
        this.genresLoading = true;
        try {
          var list = await LmsApi.genres(LmsStore.state.playerId || '', 0, 2000);
          this.genres = list;
          LmsUi.rememberGenres(list);
        } catch (e) {
          this.genres = [];
        }
        this.genresLoading = false;
      },
      trapFocus: function (event) {
        if (!this.$refs.panel) return;
        var nodes = Array.prototype.slice.call(this.$refs.panel.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        )).filter(function (node) { return node.offsetParent !== null; });
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault(); nodes[nodes.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          event.preventDefault(); nodes[0].focus();
        }
      },
      onResize: function () {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
      }
    },
    mounted: function () { window.addEventListener('resize', this.onResize); },
    beforeDestroy: function () {
      window.removeEventListener('resize', this.onResize);
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('filter-panel-open');
      }
    }
  });
})();
