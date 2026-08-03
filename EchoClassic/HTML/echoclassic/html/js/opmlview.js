
/* One component for Radio and Favorites, because in LMS they are the same thing:
   an OPML tree where each item carries the command for its own children. Item
   kinds behave differently — `menu` descends, `audio` plays, `search` asks for
   text, `text` is a label with no action. */
Vue.component('lms-opml', {
  props: {
    root: { type: String, required: true },   // 'radio' | 'favorites'
    tab: { type: String, required: true }     // which nav stack to use
  },
  template: `
<div class="scroller">
  <div v-if="loading" class="empty"><div class="p">Carregando…</div></div>
  <div v-else-if="error" class="empty">
    <div class="h">Não deu para abrir</div><div class="p">{{ error }}</div>
    <button class="retry-command" @click="load">Tentar novamente</button>
  </div>
  <template v-else-if="hasContent">
    <template v-for="(it, i) in items">
      <div v-if="it.kind === 'text'" :key="'t' + i" class="optext">{{ it.title }}</div>

      <div v-else-if="it.kind === 'search'" :key="'s' + i" class="opsearch">
        <svg class="ic" style="width:17px;height:17px" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7.5"/><path d="M16 16l5.5 5.5"/></svg>
        <input v-model="terms[i]" :placeholder="searchPlaceholder(it)"
               :aria-label="searchPlaceholder(it)" :title="searchTitle(it)"
               :aria-invalid="fieldErrorIndex === i ? 'true' : null"
               @input="clearFieldError(i)" @keyup.enter="search(it, i)">
        <button class="opsearch-action pointer" type="button" @click="search(it, i)">
          {{ searchAction(it) }}
        </button>
      </div>

      <div v-else :key="'i' + i" class="row"
           :class="{pointer: actionable(it)}"
           :role="actionable(it) ? 'button' : null" :tabindex="actionable(it) ? 0 : null"
           @click="activate(it)" @keydown.enter.prevent="activate(it)"
           @keydown.space.prevent="activate(it)">
        <div class="favicon">
          <svg v-if="it.kind === 'audio'" viewBox="0 0 24 24"><circle cx="12" cy="13" r="2.4"/><path d="M7.5 8.5a6 6 0 000 9M16.5 8.5a6 6 0 010 9"/></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M3 7.5h6l2 2.2h10V19a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19z"/></svg>
        </div>
        <div class="ell">
          <div class="t ell">{{ it.title }}</div>
          <div v-if="it.subtitle" class="s ell">{{ it.subtitle }}</div>
        </div>
        <svg v-if="it.kind === 'menu' && it.node" class="ic chev" style="width:9px;height:15px" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
      </div>

      <div v-if="it.kind === 'search' && fieldErrorIndex === i" :key="'e' + i"
           class="opsearch-error" role="alert">{{ fieldError }}</div>
    </template>
  </template>
  <div v-else class="empty">
    <div class="h">{{ emptyTitle }}</div>
    <div class="p">{{ emptyMessage }}</div>
    <button v-if="root === 'favorites' && !frame" type="button" class="retry-command" @click="openMusic">
      Abrir Minha Música
    </button>
  </div>
</div>`,
  data: function () {
    return { items: [], terms: {}, loading: true, error: '',
             fieldError: '', fieldErrorIndex: null };
  },
  computed: {
    frame: function () { return LmsNav.top(this.tab); },
    rootLabel: function () { return this.root === 'radio' ? 'Rádio' : 'Favoritos'; },
    /* O LMS devolve um placeholder do tipo `text` no lugar de uma lista vazia.
       Com items.length === 1 o ramo vazio nunca rodava e a tela mostrava o
       "Empty" cru do servidor. Uma lista so de rotulos e uma lista vazia. */
    hasContent: function () {
      return this.items.some(function (it) { return it.kind !== 'text'; });
    },
    searchTerm: function () {
      var f = this.frame;
      return f && f.term ? String(f.term) : '';
    },
    emptyTitle: function () {
      if (this.searchTerm) return 'Nenhum resultado';
      return this.frame ? this.frame.label : this.rootLabel;
    },
    emptyMessage: function () {
      /* Uma busca sem resultado nao e um servico ausente: mandar "ative um
         serviço de rádio" com o TuneIn funcionando e conselho errado. */
      if (this.searchTerm) {
        return 'A busca por “' + this.searchTerm + '” não encontrou nada. ' +
          'Confira a grafia ou tente um termo mais curto.';
      }
      if (this.frame) return 'Esta lista não tem itens no momento.';
      return this.root === 'radio'
        ? 'Nenhuma fonte de rádio está disponível. Ative um serviço de rádio nas configurações avançadas do LMS.'
        : 'Você ainda não adicionou favoritos. Use “Adicionar aos Favoritos” no menu de uma faixa ou estação.';
    }
  },
  watch: {
    frame: function () { this.load(); }
  },
  methods: {
    node: function () {
      var f = this.frame;
      return f && f.node ? f.node : LmsApi.opmlRoot(this.root);
    },
    isTuneUrl: function (it) {
      return /\burl\b/i.test((it && it.title) || '');
    },
    searchPlaceholder: function (it) {
      return this.isTuneUrl(it) ? 'https://servidor/stream' : it.title;
    },
    searchTitle: function (it) {
      return this.isTuneUrl(it)
        ? 'Informe o endereço completo do stream, incluindo http:// ou https://'
        : 'Buscar em ' + it.title;
    },
    searchAction: function (it) {
      return this.isTuneUrl(it) ? 'Sintonizar' : 'Buscar';
    },
    openMusic: function () {
      LmsUi.setTab('musica');
      LmsUi.setMusicView('albuns');
      LmsNav.reset('musica');
    },
    /* api.js devolve 'menu' como default para tudo que nao seja audio/search/
       text, inclusive itens sem actions.go — e ai opmlChildNode() e null. Sem
       esta checagem o item ganhava role="button" e chevron e nao fazia nada. */
    actionable: function (it) {
      if (it.kind === 'menu') return !!it.node;
      if (it.kind === 'audio') return !!it.playNode;
      return false;
    },
    setFieldError: function (i, message) {
      this.fieldErrorIndex = i;
      this.fieldError = message;
    },
    clearFieldError: function (i) {
      if (this.fieldErrorIndex === i) {
        this.fieldErrorIndex = null;
        this.fieldError = '';
      }
    },
    activate: function (it) {
      if (!this.actionable(it)) return;
      if (it.kind === 'menu') {
        LmsNav.push(this.tab, { kind: 'opml', label: it.title, node: it.node });
        return;
      }
      if (it.kind === 'audio') this.play(it);
    },
    play: async function (it) {
      try {
        await LmsApi.opmlPlay(LmsStore.state.playerId || '', it.playNode);
        await LmsStore.refresh();
      } catch (e) {
        /* Falhar ao tocar UMA estacao nao pode apagar a lista inteira: isso e
           recado de notificacao, nao erro fatal de carregamento. */
        LmsUi.notify('Não deu para tocar “' + (it.title || 'esta estação') + '”. ' +
          (e && e.message ? e.message : String(e)), 'error', 6500);
      }
    },
    search: async function (it, i) {
      var term = (this.terms[i] || '').trim();
      if (!term) {
        this.setFieldError(i, 'Digite algo para buscar.');
        return;
      }
      if (this.isTuneUrl(it) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(term)) {
        this.setFieldError(i, 'Informe um endereço completo, começando por http:// ou https://.');
        return;
      }
      this.clearFieldError(i);
      this.loading = true;
      try {
        var hits = await LmsApi.opmlSearch(LmsStore.state.playerId || '',
                                           it.node || this.node(), term, 0, 200);
        LmsNav.push(this.tab, {
          kind: 'opml', label: 'Resultados: ' + term, term: term, preloaded: hits
        });
      } catch (e) {
        /* A lista atual continua valida; o problema foi desta consulta. */
        this.setFieldError(i, e && e.message ? e.message : String(e));
      }
      this.loading = false;
    },
    load: async function () {
      var f = this.frame;
      this.fieldError = '';
      this.fieldErrorIndex = null;
      if (f && f.preloaded) { this.items = f.preloaded; this.loading = false; return; }
      this.loading = true;
      this.error = '';
      try {
        this.items = await LmsApi.opmlBrowse(LmsStore.state.playerId || '', this.node(), 0, 200);
      } catch (e) {
        this.error = e && e.message ? e.message : String(e);
        this.items = [];
      }
      this.loading = false;
    }
  },
  created: function () { this.load(); }
});
