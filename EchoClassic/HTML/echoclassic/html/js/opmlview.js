
var OPML_PAGE_SIZE = 100;
var opmlSnapshots = {};

/* One component for Radio and Favorites, because in LMS they are the same thing:
   an OPML tree where each item carries the command for its own children. Item
   kinds behave differently — `menu` descends, `audio` plays, `search` asks for
   text, `text` is a label with no action. */
Vue.component('lms-opml', {
  props: {
    root: { type: String, required: true },   // 'radio' | 'favorites' | 'apps'
    tab: { type: String, required: true }     // which nav stack to use
  },
  template: `
<div ref="scroller" class="scroller">
  <div v-if="loading" class="empty"><div class="p">Loading…</div></div>
  <div v-else-if="error" class="empty">
    <div class="h">Could not open</div><div class="p">{{ error }}</div>
    <button class="retry-command" @click="load">Try again</button>
  </div>
  <div v-else-if="invalidContent" class="empty">
    <div class="h">Could not load favourites</div>
    <div class="p">The server returned items that cannot be opened.</div>
    <button class="retry-command" @click="load">Try again</button>
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
          <span v-if="it.image" class="opml-item-icon" :style="iconStyle(it)"></span>
          <svg v-else-if="it.kind === 'audio' || it.kind === 'action'" viewBox="0 0 24 24"><circle cx="12" cy="13" r="2.4"/><path d="M7.5 8.5a6 6 0 000 9M16.5 8.5a6 6 0 010 9"/></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M3 7.5h6l2 2.2h10V19a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19z"/></svg>
        </div>
        <div class="ell">
          <div class="t ell">{{ it.title }}</div>
          <div v-if="it.subtitle" class="s ell">{{ it.subtitle }}</div>
        </div>
        <svg v-if="it.kind === 'menu' && it.node" class="ic chev" style="width:9px;height:15px" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
      </div>
      <div v-if="root === 'favorites' && it.kind !== 'text' && it.kind !== 'search'" :key="'manage-' + i" class="favourite-row-tools">
        <button type="button" @click="renameFavourite(it)">Rename</button>
        <button type="button" :disabled="i === 0" @click="moveFavourite(it, i - 1)">Move up</button>
        <button type="button" :disabled="i === items.length - 1" @click="moveFavourite(it, i + 1)">Move down</button>
        <button type="button" class="destructive" @click="deleteFavourite(it)">Remove</button>
      </div>

      <div v-if="it.kind === 'search' && fieldErrorIndex === i" :key="'e' + i"
           class="opsearch-error" role="alert">{{ fieldError }}</div>
    </template>
  </template>
  <div v-else class="empty">
    <div class="h">{{ emptyTitle }}</div>
    <div class="p">{{ emptyMessage }}</div>
    <button v-if="root === 'favorites' && !frame" type="button" class="retry-command" @click="openMusic">
      Open My Music
    </button>
  </div>
  <div v-if="showPageStatus" ref="pageStatus" class="opml-page-status" role="status"
       aria-live="polite" tabindex="-1">{{ pageStatus }}</div>
  <div v-if="hasMore || loadingMore || pageError" class="opml-page-zone">
    <span class="opml-new-label">{{ tr('New') }}</span>
    <div v-if="pageError" class="opml-page-error" role="alert">
      <strong>{{ tr('Could not load more items') }}</strong>
      <span>{{ pageError }}</span>
      <span>{{ tr('The items already loaded are still available.') }}</span>
    </div>
    <button class="opml-page-command" type="button" :disabled="loadingMore"
            @click="loadMore">
      {{ loadingMore ? tr('Loading next 100…') : tr(pageError ? 'Try again' : 'Load next 100') }}
    </button>
  </div>
  <div v-else-if="endReached && items.length" class="opml-page-end" role="status">
    {{ endMessage }}
  </div>
</div>`,
  data: function () {
    return { items: [], terms: {}, loading: true, error: '',
             fieldError: '', fieldErrorIndex: null, hasMore: false,
             loadingMore: false, pageError: '', pageStatus: '',
             showPageStatus: false, endReached: false, noProgress: false,
             nextStart: 0, requestToken: 0, activeKey: '' };
  },
  computed: {
    frame: function () { return LmsNav.top(this.tab); },
    playerId: function () { return LmsStore.state.playerId || ''; },
    rootLabel: function () {
      if (this.root === 'radio') return 'Radio';
      if (this.root === 'apps') return 'Apps';
      return 'Favourites';
    },
    /* O LMS devolve um placeholder do tipo `text` no lugar de uma lista vazia.
       Com items.length === 1 o ramo vazio nunca rodava e a tela mostrava o
       "Empty" cru do servidor. Uma lista so de rotulos e uma lista vazia. */
    hasContent: function () {
      return this.items.some(function (it) {
        if (it.kind === 'search') return true;
        if (it.kind === 'menu') return !!it.node;
        if (it.kind === 'audio' || it.kind === 'action') return !!it.playNode;
        return false;
      });
    },
    invalidContent: function () {
      if (this.root !== 'favorites' || !this.items.length || this.hasContent) return false;
      return this.items.some(function (it) { return it.kind !== 'text'; });
    },
    searchTerm: function () {
      var f = this.frame;
      return f && f.term ? String(f.term) : '';
    },
    emptyTitle: function () {
      if (this.searchTerm) return 'No results';
      return this.frame ? this.frame.label : this.rootLabel;
    },
    emptyMessage: function () {
      /* Uma busca sem resultado nao e um servico ausente: mandar "ative um
         serviço de rádio" com o TuneIn funcionando e conselho errado. */
      if (this.searchTerm) {
        return 'The search for “' + this.searchTerm + '” found nothing. ' +
          'Check the spelling or try a shorter term.';
      }
      if (this.frame) return 'This list has no items right now.';
      if (this.root === 'radio') {
        return 'No radio source is available. Enable a radio service in the advanced LMS settings.';
      }
      /* O estado vazio de Apps tem de apontar para onde a solucao esta: os
         servicos aparecem aqui porque sao plugins do servidor, e quem nunca
         instalou none nao tem como adivinhar isso. */
      if (this.root === 'apps') {
        return 'No service is installed. Install a service plugin, such as Qobuz, in Server Settings > Plugins.';
      }
      return 'You have not added any favourites yet. Use “Add to Favourites” in the menu of a track or station.';
    },
    endMessage: function () {
      if (this.noProgress) {
        return this.tr('No new items were returned. The items already loaded are still available.');
      }
      if (this.items.length === 1) return this.tr('All 1 item loaded.');
      return this.tr('All {count} items loaded.').replace('{count}', String(this.items.length));
    }
  },
  watch: {
    frame: function () { return this.load(); },
    playerId: function () { return this.load(); }
  },
  methods: {
    refreshFavourites: function () { opmlSnapshots = {}; return this.load(); },
    renameFavourite: async function (item) {
      var name = window.prompt('Favourite name', item.title || '');
      if (!name || !name.trim()) return;
      try { await LmsApi.favoriteRename(item.itemId, name.trim()); await this.refreshFavourites(); }
      catch (e) { LmsUi.notify('Could not rename the favourite. ' + e.message, 'error', 6500); }
    },
    moveFavourite: async function (item, toIndex) {
      try { await LmsApi.favoriteMove(item.itemId, toIndex); await this.refreshFavourites(); }
      catch (e) { LmsUi.notify('Could not move the favourite. ' + e.message, 'error', 6500); }
    },
    deleteFavourite: async function (item) {
      if (window.confirm && !window.confirm('Remove “' + item.title + '” from favourites?')) return;
      try { await LmsApi.favoriteRemove(item.itemId); await this.refreshFavourites(); }
      catch (e) { LmsUi.notify('Could not remove the favourite. ' + e.message, 'error', 6500); }
    },
    node: function () {
      var f = this.frame;
      return f && f.node ? f.node : LmsApi.opmlRoot(this.root);
    },
    stateKey: function () {
      var f = this.frame;
      var node = this.node();
      return [this.tab, this.playerId,
        JSON.stringify(node || {}), f && f.term ? f.term : ''].join('|');
    },
    saveSnapshot: function () {
      if (!this.activeKey || this.loading) return;
      opmlSnapshots[this.activeKey] = {
        items: this.items.slice(), terms: Object.assign({}, this.terms),
        hasMore: this.hasMore, endReached: this.endReached,
        noProgress: this.noProgress, nextStart: this.nextStart,
        scroll: this.$refs.scroller ? this.$refs.scroller.scrollTop : 0
      };
    },
    restoreSnapshot: function (key) {
      var saved = opmlSnapshots[key];
      if (!saved) return false;
      this.items = saved.items.slice();
      this.terms = Object.assign({}, saved.terms);
      this.hasMore = saved.hasMore;
      this.endReached = saved.endReached;
      this.noProgress = saved.noProgress;
      this.nextStart = saved.nextStart;
      this.loading = false;
      var self = this;
      this.$nextTick(function () {
        if (self.$refs.scroller) self.$refs.scroller.scrollTop = saved.scroll || 0;
      });
      return true;
    },
    isTuneUrl: function (it) {
      return /\burl\b/i.test((it && it.title) || '');
    },
    searchPlaceholder: function (it) {
      return this.isTuneUrl(it) ? 'https://server/stream' : it.title;
    },
    searchTitle: function (it) {
      return this.isTuneUrl(it)
        ? 'Enter the full stream address, including http:// or https://'
        : this.tr('Search in') + ' ' + it.title;
    },
    searchAction: function (it) {
      return this.isTuneUrl(it) ? this.tr('Tune') : this.tr('Search');
    },
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    /* ERR-01: a tela de Apps mostrava
       `[network] qobuz items 0 200 menu:qobuz: Failed to fetch` -- o comando
       RPC, a paginacao e o texto do fetch, tudo cru. Nada ali diz a uma pessoa
       o que fazer. friendlyError ja traduz a familia da falha e deixa a string
       do protocolo no console; o que faltava era a acao humana no fim. */
    serviceError: function (e, fallback) {
      return this.tr(LmsStore.friendlyError(e, fallback)) + ' ' +
        this.tr('Check the connection or the service status and try again.');
    },
    openMusic: function () {
      LmsUi.setTab('music');
      LmsUi.setMusicView('albums');
      LmsNav.reset('music');
    },
    /* api.js devolve 'menu' como default para tudo que nao seja audio/search/
       text, inclusive itens sem actions.go — e ai opmlChildNode() e null. Sem
       esta checagem o item ganhava role="button" e chevron e nao fazia nada. */
    actionable: function (it) {
      if (it.kind === 'menu') return !!it.node;
      if (it.kind === 'audio' || it.kind === 'action') return !!it.playNode;
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
        this.saveSnapshot();
        LmsNav.push(this.tab, { kind: 'opml', label: it.title, node: it.node });
        return;
      }
      if (it.kind === 'audio' || it.kind === 'action') this.play(it);
    },
    iconStyle: function (it) {
      var value = String(it.image || '');
      if (!value || /["'()\\]/.test(value)) return {};
      if (!/^(?:https?:|\/)/i.test(value)) value = '/' + value.replace(/^\/+/, '');
      return { backgroundImage: 'url("' + value + '")' };
    },
    play: async function (it) {
      try {
        await LmsApi.opmlPlay(LmsStore.state.playerId || '', it.playNode);
        await LmsStore.refresh();
      } catch (e) {
        /* Falhar ao tocar UMA estacao nao pode apagar a lista inteira: isso e
           recado de notificacao, nao erro fatal de carregamento. */
        LmsUi.notify(this.tr('Could not play “') + (it.title || this.tr('this station')) +
          '”. ' + this.serviceError(e, 'The station did not answer.'),
          'error', 6500);
      }
    },
    search: async function (it, i) {
      var term = (this.terms[i] || '').trim();
      if (!term) {
        this.setFieldError(i, 'Type something to search for.');
        return;
      }
      if (this.isTuneUrl(it) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(term)) {
        this.setFieldError(i, 'Enter a full address starting with http:// or https://.');
        return;
      }
      this.clearFieldError(i);
      this.saveSnapshot();
      this.loading = true;
      try {
        var hits = await LmsApi.opmlSearch(LmsStore.state.playerId || '',
                                           it.node || this.node(), term, 0, OPML_PAGE_SIZE);
        LmsNav.push(this.tab, {
          kind: 'opml', label: this.tr('Results:') + ' ' + term, term: term,
          node: it.node || this.node(), preloaded: hits
        });
      } catch (e) {
        /* A lista atual continua valida; o problema foi desta consulta. */
        this.setFieldError(i, this.serviceError(e, 'The search did not complete.'));
      }
      this.loading = false;
    },
    load: async function () {
      var f = this.frame;
      var key = this.stateKey();
      var token = ++this.requestToken;
      var playerId = LmsStore.state.playerId || '';
      this.activeKey = key;
      this.fieldError = '';
      this.fieldErrorIndex = null;
      this.pageError = '';
      this.pageStatus = '';
      this.showPageStatus = false;
      this.endReached = false;
      this.noProgress = false;
      if (this.restoreSnapshot(key)) return;
      if (f && f.preloaded) {
        this.items = f.preloaded;
        this.nextStart = f.preloaded.length;
        this.hasMore = f.preloaded.length >= OPML_PAGE_SIZE;
        this.endReached = !this.hasMore;
        this.loading = false;
        return;
      }
      this.loading = true;
      this.error = '';
      try {
        var first = await LmsApi.opmlBrowse(playerId, this.node(), 0, OPML_PAGE_SIZE);
        if (token !== this.requestToken || key !== this.activeKey ||
            playerId !== (LmsStore.state.playerId || '')) return;
        this.items = first;
        this.nextStart = first.length;
        this.hasMore = first.length >= OPML_PAGE_SIZE;
        this.endReached = !this.hasMore;
      } catch (e) {
        if (token !== this.requestToken || key !== this.activeKey) return;
        this.error = this.serviceError(e, 'This service did not answer.');
        this.items = [];
      }
      this.loading = false;
    },
    pageItemUsable: function (it) {
      return it && (it.kind === 'text' || it.kind === 'search' || this.actionable(it));
    },
    loadMore: async function () {
      if (this.loadingMore || (!this.hasMore && !this.pageError)) return;
      var token = ++this.requestToken;
      var key = this.activeKey;
      var playerId = LmsStore.state.playerId || '';
      var start = this.nextStart;
      var f = this.frame;
      this.loadingMore = true;
      this.pageError = '';
      this.showPageStatus = false;
      try {
        var page = f && f.term
          ? await LmsApi.opmlSearch(playerId, this.node(), f.term, start, OPML_PAGE_SIZE)
          : await LmsApi.opmlBrowse(playerId, this.node(), start, OPML_PAGE_SIZE);
        if (token !== this.requestToken || key !== this.activeKey ||
            playerId !== (LmsStore.state.playerId || '')) return;
        this.nextStart += page.length;
        var seen = {};
        this.items.forEach(function (it) { if (it.identity) seen[it.identity] = true; });
        var added = [];
        var self = this;
        page.forEach(function (it) {
          if (!self.pageItemUsable(it)) return;
          if (it.identity && seen[it.identity]) return;
          if (it.identity) seen[it.identity] = true;
          added.push(it);
        });
        if (added.length) this.items = this.items.concat(added);
        this.hasMore = page.length >= OPML_PAGE_SIZE && added.length > 0;
        this.endReached = !this.hasMore;
        this.noProgress = page.length >= OPML_PAGE_SIZE && !added.length;
        this.pageStatus = added.length === 1
          ? this.tr('Loaded one more item. {total} items loaded.')
              .replace('{total}', String(this.items.length))
          : this.tr('Loaded {count} more items. {total} items loaded.')
              .replace('{count}', String(added.length)).replace('{total}', String(this.items.length));
        this.showPageStatus = added.length > 0;
        this.saveSnapshot();
        if (this.showPageStatus) {
          this.$nextTick(function () {
            if (self.$refs.pageStatus) self.$refs.pageStatus.focus();
          });
        }
      } catch (e) {
        if (token !== this.requestToken || key !== this.activeKey) return;
        this.pageError = this.serviceError(e, 'Could not load more items');
        this.hasMore = true;
      } finally {
        if (token === this.requestToken) this.loadingMore = false;
      }
    }
  },
  created: function () { this.load(); },
  beforeDestroy: function () {
    this.saveSnapshot();
    this.requestToken++;
  }
});
