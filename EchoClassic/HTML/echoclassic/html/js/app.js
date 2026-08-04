
/* Root component and boot sequence. This file owns three things: the vertical
   order of the chrome, which body renders for the current tab, and the order of
   the boot steps. Everything else lives in its own module. */
(function (global) {
  'use strict';

  Vue.component('lms-app', {
    template: `
<div class="app">
  <header class="app-header">
  <lms-statusbar></lms-statusbar>
  <lms-navbar :title="title" :back="back" :pickable="pickable"
              :segments="segments" :segment="ui.albumMode"
              @back="goBack" @picker="ui.picker = true"
              @segment="LmsUi.setAlbumMode($event)"></lms-navbar>
  </header>

	  <main class="workspace" :class="workspaceClasses">
	    <h1 class="visually-hidden">{{ pageHeading }}</h1>
	    <lms-nowplaying v-if="ui.full" :fullscreen="ui.playerFullscreen"></lms-nowplaying>

    <div class="body" :class="{split: isSplit, drilled: drilled}">
      <lms-search    v-if="ui.searching"></lms-search>
      <lms-browse    v-else-if="ui.tab === 'musica'"></lms-browse>
      <lms-playlists v-else-if="ui.tab === 'playlists'" :key="plKey"></lms-playlists>
      <lms-settings  v-else-if="ui.tab === 'ajustes'"></lms-settings>
      <lms-opml      v-else-if="ui.tab === 'radio'"     root="radio"     tab="radio"     :key="radioKey"></lms-opml>
      <lms-opml      v-else-if="ui.tab === 'apps'"      root="apps"      tab="apps"      :key="appsKey"></lms-opml>
      <lms-favorites v-else-if="ui.tab === 'favoritos'" :key="favKey"></lms-favorites>
    </div>
  </main>

  <div v-if="store.initialized && !store.connected" class="connection-banner" role="alert">
    <span>{{ store.lastError || 'Sem conexão com o player.' }}</span>
    <button :disabled="store.reconnecting" @click="reconnect">
      {{ store.reconnecting ? 'Reconectando…' : 'Tentar novamente' }}
    </button>
  </div>
  <div v-if="ui.busyMessage" class="operation-banner" role="status">{{ ui.busyMessage }}</div>
  <button v-if="ui.notice" class="notice" :class="ui.noticeKind"
          @click="LmsUi.dismissNotice">{{ ui.notice }}</button>

  <footer class="app-footer">
    <lms-miniplayer @full="LmsUi.openPlayer" @queue="ui.queueOpen = true"></lms-miniplayer>
    <lms-tabbar></lms-tabbar>
  </footer>

  <lms-queue v-if="ui.queueOpen"></lms-queue>
  <lms-selection-bar></lms-selection-bar>
  <lms-action-sheet></lms-action-sheet>
  <lms-info-sheet></lms-info-sheet>
  <lms-filter-panel></lms-filter-panel>

  <template v-if="ui.picker">
    <div class="pickerback" @click="ui.picker = false"></div>
    <div class="picker">
      <button v-for="v in views" :key="v.key" class="p pointer"
           :class="{on: ui.musicView === v.key}" @click="pickView(v.key)">{{ v.label }}</button>
    </div>
  </template>
</div>`,
    data: function () {
      return { ui: LmsUi.state, store: LmsStore.state, views: LmsUi.MUSIC_VIEWS,
               nav: LmsNav.stacks, LmsUi: LmsUi };
    },
    computed: {
	      tabLabel: function () {
	        for (var i = 0; i < LmsUi.TABS.length; i++) {
	          if (LmsUi.TABS[i].key === this.ui.tab) return LmsUi.TABS[i].label;
	        }
	        return '';
	      },
	      pageHeading: function () {
	        if (this.ui.searching) return 'Busca';
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
      isSplit: function () { return this.ui.tab === 'musica' && !this.ui.searching; },
      /* Minha Musica keeps its root title while drilling, because the list stays
         on screen beside the detail; the other tabs replace the whole view. */
      title: function () {
        if (this.ui.tab === 'musica') return LmsUi.viewLabel();
        var top = LmsNav.top(this.ui.tab);
        return top ? top.label : this.tabLabel;
      },
      back: function () {
        if (!this.depth) return null;
        var root = this.ui.tab === 'musica' ? LmsUi.viewLabel() : this.tabLabel;
        var current = LmsNav.top(this.ui.tab);
        if (this.ui.tab === 'musica' && current && current.label === root) root = this.tabLabel;
        return LmsNav.parentLabel(this.ui.tab, root);
      },
      /* O picker fica sempre a vista em Minha Musica: sumindo ao entrar num
         artista, perdia-se a referencia de qual raiz se esta vendo. O toggle de
         apresentacao aparece ao lado dele, como continuacao. */
      pickable: function () { return this.ui.tab === 'musica'; },
      /* Dentro de um artista o centro deixa de ser o picker e vira o toggle: a
         escolha de raiz nao faz sentido ali, e a de apresentacao faz. */
      segments: function () {
        return (this.ui.tab === 'musica' && this.depth) ? LmsUi.ALBUM_MODES : [];
      },
      plKey: function () { return 'pl-' + (this.nav.playlists || []).length; },
      radioKey: function () { return 'radio-' + (this.nav.radio || []).length; },
      appsKey: function () { return 'apps-' + (this.nav.apps || []).length; },
      favKey: function () { return 'fav-' + (this.nav.favoritos || []).length; }
    },
    methods: {
      goBack: function () { LmsNav.back(this.ui.tab); },
      reconnect: function () { LmsStore.reconnect(); },
      pickView: function (key) {
        LmsUi.setMusicView(key);
        LmsNav.reset('musica');
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
