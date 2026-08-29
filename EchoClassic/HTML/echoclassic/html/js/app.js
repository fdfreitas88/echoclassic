
/* Root component and boot sequence. This file owns three things: the vertical
   order of the chrome, which body renders for the current tab, and the order of
   the boot steps. Everything else lives in its own module. */
(function (global) {
  'use strict';

  Vue.component('lms-app', {
    template: `
<div class="app" :class="{'party-mode':ui.partyMode,'kiosk-mode':ui.kioskMode}">
  <header class="app-header">
  <lms-statusbar></lms-statusbar>
  <lms-navbar :title="title" :back="back" :pickable="pickable"
              :segments="segments" :segment="ui.albumMode"
              @back="goBack" @picker="openPicker"
              @segment="LmsUi.setAlbumMode($event)"></lms-navbar>
  </header>

  <!-- Linha real da coluna .app, e nao sobreposicao: fixed no topo, o alerta
       cobria a barra de ferramentas da lista (Filter artists, Filters, Sort,
       Select) e o primeiro item do seletor de raiz. Ver UX-01, mesmo mecanismo
       de EC-003. A posicao aqui, entre o cabecalho e a .workspace, e o que o
       coloca abaixo da navbar: .app-header e display:contents. -->
  <div v-if="store.initialized && !store.connected" class="connection-banner" role="alert">
    <span>{{ connectionMessage }}</span>
    <button :disabled="store.reconnecting" @click="reconnect">
      {{ reconnectLabel }}
    </button>
  </div>

  <aside v-if="ui.partyMode && !ui.kioskMode" class="party-status" aria-label="Party mode status">
    <span class="party-status-icon" aria-hidden="true">♬</span>
    <strong>Party mode</strong>
    <span>Delete and reorder are hidden.</span>
    <button type="button" @click="managePartyMode">Manage</button>
  </aside>

	  <main class="workspace" :class="workspaceClasses">
	    <h1 class="visually-hidden">{{ pageHeading }}</h1>
	    <lms-nowplaying v-if="ui.full" :fullscreen="ui.playerFullscreen"></lms-nowplaying>

    <!-- Feedback belongs to the reading order. On the default Music screen this
         is immediately before "Recently played", so a result cannot hide behind
         the mini player or cover a list control. -->
    <section v-if="ui.busyMessage || ui.notice" class="feedback-region"
             aria-label="Status messages">
      <div v-if="ui.busyMessage" class="operation-banner" role="status" aria-live="polite">
        <span class="feedback-spinner" aria-hidden="true"></span>
        <span class="feedback-copy">{{ ui.busyMessage }}</span>
      </div>
      <div v-if="ui.notice" class="notice" :class="ui.noticeKind"
           :role="ui.noticeKind === 'error' ? 'alert' : 'status'"
           :aria-live="ui.noticeKind === 'error' ? 'assertive' : 'polite'">
        <span class="feedback-mark" aria-hidden="true">{{ ui.noticeKind === 'error' ? '!' : '✓' }}</span>
        <span class="feedback-copy">{{ ui.notice }}</span>
        <button type="button" class="feedback-dismiss" aria-label="Dismiss message"
                @click="LmsUi.dismissNotice">×</button>
      </div>
    </section>

    <div class="body" :class="{split: isSplit, drilled: drilled}">
      <lms-search    v-if="ui.searching"></lms-search>
      <lms-browse    v-else-if="ui.tab === 'music'"></lms-browse>
      <lms-playlists v-else-if="ui.tab === 'playlists'" :key="plKey"></lms-playlists>
      <lms-settings  v-else-if="ui.tab === 'settings'"></lms-settings>
      <lms-more      v-else-if="ui.tab === 'more'"></lms-more>
      <lms-opml      v-else-if="ui.tab === 'radio'"     root="radio"     tab="radio"     :key="radioKey"></lms-opml>
      <lms-opml      v-else-if="ui.tab === 'apps'"      root="apps"      tab="apps"      :key="appsKey"></lms-opml>
      <lms-favorites v-else-if="ui.tab === 'favourites'" :key="favKey"></lms-favorites>
    </div>
  </main>

  <!-- Fica aqui, e nao junto das folhas la embaixo: a barra de selecao e uma
       linha da coluna .app (flex:0 0 44px), nao uma sobreposicao. A ordem de
       origem e o que a coloca entre a lista e o mini player, porque
       .app-header/.app-footer sao display:contents. Ver EC-003. -->
  <lms-selection-bar></lms-selection-bar>

  <footer class="app-footer">
    <lms-miniplayer @full="LmsUi.openPlayer" @queue="ui.queueOpen = true"></lms-miniplayer>
    <lms-tabbar></lms-tabbar>
  </footer>

  <lms-queue v-if="ui.queueOpen"></lms-queue>
  <lms-action-sheet></lms-action-sheet>
  <lms-info-sheet></lms-info-sheet>
  <lms-filter-panel></lms-filter-panel>

  <div v-if="ui.confirmation" class="confirm-stage global-confirm" role="dialog"
       aria-modal="true" aria-labelledby="global-confirm-title"
       @keydown.esc.stop.prevent="cancelConfirmation">
    <div class="confirm-back" @click="cancelConfirmation"></div>
    <div ref="confirmation" class="confirm-panel" tabindex="-1">
      <span class="confirm-handle" aria-hidden="true"></span>
      <strong id="global-confirm-title">{{ ui.confirmation.title }}</strong>
      <span>{{ ui.confirmation.message }}</span>
      <button type="button" :class="{destructive:ui.confirmation.destructive}"
              @click="acceptConfirmation">{{ ui.confirmation.confirmLabel }}</button>
      <button ref="confirmationCancel" type="button" @click="cancelConfirmation">Cancel</button>
    </div>
  </div>

  <!-- Seletor de raiz de Minha Musica, como listbox do ARIA APG (A11Y-01). Era
       uma pilha de botoes sem papel nenhum, com o foco parado no gatilho: o
       leitor de tela nao anunciava lista nem opcao selecionada, e o Tab saia
       dali para a busca -- para chegar a uma opcao era preciso atravessar a
       lista da biblioteca inteira. O rotulo vem do proprio gatilho
       (aria-labelledby), que ja diz qual raiz esta em uso. -->
  <template v-if="ui.picker">
    <div class="pickerback" @click="closePicker"></div>
    <div ref="picker" class="picker" role="listbox" tabindex="-1"
         aria-labelledby="picker-trigger"
         @keydown.esc.stop.prevent="closePicker"
         @keydown.tab="trapPicker"
         @keydown.down.prevent="stepPicker(1)"
         @keydown.up.prevent="stepPicker(-1)"
         @keydown.home.prevent="jumpPicker(0)"
         @keydown.end.prevent="jumpPicker(-1)">
      <button v-for="v in views" :key="v.key" type="button" role="option" class="p pointer"
           :aria-selected="String(ui.musicView === v.key)"
           :class="{on: ui.musicView === v.key}" @click="pickView(v.key)">{{ v.label }}</button>
    </div>
  </template>
</div>`,
    data: function () {
      return { ui: LmsUi.state, store: LmsStore.state, views: LmsUi.MUSIC_VIEWS,
               nav: LmsNav.stacks, LmsUi: LmsUi, pickerTriggerEl: null };
    },
    watch: {
      /* Abrir e um evento de teclado tanto quanto de ponteiro: o foco vai para
         a opcao em uso, e nao para o topo da lista, para quem navega por
         teclado comecar de onde ja esta. */
      'ui.picker': function (open) {
        if (!open) return;
        var self = this;
        this.$nextTick(function () {
          var nodes = self.pickerOptions();
          var at = 0;
          for (var i = 0; i < self.views.length; i++) {
            if (self.views[i].key === self.ui.musicView) { at = i; break; }
          }
          if (nodes[at]) nodes[at].focus();
          else if (self.$refs.picker && self.$refs.picker.focus) self.$refs.picker.focus();
        });
      },
      'ui.confirmation': function (value) {
        if (!value) return;
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.confirmationCancel) self.$refs.confirmationCancel.focus();
          else if (self.$refs.confirmation) self.$refs.confirmation.focus();
        });
      }
    },
    computed: {
	      tabLabel: function () {
	        for (var i = 0; i < LmsUi.TABS.length; i++) {
	          if (LmsUi.TABS[i].key === this.ui.tab) return LmsUi.TABS[i].label;
	        }
	        return '';
	      },
	      pageHeading: function () {
	        if (this.ui.searching) return 'Search';
	        return this.title || this.tabLabel || 'Echo Classic';
	      },
      depth: function () { return (this.nav[this.ui.tab] || []).length; },
      drilled: function () { return this.depth > 0; },
      adaptivePlayerOpen: function () {
        return this.ui.full && !this.ui.playerFullscreen;
      },
      workspaceClasses: function () {
        var classes = { 'player-adaptive': this.adaptivePlayerOpen };
        if (this.adaptivePlayerOpen) classes['player-' + this.ui.playerPosition] = true;
        return classes;
      },
      isSplit: function () { return this.ui.tab === 'music' && !this.ui.searching; },
      /* Minha Musica keeps its root title while drilling, because the list stays
         on screen beside the detail; the other tabs replace the whole view. */
      title: function () {
        if (this.ui.tab === 'music') return LmsUi.viewLabel();
        var top = LmsNav.top(this.ui.tab);
        return top ? top.label : this.tabLabel;
      },
      back: function () {
        if (!this.depth) return null;
        var root = this.ui.tab === 'music' ? LmsUi.viewLabel() : this.tabLabel;
        var current = LmsNav.top(this.ui.tab);
        /* NAV-01: quem entrou por um resultado volta para os resultados, nao
           para a raiz da aba. Depende de haver busca suspensa: a pilha
           sobrevive a recarga e o instantaneo nao, e oferecer 'Search' sem ter
           para onde voltar seria pior que o defeito. */
        if (this.depth === 1 && current && current.fromSearch && this.ui.searchReturn) {
          return 'Search';
        }
        if (this.ui.tab === 'music' && current && current.label === root) root = this.tabLabel;
        return LmsNav.parentLabel(this.ui.tab, root);
      },
      /* O picker fica sempre a vista em Minha Musica: sumindo ao entrar num
         artista, perdia-se a referencia de qual raiz se esta vendo. O toggle de
         apresentacao aparece ao lado dele, como continuacao. */
      pickable: function () { return this.ui.tab === 'music'; },
      /* Dentro de um artista o centro deixa de ser o picker e vira o toggle: a
         escolha de raiz nao faz sentido ali, e a de apresentacao faz. */
      segments: function () {
        return (this.ui.tab === 'music' && this.depth) ? LmsUi.ALBUM_MODES : [];
      },
      plKey: function () { return 'pl-' + (this.nav.playlists || []).length; },
      radioKey: function () { return 'radio-' + (this.nav.radio || []).length; },
      appsKey: function () { return 'apps-' + (this.nav.apps || []).length; },
      favKey: function () { return 'fav-' + (this.nav.favourites || []).length; },
      connectionMessage: function () {
        if (this.store.lastSuccess && this.store.np && this.store.np.id) {
          return this.tr('Player connection lost. Showing the last known track.');
        }
        return this.store.lastError || this.tr('No connection to the player.');
      },
      reconnectLabel: function () {
        return this.tr(this.store.reconnecting ? 'Reconnecting…' : 'Try again');
      }
    },
    methods: {
      tr: function (text) {
        return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
      },
      goBack: function () {
        if (this.ui.tab === 'settings' && this.ui.advancedSettings) {
          if (LmsUi.canLeaveAdvancedSettings && !LmsUi.canLeaveAdvancedSettings()) return;
          if (LmsNav.top('settings') && LmsNav.top('settings').advanced) LmsNav.pop('settings');
          else this.ui.advancedSettings = false;
          return;
        }
        var leaving = LmsNav.top(this.ui.tab);
        LmsNav.back(this.ui.tab);
        /* So ao desempilhar o proprio frame da busca: descer artista > album e
           voltar um nivel continua sendo navegacao dentro da aba. */
        if (leaving && leaving.fromSearch && !LmsNav.depth(this.ui.tab)) {
          LmsUi.resumeSearch(this.ui.tab);
        }
      },
      reconnect: function () { LmsStore.reconnect(); },
      managePartyMode: function () {
        LmsUi.setTab('settings');
        if (LmsNav.reset) LmsNav.reset('settings');
        LmsNav.push('settings', { label: 'Interface & access', screen: 'interface-settings' });
        this.ui.appearanceScreen = 'interface-settings';
      },
      acceptConfirmation: function () { LmsUi.resolveConfirmation(true); },
      cancelConfirmation: function () { LmsUi.resolveConfirmation(false); },
      /* O gatilho chega junto do evento porque e para ele que o foco volta.
         Mesmo acordo que o menu de ordenacao faz por LmsUi.sortTrigger(); aqui
         o dono e o proprio componente, que ja renderiza o popup. */
      openPicker: function (trigger) {
        this.pickerTriggerEl = trigger && trigger.focus ? trigger : null;
        this.ui.picker = true;
      },
      closePicker: function () {
        this.ui.picker = false;
        this.restorePickerFocus();
      },
      restorePickerFocus: function () {
        var trigger = this.pickerTriggerEl;
        if (!trigger || !trigger.focus) return;
        this.$nextTick(function () { trigger.focus(); });
      },
      pickerOptions: function () {
        if (!this.$refs.picker || !this.$refs.picker.querySelectorAll) return [];
        return Array.prototype.slice.call(
          this.$refs.picker.querySelectorAll('[role="option"]')
        );
      },
      stepPicker: function (delta) {
        var nodes = this.pickerOptions();
        if (!nodes.length) return;
        var at = nodes.indexOf(document.activeElement);
        var next = at < 0 ? (delta > 0 ? 0 : nodes.length - 1)
                          : (at + delta + nodes.length) % nodes.length;
        nodes[next].focus();
      },
      jumpPicker: function (index) {
        var nodes = this.pickerOptions();
        if (!nodes.length) return;
        nodes[index < 0 ? nodes.length - 1 : index].focus();
      },
      /* Sem isto o Tab levava o foco para a busca e dali para a lista da
         biblioteca, com o popup ainda aberto por cima. */
      trapPicker: function (event) {
        var nodes = this.pickerOptions();
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault(); nodes[nodes.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          event.preventDefault(); nodes[0].focus();
        }
      },
      pickView: function (key) {
        LmsUi.setMusicView(key);
        LmsNav.reset('music');
        this.restorePickerFocus();
      }
    }
  });

  function scrubKnownServerWarning() {
    if (!document.body) return;
    var nodes = Array.prototype.slice.call(document.body.childNodes || []);
    nodes.forEach(function (node) {
      if (node.nodeType !== 3) return;
      var text = node.nodeValue || '';
      if (text.indexOf('Subroutine js_literal redefined') >= 0 ||
          text.indexOf('Slim::Utils::Misc::msg') >= 0) {
        document.body.removeChild(node);
      }
    });
  }

  function scheduleWarningScrub() {
    scrubKnownServerWarning();
    setTimeout(scrubKnownServerWarning, 0);
    setTimeout(scrubKnownServerWarning, 250);
    setTimeout(scrubKnownServerWarning, 1000);
    window.addEventListener('load', scrubKnownServerWarning, { once: true });
  }

  async function boot() {
    scheduleWarningScrub();
    // The server already told us which player is connected; using it avoids a
    // blank first paint while serverstatus is in flight.
    if (typeof LMS_PLAYER_HINT === 'string' && LMS_PLAYER_HINT) {
      LmsStore.state.playerId = LMS_PLAYER_HINT;
      app.usedHint = true;
    }
    new Vue({ el: '#app', template: '<lms-app></lms-app>' });
    scrubKnownServerWarning();
    await LmsStore.init();
    scrubKnownServerWarning();
    await LmsStore.refresh();
    LmsStore.startPolling();
    scrubKnownServerWarning();
  }

  /* usedHint is a real property of this module, not a stray test global: the boot
     path is otherwise unobservable from outside. */
  var app = { boot: boot, usedHint: false };
  global.LmsApp = app;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
