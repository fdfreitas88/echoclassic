
/* Folhas de acao compartilhadas. Centralizar aqui evita que cada lista invente
   uma versao diferente de "A seguir", favoritos, playlists e informacoes. */
(function () {
  'use strict';

  function control(item) {
    if (!item) return null;
    var kind = item.kind || item.type;
    var keys = {
      track: 'track_id', album: 'album_id', artist: 'artist_id',
      playlist: 'playlist_id', genre: 'genre_id', year: 'year_id'
    };
    var key = keys[kind];
    return key && item.id != null ? { key: key, id: item.id } : null;
  }

  Vue.component('lms-action-sheet', {
    template: `
<div v-if="item" class="sheet-stage" :class="{anchored: !!anchor}">
  <div class="sheet-back" @click="close"></div>
  <div ref="sheet" class="action-sheet" :class="{anchored: !!anchor, swiping: swipeStartY !== null, 'playlist-mode': view === 'playlists'}" :style="[sheetStyle, swipeStyle]"
       role="dialog" :aria-label="'Actions for ' + (item.title || item.label || item.name)"
       :aria-modal="String(!anchor)" tabindex="-1"
       @keydown.esc.stop.prevent="escapeSheet" @keydown.tab="trapFocus"
       @pointerdown="startSwipe" @pointermove="moveSwipe" @pointerup="endSwipe" @pointercancel="cancelSwipe">
    <span v-if="!anchor" class="action-sheet-handle" aria-hidden="true"></span>
    <header v-if="item.kind === 'player-picker'" class="player-picker-head">
      <button type="button" class="player-picker-done" :disabled="playerSwitchBusy" @click="close">Done</button>
      <strong>Players</strong><button type="button" class="player-picker-refresh" :disabled="playerSwitchBusy" @click="refreshPlayerList">Refresh</button>
    </header>
    <header v-else class="action-sheet-head">
      <span class="action-sheet-art" :class="{placeholder: !artUrl}">
        <img v-if="artUrl" :src="artUrl" alt="">
      </span>
      <span class="action-sheet-heading">
        <strong class="ell">{{ view === 'playlists' ? 'Add to playlist' : (view === 'playlist-success' ? 'Track added' : (item.title || item.label || item.name)) }}</strong>
        <small class="ell">{{ view === 'actions' ? itemSubtitle : (item.title || item.label || item.name) }}</small>
      </span>
      <button type="button" class="action-sheet-done" @click="view === 'playlists' ? backToActions() : close()">
        {{ view === 'playlists' ? 'Back' : 'Done' }}
      </button>
    </header>
    <template v-if="view === 'actions'">
    <div v-if="item.editions && item.editions.length > 1" class="sheet-note action-sheet-editions">
      <span>{{ item.editions.length }}</span>
      <span>editions of this work in the library. The preference picks the first one and the others stay visible in the list.</span>
    </div>
    <div v-if="ctl" class="action-play-group" aria-label="Playback actions">
      <button type="button" @click="playNow"><span aria-hidden="true">▶</span>Play now</button>
      <button type="button" @click="next"><span aria-hidden="true">▶│</span>Play next</button>
      <button type="button" @click="later"><span aria-hidden="true">＋</span>Queue last</button>
    </div>
    <div v-if="item.kind !== 'player-picker'" class="action-sheet-group">
    <button v-if="item.url" type="button" @click="openPlaylists"><span class="action-glyph" aria-hidden="true">≡＋</span><span>Add to playlist</span><span class="action-chevron" aria-hidden="true">›</span></button>
    <button v-if="item.url" type="button" @click="favorite"><span class="action-glyph" aria-hidden="true">♡</span><span>
      {{ favoriteExists ? 'Remove from Favourites' : 'Add to Favourites' }}
    </span></button>
    <button type="button" @click="pin"><span class="action-glyph" aria-hidden="true">⌖</span><span>{{ pinned ? 'Remove from pinned items' : 'Pin to Echo Classic' }}</span></button>
    </div>
    <section v-if="item.kind === 'player-picker'" class="player-picker-page"
             @keydown.up.stop.prevent="movePlayerFocus(-1)"
             @keydown.down.stop.prevent="movePlayerFocus(1)">
      <div v-if="activePlayer" class="player-picker-summary">
        <small>Active player</small><strong class="ell">{{ activePlayer.name }} <em v-if="isDefaultPlayer(activePlayer)">LMS default</em></strong>
        <span class="ell">{{ activePlayerSummary }}{{ playerOutput(activePlayer) }}</span>
      </div>
      <p class="player-picker-intro">Choosing a player does not change playback until you apply the switch.</p>
      <template v-if="stableAvailablePlayers.length">
        <div class="player-picker-label">Available</div>
        <div class="player-picker-group" role="listbox" aria-label="Available players">
          <button v-for="p in stableAvailablePlayers" :key="p.id" type="button" class="player-picker-row"
                  :class="{on: p.id === store.playerId, selected: pendingPlayerId === p.id}" role="option"
                  :disabled="playerSwitchBusy" :aria-selected="pendingPlayerId === p.id ? 'true' : 'false'" @click="choosePlayer(p)">
            <span class="player-picker-icon" aria-hidden="true">▣</span>
            <span class="player-picker-copy"><strong class="ell">{{ p.name }} <em v-if="isDefaultPlayer(p)">LMS default</em></strong><small class="ell">{{ playerDetail(p) }}{{ playerOutput(p) }}</small></span>
            <span class="player-picker-radio" aria-hidden="true"></span>
          </button>
        </div>
      </template>
      <template v-if="unavailablePlayers.length">
        <div class="player-picker-label">Unavailable</div>
        <div class="player-picker-group" role="list" aria-label="Unavailable players">
          <div v-for="p in unavailablePlayers" :key="p.id" class="player-picker-row unavailable">
            <span class="player-picker-icon" aria-hidden="true">▣</span>
            <span class="player-picker-copy"><strong class="ell">{{ p.name }}</strong><small>Not connected to this server</small></span>
            <span class="player-picker-state"><i></i>Offline</span>
          </div>
          <p class="player-picker-help">Reconnect the player to the same LMS server to select it.</p>
        </div>
      </template>
      <div v-if="!players.length" class="player-picker-empty"><strong>No players found</strong><span>Check that a player is connected to this LMS server.</span></div>
      <div v-if="experimentalPlayers.length" class="player-picker-experimental">
        <strong>Experimental players</strong>
        <span v-for="p in experimentalPlayers" :key="p.id">{{ p.name }} · Test integration</span>
        <small>Experimental players never replace the LMS default or fallback automatically.</small>
      </div>
      <div v-if="pendingPlayer" class="player-switch-review" aria-live="polite">
        <span>Switch control from <b>{{ activePlayer ? activePlayer.name : 'Squeezelite' }}</b> to <b>{{ pendingPlayer.name }}</b>. Music will stop during validation.</span>
        <div><button type="button" :disabled="playerSwitchBusy" @click="cancelPlayerChoice">Cancel</button><button type="button" class="primary" :disabled="playerSwitchBusy" @click="applyPlayerChoice">Apply switch</button></div>
      </div>
      <div v-if="playerSwitchPhase" class="player-switch-progress" role="status" aria-live="polite">
        <strong>{{ playerSwitchTitle }}</strong><span>{{ playerSwitchMessage }}</span>
        <ol>
          <li :class="playerStepClass('stopping')">Stop current music</li>
          <li :class="playerStepClass('switching')">Switch controlled player</li>
          <li :class="playerStepClass('checking')">Verify connection and response</li>
          <li :class="playerStepClass('resuming')">Resume playback if it was playing</li>
        </ol>
        <div v-if="playerSwitchPhase === 'failed'" class="player-switch-recovery"><button type="button" @click="cancelPlayerChoice">Keep Squeezelite</button><button type="button" @click="applyPlayerChoice">Try again</button></div>
        <button v-if="playerSwitchPhase === 'complete'" type="button" class="player-switch-complete" @click="close">Done</button>
      </div>
      <div class="player-picker-label">Current player</div>
      <div class="player-picker-group">
        <button type="button" class="player-picker-settings" @click="openPlayerSettings">Player settings <span aria-hidden="true">›</span></button>
      </div>
    </section>
    <div v-if="item.kind === 'track' || item.type === 'track'" class="action-sheet-group action-info-group">
      <button type="button" @click="info"><span class="action-glyph" aria-hidden="true">ⓘ</span><span>Credits and information</span><span class="action-chevron" aria-hidden="true">›</span></button>
    </div>
    <button v-if="!anchor" class="cancel" @click="close">Cancel</button>
    </template>
    <section v-else-if="view === 'playlists'" class="action-playlist-view" aria-label="Choose a playlist">
      <label class="action-playlist-search"><span aria-hidden="true">⌕</span><input ref="playlistSearch" v-model.trim="playlistQuery" type="search" placeholder="Search playlists" aria-label="Search playlists"></label>
      <button v-if="!newPlaylistOpen" type="button" class="action-playlist-create" @click="showNewPlaylist">
        <span class="action-glyph" aria-hidden="true">＋</span><span><strong>New playlist</strong><small>Create and add this track</small></span>
      </button>
      <form v-else class="action-playlist-new" @submit.prevent="createAndAdd">
        <label for="action-new-playlist">Playlist name</label>
        <input id="action-new-playlist" ref="newPlaylistName" v-model.trim="newPlaylistName" maxlength="120" autocomplete="off">
        <div><button type="button" @click="hideNewPlaylist">Cancel</button><button type="submit" class="primary" :disabled="!newPlaylistName || busy">{{ busy ? 'Creating playlist…' : 'Create & add' }}</button></div>
      </form>
      <div v-if="playlistError" class="sheet-note error">{{ playlistError }} <button type="button" @click="loadPlaylists">Retry</button></div>
      <div v-else class="action-playlist-list" role="listbox" aria-label="Playlists">
        <div v-if="recentPlaylists.length" class="action-list-label">Recent</div>
        <button v-for="p in recentPlaylists" :key="'recent-'+p.id" type="button" class="action-playlist-option" :class="{selected: playlistSelected(p)}" role="option" :aria-selected="playlistSelected(p) ? 'true' : 'false'" @click="selectPlaylist(p)"><span class="action-glyph" aria-hidden="true">♫</span><span class="action-playlist-copy"><strong class="ell">{{ p.name }}</strong><small v-if="p.source" class="ell">{{ p.source }}</small></span><span class="action-playlist-check" aria-hidden="true">✓</span></button>
        <div v-if="otherPlaylists.length" class="action-list-label">{{ recentPlaylists.length ? 'All playlists' : 'Playlists' }}</div>
        <button v-for="p in otherPlaylists" :key="p.id" type="button" class="action-playlist-option" :class="{selected: playlistSelected(p)}" role="option" :aria-selected="playlistSelected(p) ? 'true' : 'false'" @click="selectPlaylist(p)"><span class="action-glyph" aria-hidden="true">♫</span><span class="action-playlist-copy"><strong class="ell">{{ p.name }}</strong><small v-if="p.source" class="ell">{{ p.source }}</small></span><span class="action-playlist-check" aria-hidden="true">✓</span></button>
        <div v-if="!filteredPlaylists.length" class="sheet-note">{{ playlists.length ? 'No matching playlists.' : 'No editable playlists.' }}</div>
      </div>
      <footer class="action-playlist-footer"><span class="ell">{{ selectedPlaylist ? selectedPlaylist.name : 'Choose one playlist' }}</span><button type="button" class="primary" :disabled="!selectedPlaylist || busy" @click="addToPlaylist">{{ busy ? 'Adding…' : 'Add track' }}</button></footer>
    </section>
    <section v-else class="action-playlist-success" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span><strong>{{ 'Added to' }} “{{ addedPlaylistName }}”</strong><small>The track remains selected in Music Folder.</small><button type="button" @click="close">Done</button>
    </section>
  </div>
</div>`,
    data: function () {
	      return { ui: LmsUi.state, store: LmsStore.state, playlists: [], view: 'actions', playlistQuery: '', playlistError: '', favoriteError: '',
	               selectedPlaylist: null, newPlaylistOpen: false, newPlaylistName: '', addedPlaylistName: '',
	               busy: false, favoriteExists: false, favoriteIndex: null, sheetStyle: {},
               pendingPlayerId: '', playerSwitchBusy: false, playerSwitchPhase: '', playerSwitchFailedAt: '', playerSwitchError: '',
               previousFocus: null, swipeStartY: null, swipeOffset: 0 };
    },
    computed: {
      item: function () { return this.ui.actionItem; },
      anchor: function () { return this.ui.actionAnchor; },
      ctl: function () { return control(this.item); },
      pinned: function () { return this.item ? LmsUi.isPinned(this.item) : false; },
      players: function () { return this.store.players || []; },
      availablePlayers: function () {
        return this.players.filter(function (p) { return p.connected; });
      },
      stableAvailablePlayers: function () {
        return this.availablePlayers.filter(function (p) { return !/apple\s*squeezer/i.test(p.name || ''); });
      },
      experimentalPlayers: function () {
        return this.players.filter(function (p) { return /apple\s*squeezer/i.test(p.name || ''); });
      },
      unavailablePlayers: function () {
        return this.players.filter(function (p) {
          return !p.connected && !/apple\s*squeezer/i.test(p.name || '');
        });
      },
      activePlayer: function () {
        var id = this.store.playerId;
        return this.players.filter(function (p) { return p.id === id; })[0] || null;
      },
      pendingPlayer: function () {
        var id = this.pendingPlayerId;
        if (!id || id === this.store.playerId) return null;
        return this.players.filter(function (p) { return p.id === id; })[0] || null;
      },
      playerSwitchTitle: function () {
        if (this.playerSwitchPhase === 'complete') return 'Player switched';
        if (this.playerSwitchPhase === 'failed') return 'Player switch failed';
        return 'Applying player configuration';
      },
      playerSwitchMessage: function () {
        if (this.playerSwitchPhase === 'complete') return 'The new player is connected and responding.';
        if (this.playerSwitchPhase === 'failed') return this.playerSwitchError || 'Squeezelite was restored.';
        if (this.playerSwitchPhase === 'stopping') return 'Waiting for the current player to confirm Stop…';
        if (this.playerSwitchPhase === 'switching') return 'Changing the controlled player…';
        if (this.playerSwitchPhase === 'checking') return 'Checking connection, power and status…';
        return 'Restoring playback state…';
      },
      activePlayerSummary: function () {
        if (!this.activePlayer) return '';
        if (!this.activePlayer.power) return 'Sleeping';
        var title = this.store.np && this.store.np.title;
        return title ? 'Playing · ' + title : 'Ready';
      },
      itemSubtitle: function () {
        if (!this.item) return '';
        return [this.item.artist || this.item.sub, this.item.album].filter(Boolean).join(' · ');
      },
      artUrl: function () {
        if (!this.item || this.item.kind === 'player-picker') return '';
        var id = this.item.coverId || this.item.artworkTrackId ||
          (this.item.kind === 'album' ? this.item.id : null);
        return id ? LmsFmt.coverUrl(id, 80) : '';
      },
      filteredPlaylists: function () {
        var query = this.playlistQuery.toLocaleLowerCase();
        if (!query) return this.playlists;
        return this.playlists.filter(function (p) {
          return String(p.name || '').toLocaleLowerCase().indexOf(query) !== -1;
        });
      },
      recentPlaylistIds: function () {
        try { return JSON.parse(localStorage.getItem('echoRecentPlaylists') || '[]'); }
        catch (e) { return []; }
      },
      recentPlaylists: function () {
        var ids = this.recentPlaylistIds;
        return this.filteredPlaylists.filter(function (p) {
          return ids.indexOf(String(p.id)) !== -1;
        }).sort(function (a, b) {
          return ids.indexOf(String(a.id)) - ids.indexOf(String(b.id));
        }).slice(0, 4);
      },
      otherPlaylists: function () {
        var recent = this.recentPlaylists.map(function (p) { return String(p.id); });
        return this.filteredPlaylists.filter(function (p) { return recent.indexOf(String(p.id)) === -1; });
      },
      swipeStyle: function () {
        if (this.anchor || !this.swipeOffset) return {};
        return { transform: 'translate(-50%, ' + this.swipeOffset + 'px)' };
      }
    },
    watch: {
      item: function (value) {
        this.view = 'actions';
        this.playlistQuery = '';
        this.selectedPlaylist = null;
        this.newPlaylistOpen = false;
        this.newPlaylistName = '';
        this.addedPlaylistName = '';
        this.favoriteExists = false;
        this.favoriteIndex = null;
        this.pendingPlayerId = '';
        this.playerSwitchBusy = false;
        this.playerSwitchPhase = '';
        this.playerSwitchFailedAt = '';
        this.playerSwitchError = '';
        if (value) this.previousFocus = document.activeElement;
        if (value && value.url) {
          this.loadPlaylists();
          this.loadFavorite(value.url);
        }
        this.$nextTick(this.prepareSheet);
      },
      anchor: function () { this.$nextTick(this.positionSheet); },
      view: function () {
        var self = this;
        this.$nextTick(function () {
          self.positionSheet();
          if (self.view === 'playlists' && self.$refs.playlistSearch) self.$refs.playlistSearch.focus();
        });
      }
    },
    methods: {
      close: function () {
        if (this.playerSwitchBusy) return;
        var previous = this.previousFocus;
        LmsUi.closeActions();
        setTimeout(function () { if (previous && previous.focus) previous.focus(); }, 0);
      },
      escapeSheet: function () {
        if (this.playerSwitchBusy) return;
        if (this.view === 'playlists') this.backToActions();
        else this.close();
      },
      openPlaylists: function () { this.view = 'playlists'; this.selectedPlaylist = null; },
      backToActions: function () { this.view = 'actions'; this.playlistQuery = ''; this.selectedPlaylist = null; this.newPlaylistOpen = false; this.newPlaylistName = ''; },
      selectPlaylist: function (playlist) { if (!this.busy) this.selectedPlaylist = playlist; },
      playlistSelected: function (playlist) { return !!(this.selectedPlaylist && String(this.selectedPlaylist.id) === String(playlist.id)); },
      showNewPlaylist: function () {
        this.newPlaylistOpen = true;
        this.selectedPlaylist = null;
        var self = this;
        this.$nextTick(function () { if (self.$refs.newPlaylistName) self.$refs.newPlaylistName.focus(); });
      },
      hideNewPlaylist: function () { this.newPlaylistOpen = false; this.newPlaylistName = ''; },
      prepareSheet: function () {
        this.positionSheet();
        if (this.$refs.sheet) {
          var first = this.$refs.sheet.querySelector('button');
          if (first) first.focus(); else this.$refs.sheet.focus();
        }
      },
      trapFocus: function (event) {
        if (this.anchor || !this.$refs.sheet) return;
        var nodes = Array.prototype.slice.call(this.$refs.sheet.querySelectorAll('button:not([disabled]), input:not([disabled])'));
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault(); nodes[nodes.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          event.preventDefault(); nodes[0].focus();
        }
      },
      startSwipe: function (event) {
        if (this.anchor || event.button > 0) return;
        if (this.playerSwitchBusy) return;
        var target = event.target;
        if (!target || (!target.closest('.action-sheet-head') && !target.closest('.player-picker-head') && !target.closest('.action-sheet-handle'))) return;
        this.swipeStartY = event.clientY;
        this.swipeOffset = 0;
        if (event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
      },
      moveSwipe: function (event) {
        if (this.swipeStartY === null) return;
        this.swipeOffset = Math.max(0, event.clientY - this.swipeStartY);
        if (this.swipeOffset) event.preventDefault();
      },
      endSwipe: function () {
        if (this.swipeStartY === null) return;
        var dismiss = this.swipeOffset >= 90;
        this.swipeStartY = null;
        this.swipeOffset = 0;
        if (dismiss) this.close();
      },
      cancelSwipe: function () { this.swipeStartY = null; this.swipeOffset = 0; },
      positionSheet: function () {
        if (!this.anchor || !this.$refs.sheet) {
          this.sheetStyle = {};
          return;
        }
        var margin = 8;
        var gap = 7;
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        var preferredWidth = this.item && this.item.kind === 'player-picker' ? 430 : 320;
        var width = Math.min(preferredWidth, viewportWidth - margin * 2);
        var sheet = this.$refs.sheet;
        var height = Math.min(sheet.scrollHeight, viewportHeight - margin * 2);
        var left = this.anchor.right + gap;
        if (left + width > viewportWidth - margin) left = this.anchor.left - width - gap;
        if (left < margin) left = Math.max(margin,
          Math.min(this.anchor.left, viewportWidth - width - margin));
        var below = viewportHeight - this.anchor.bottom - margin;
        var above = this.anchor.top - margin;
        var top;
        if (below >= height || below >= above) {
          top = Math.min(this.anchor.bottom + gap, viewportHeight - height - margin);
        } else {
          top = Math.max(margin, this.anchor.top - height - gap);
        }
        this.sheetStyle = {
          left: Math.round(left) + 'px', top: Math.round(top) + 'px',
          width: Math.round(width) + 'px',
          maxHeight: Math.max(120, Math.round(viewportHeight - top - margin)) + 'px'
        };
      },
      /* Preferencia de reproducao: quando existem edicoes irmas e o usuario
         declarou uma preferencia, quem toca e a primeira da lista ja ranqueada
         por browse.js. A tela DIZ qual foi escolhida -- trocar o que toca sem
         avisar seria a pior forma de errar aqui, porque o sintoma chega pelo
         ouvido e sem pista nonea na interface. As outras edicoes continuam
         visiveis na lista; nada e escondido. */
      chosenEdition: function () {
        var item = this.item;
        if (!item || !item.editions || item.editions.length < 2) return null;
        var best = item.editions[0];
        return best && String(best.id) !== String(item.id) ? best : null;
      },
      playNow: function () {
        var c = this.ctl;
        if (!c) return;
        var self = this;
        var chosen = this.chosenEdition();
        var id = chosen ? chosen.id : c.id;
        LmsStore.playContainer(c.key, id, 0).then(function (ok) {
          if (ok === false) return;
          if (chosen) {
            /* O texto entra no dicionario inteiro, com marcador: concatenar a
               origem na frente produziria uma frase que nonea chave casa --
               foi assim que os avisos de truncamento apareceram em portugues
               numa sessao em ingles. */
            var frase = 'Playing the preferred edition: {edition}.';
            if (window.LmsStr && LmsStr.t) frase = LmsStr.t(frase);
            LmsUi.notify(frase.replace('{edition}', chosen.source), 'info', 4000);
          }
          self.close();
        });
      },
      next: function () {
        var c = this.ctl;
        var self = this;
        if (c) LmsStore.playNext(c.key, c.id).then(function (ok) { if (ok !== false) self.close(); });
      },
      later: function () {
        var c = this.ctl;
        var self = this;
        if (c) LmsStore.addToQueue(c.key, c.id).then(function (ok) { if (ok !== false) self.close(); });
      },
      pin: function () {
        LmsUi.togglePin(this.item);
        this.close();
      },
      /* A linha so escolhe. O servidor permanece intocado ate Apply switch;
         isso torna a parada, a validacao e o rollback uma unica transacao. */
      choosePlayer: function (p) {
        if (!p || !p.connected || this.playerSwitchBusy) return;
        this.pendingPlayerId = p.id === this.store.playerId ? '' : p.id;
        this.playerSwitchPhase = '';
        this.playerSwitchFailedAt = '';
        this.playerSwitchError = '';
        this.$nextTick(this.positionSheet);
      },
      cancelPlayerChoice: function () {
        if (this.playerSwitchBusy) return;
        this.pendingPlayerId = '';
        this.playerSwitchPhase = '';
        this.playerSwitchFailedAt = '';
        this.playerSwitchError = '';
        this.$nextTick(this.positionSheet);
      },
      applyPlayerChoice: async function () {
        if (!this.pendingPlayer || this.playerSwitchBusy) return;
        var self = this;
        this.playerSwitchBusy = true;
        this.playerSwitchFailedAt = '';
        this.playerSwitchError = '';
        var result = await LmsStore.switchPlayerSafely(this.pendingPlayer.id, function (phase) {
          if (/^(stopping|switching|checking|resuming)$/.test(phase)) self.playerSwitchFailedAt = phase;
          self.playerSwitchPhase = phase;
        });
        this.playerSwitchBusy = false;
        if (!result || !result.ok) {
          this.playerSwitchPhase = 'failed';
          this.playerSwitchError = result && result.error ? result.error : 'The player switch did not complete.';
        } else {
          this.pendingPlayerId = '';
          this.playerSwitchPhase = 'complete';
        }
        this.$nextTick(this.positionSheet);
      },
      refreshPlayerList: async function () {
        if (this.playerSwitchBusy) return;
        this.playerSwitchError = '';
        try { await LmsStore.refreshPlayers(); }
        catch (e) { this.playerSwitchError = LmsStore.friendlyError(e, 'Could not refresh players.'); }
      },
      isDefaultPlayer: function (p) {
        return !!(p && /squeezelite/i.test((p.model || '') + ' ' + (p.name || '')));
      },
      playerOutput: function (p) {
        return p && p.output ? ' · Output: ' + p.output : '';
      },
      playerStepClass: function (name) {
        var order = ['stopping', 'switching', 'checking', 'resuming'];
        var current = order.indexOf(this.playerSwitchPhase);
        var index = order.indexOf(name);
        if (this.playerSwitchPhase === 'complete') return 'done';
        if (this.playerSwitchPhase === 'failed') {
          var failed = order.indexOf(this.playerSwitchFailedAt);
          return index < failed ? 'done' : (index === failed ? 'error' : '');
        }
        if (current < 0) return '';
        return index < current ? 'done' : (index === current ? 'active' : '');
      },
      /* Texto vai para uma interpolacao de template, entao a reescrita de
         i18n ja envolve isto em $t() sozinha -- sem chamada explicita aqui. */
      playerStatusLabel: function (p) {
        if (!p.connected) return 'Disconnected';
        if (!p.power) return 'Sleeping';
        return 'Ready';
      },
      playerDetail: function (p) {
        if (p.id === this.store.playerId) return this.activePlayerSummary;
        return p.power ? 'Available for playback' : 'Wake the player to begin playback';
      },
      movePlayerFocus: function (direction) {
        if (!this.$refs.sheet) return;
        var rows = Array.prototype.slice.call(this.$refs.sheet.querySelectorAll(
          '.player-picker-page button:not([disabled])'
        ));
        if (!rows.length) return;
        var index = rows.indexOf(document.activeElement);
        var next = index < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, index + direction));
        rows[next].focus();
      },
      openPlayerSettings: function () {
        LmsUi.closeActions();
        LmsUi.setTab('settings');
        LmsNav.push('settings', { label: 'Player settings', screen: 'player-settings' });
        this.ui.appearanceScreen = 'player-settings';
      },
      loadFavorite: async function (url) {
        this.favoriteError = '';
        try {
          var found = await LmsApi.favoriteExists(url);
          if (!this.item || this.item.url !== url) return;
          this.favoriteExists = found.exists;
          this.favoriteIndex = found.index;
        } catch (e) {
          this.favoriteError = LmsStore.friendlyError(e, 'Could not check favourite status.');
          if (window.console && console.debug) console.debug('[Echo Classic] favourite status: ' + this.favoriteError);
        }
      },
      favorite: async function () {
        /* busy era ligado e desligado, mas nunca testado aqui - ao contrario de
           addToPlaylist. Dois toques rapidos disparavam duas chamadas: duas
           adicoes do mesmo URL, ou duas remocoes do mesmo indice, e a segunda
           apagava o favorito que tivesse ocupado aquela posicao. */
        if (!this.item || !this.item.url || this.busy) return;
        this.busy = true;
        LmsUi.setBusy('Updating favourites…');
        try {
          if (this.favoriteExists && this.favoriteIndex !== null) {
            await LmsApi.favoriteRemove(this.favoriteIndex);
          } else {
            await LmsApi.favoriteAdd(this.item.url, this.item.title || this.item.label);
          }
          this.close();
        } catch (e) {
          LmsUi.notify('Could not update favourites. ' + e.message, 'error', 6500);
        } finally {
          this.busy = false;
          LmsUi.setBusy('');
        }
      },
      info: function () {
        var item = this.item;
        LmsUi.closeActions();
        this.ui.infoItem = item;
      },
      loadPlaylists: async function () {
        this.playlistError = '';
        try { this.playlists = await LmsApi.playlists(0, 500); }
        catch (e) {
          this.playlists = [];
          this.playlistError = LmsStore.friendlyError(e, 'Could not load playlists.');
          if (window.console && console.debug) console.debug('[Echo Classic] playlists: ' + this.playlistError);
        }
      },
      rememberPlaylist: function (playlist) {
        try {
          var id = String(playlist.id);
          var recent = this.recentPlaylistIds.filter(function (entry) { return entry !== id; });
          localStorage.setItem('echoRecentPlaylists', JSON.stringify([id].concat(recent).slice(0, 4)));
        } catch (e) {}
      },
      finishPlaylistAdd: function (playlist) {
        this.rememberPlaylist(playlist);
        this.addedPlaylistName = playlist.name;
        this.selectedPlaylist = null;
        this.newPlaylistOpen = false;
        this.newPlaylistName = '';
        this.view = 'playlist-success';
      },
      addTrackToPlaylist: function (playlist) {
        return LmsApi.editPlaylist(playlist.id, 'add', {
          title: this.item.title || this.item.label,
          url: this.item.url
        });
      },
      addToPlaylist: async function () {
        var playlist = this.selectedPlaylist;
        if (!playlist || !this.item || !this.item.url || this.busy) return;
        this.busy = true;
        LmsUi.setBusy('Adding to playlist…');
        try {
          await this.addTrackToPlaylist(playlist);
          this.finishPlaylistAdd(playlist);
        } catch (e) {
          LmsUi.notify('Could not add to the playlist. ' + e.message, 'error', 6500);
        } finally {
          this.busy = false;
          LmsUi.setBusy('');
        }
      },
      createAndAdd: async function () {
        var name = this.newPlaylistName.trim();
        if (!name || !this.item || !this.item.url || this.busy) return;
        this.busy = true;
        LmsUi.setBusy('Creating playlist…');
        try {
          var created = await LmsApi.createPlaylist(name);
          if (created.id == null) throw new Error('The server did not return a playlist.');
          var playlist = { id: created.id, name: name, source: 'Local library' };
          await this.addTrackToPlaylist(playlist);
          this.finishPlaylistAdd(playlist);
        } catch (e) {
          LmsUi.notify('Could not create the playlist. ' + e.message, 'error', 6500);
        } finally {
          this.busy = false;
          LmsUi.setBusy('');
        }
      }
    },
    mounted: function () { window.addEventListener('resize', this.positionSheet); },
    beforeDestroy: function () { window.removeEventListener('resize', this.positionSheet); }
  });

  Vue.component('lms-info-sheet', {
    template: `
<div v-if="item" class="sheet-stage info-stage">
  <div class="sheet-back" @click="close"></div>
  <section ref="infoDialog" class="info-sheet" role="dialog" aria-modal="true"
           :aria-label="view === 'lyrics' ? tr('Lyrics') : (view === 'signal' ? tr('Signal path') : tr('Track information'))" tabindex="-1"
           @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus">
    <div class="info-head">
      <button class="back-command" @click="headBack">{{ tr(view === 'info' ? 'Done' : 'Back') }}</button>
      <div class="ttl">{{ tr(view === 'lyrics' ? 'Lyrics' : (view === 'signal' ? 'Signal path' : 'Information')) }}</div>
    </div>
    <div v-if="loading" class="empty"><div class="p">Loading…</div></div>
    <div v-else-if="error" class="empty">
      <div class="p">{{ error }}</div>
      <button class="retry-command" @click="load(item)">Try again</button>
    </div>
    <div v-else-if="info && view === 'lyrics' && hasLyrics" class="info-content scroller">
      <div class="sgh">{{ [info.title || item.title, info.artist].filter(Boolean).join(' · ') }}</div>
      <div class="sgroup">
        <div class="reading">{{ info.lyrics }}</div>
        <div class="reading-source">{{ tr("From the file's own tags") }}</div>
      </div>
    </div>
    <div v-else-if="info && view === 'signal'" class="info-content scroller">
      <div class="sgh">Signal path</div>
      <div class="sgroup signal-path-information">
        <div class="srow"><span>Source track<small>Reported by track metadata</small></span><span class="v">{{ streamLabel(store.np.sourceStream) || 'Unavailable' }}</span></div>
        <div class="srow"><span>LMS processing<small>Confirmed by the current status response</small></span><span class="v">{{ processingLabel }}</span></div>
        <div class="srow"><span>Active stream<small>Sent by LMS to the selected player</small></span><span class="v">{{ streamLabel(store.np.activeStream) || 'Unavailable' }}</span></div>
        <div class="srow"><span>CoreAudio / DAC<small>Requires Apple Squeezer hardware telemetry</small></span><span class="v">Unavailable</span></div>
      </div>
    </div>
    <div v-else-if="info" class="info-content info-overview scroller">
      <header class="info-identity">
        <span class="info-art" :class="{ empty: !infoCoverUrl }" :style="infoCoverStyle" aria-hidden="true"></span>
        <div class="info-identity-copy">
          <div class="info-title">{{ info.title || item.title }}</div>
          <div v-if="info.artist" class="info-artist">{{ info.artist }}</div>
          <div class="info-sub">{{ [info.album, info.year].filter(Boolean).join(' · ') }}</div>
          <div class="info-facts"><span>{{ formatLabel }}</span><span>{{ resolution }}</span></div>
        </div>
      </header>
      <button v-if="isCurrentTrack" type="button" class="signal-summary" @click="view = 'signal'">
        <span class="signal-summary-mark" aria-hidden="true"></span>
        <span class="signal-summary-copy"><strong>{{ signalSummary }}</strong><small>{{ signalRoute }}</small></span>
        <span class="signal-summary-link">View signal path <span aria-hidden="true">›</span></span>
      </button>
      <div class="sgh">Library</div>
      <div class="sgroup info-compact-group">
        <div class="srow"><span>Rating</span><span class="v">{{ stars }}</span></div>
        <div class="srow"><span>Plays</span><span class="v">{{ info.playCount || 0 }}</span></div>
        <div v-if="info.genre" class="srow"><span>Genre</span><span class="v">{{ info.genre }}</span></div>
        <button v-if="hasLyrics" type="button" class="srow settings-command-row pointer"
                @click="view = 'lyrics'">{{ tr('Lyrics') }} <span class="v">{{ tr('Read lyrics') }} ›</span></button>
      </div>
      <template v-if="hasCredits">
        <div class="sgh">Credits</div>
        <div class="sgroup info-compact-group">
        <div v-if="info.albumArtist" class="srow">Album artist <span class="v">{{ info.albumArtist }}</span></div>
        <div v-if="info.composer" class="srow">Composition <span class="v">{{ info.composer }}</span></div>
        <div v-if="info.conductor" class="srow">Conductor <span class="v">{{ info.conductor }}</span></div>
        <div v-if="info.band" class="srow">Band <span class="v">{{ info.band }}</span></div>
        </div>
      </template>
      <div class="sgh">Release</div>
      <div class="sgroup info-compact-group">
        <div class="srow">Edition <span class="v">{{ editionLabel }}</span></div>
        <div v-if="info.originalYear" class="srow">Original year <span class="v">{{ info.originalYear }}</span></div>
      </div>
      <div class="sgh">File</div>
      <div class="sgroup info-compact-group">
        <div class="srow">Source file <span class="v">{{ fileLabel }}</span></div>
      </div>
    </div>
  </section>
</div>`,
    data: function () {
      return { ui: LmsUi.state, store: LmsStore.state, info: null, loading: false, error: '',
               previousFocus: null, requestToken: 0, view: 'info' };
    },
    computed: {
      item: function () { return this.ui.infoItem; },
      /* Whitespace-only tags (a common artifact of buggy taggers) are a
         non-empty, truthy string -- v-if="info.lyrics" alone would still open
         the reading surface onto nothing. Trimming is a presentation call,
         so it lives here, not in api.js's mapper. */
      hasLyrics: function () {
        return !!(this.info && this.info.lyrics && this.info.lyrics.trim());
      },
      stars: function () {
        var rating = Math.max(0, Math.min(5, Math.round((this.info && this.info.rating || 0) / 20)));
        return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(rating);
      },
      resolution: function () {
        if (!this.info) return '—';
        var rate = LmsFmt.rate(this.info.sampleRate);
        var depth = LmsFmt.depth(this.info.sampleSize);
        return [rate, depth].filter(Boolean).join(' / ') || '—';
      },
      formatLabel: function () {
        return this.info && this.info.format ? LmsFmt.format(this.info.format) : '—';
      },
      infoCoverUrl: function () {
        var id = this.item && (this.item.coverId || this.item.artworkTrackId);
        if (!id && this.isCurrentTrack) id = this.store.np.coverId;
        return id ? LmsFmt.coverUrl(id, 160) : '';
      },
      infoCoverStyle: function () {
        return this.infoCoverUrl ? { backgroundImage: 'url(' + this.infoCoverUrl + ')' } : {};
      },
      hasCredits: function () {
        return !!(this.info && (this.info.albumArtist || this.info.composer || this.info.conductor || this.info.band));
      },
      editionLabel: function () {
        return [this.info && this.info.year, this.info && this.info.releaseType].filter(Boolean).join(' · ') || 'Not available';
      },
      fileLabel: function () {
        var bitrate = this.info && this.info.bitrate ? Math.round(this.info.bitrate) + ' kbps' : '';
        return [this.formatLabel, this.resolution, bitrate].filter(function (value) { return value && value !== '—'; }).join(' · ') || 'Not available';
      },
      isCurrentTrack: function () {
        return !!(this.item && this.store.np && String(this.item.id) === String(this.store.np.id));
      },
      processingLabel: function () {
        var parts = [];
        if (this.store.np.isTranscoded) parts.push('Transcoded');
        if (this.store.replayGainApplied != null && isFinite(Number(this.store.replayGainApplied))) {
          var gain = Number(this.store.replayGainApplied);
          parts.push('Replay Gain ' + (gain > 0 ? '+' : '') + gain.toFixed(2).replace(/\.00$/, '') + ' dB');
        }
        return parts.length ? parts.join(' · ') : 'No processing reported';
      },
      signalSummary: function () {
        return this.store.np.isTranscoded ? 'Playing with transcoding' : 'Playing without transcoding';
      },
      signalRoute: function () {
        var source = this.streamLabel(this.store.np.sourceStream);
        var active = this.streamLabel(this.store.np.activeStream);
        return [source, active && active !== source ? active : '', 'selected player'].filter(Boolean).join(' → ');
      }
    },
    watch: {
      item: function (item) {
        if (item) {
          this.previousFocus = document.activeElement;
          this.load(item);
          this.$nextTick(function () {
            var button = this.$refs.infoDialog && this.$refs.infoDialog.querySelector('button');
            if (button) button.focus();
          });
        }
      },
      /* Switching branches (info <-> lyrics) unmounts whichever button
         triggered the switch -- the Lyrics row only exists in the info
         branch, so clicking it removes the very node that had focus and
         leaves it on <body>, outside the dialog trapFocus guards. Same
         idiom as the item watch above: once the new branch has rendered,
         move focus back onto the head control that survives both views. */
      view: function () {
        this.$nextTick(function () {
          var button = this.$refs.infoDialog && this.$refs.infoDialog.querySelector('button');
          if (button) button.focus();
        });
      }
    },
    methods: {
      close: function () {
        var previous = this.previousFocus;
        this.ui.infoItem = null;
        setTimeout(function () { if (previous && previous.focus) previous.focus(); }, 0);
      },
      /* :aria-label is a dynamic binding -- i18n.js's template rewrite only
         reaches static attributes and text nodes, so the dialog label has to
         resolve through the dictionary by hand, same idiom as detail.js,
         opmlview.js, filterpanel.js and browse.js. */
      tr: function (text) {
        return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
      },
      streamLabel: function (stream) {
        if (!stream) return '';
        return [LmsFmt.format(stream.format), LmsFmt.rate(stream.sampleRate), LmsFmt.depth(stream.sampleSize), stream.bitrate ? Math.round(stream.bitrate) + ' kbps' : ''].filter(Boolean).join(' · ');
      },
      headBack: function () {
        /* Never leaves the reading surface without an exit: from lyrics the
           head button returns to the information list, only closing the
           sheet once the list itself is showing. */
        if (this.view === 'lyrics' || this.view === 'signal') this.view = 'info';
        else this.close();
      },
      trapFocus: function (event) {
        if (!this.$refs.infoDialog) return;
        var nodes = Array.prototype.slice.call(this.$refs.infoDialog.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(function (node) { return node.offsetParent !== null; });
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault(); nodes[nodes.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          event.preventDefault(); nodes[0].focus();
        }
      },
      load: async function (item) {
        /* A folha e reaproveitada: watch:item dispara um load por cima do
           anterior. Sem token, abrir a faixa A (lenta), fechar e abrir a B
           fazia os creditos de A aparecerem sob o titulo de B. */
        var token = ++this.requestToken;
        this.loading = true;
        this.error = '';
        this.info = null;
        /* Reopening the sheet, whether for the same track after a close or
           for a different one entirely, always starts on the information
           list -- never on a previous track's lyrics. */
        this.view = 'info';
        try {
          var found = await LmsApi.songInfo(LmsStore.state.playerId || '', item.id);
          if (token !== this.requestToken) return;
          this.info = found;
        } catch (e) {
          if (token !== this.requestToken) return;
          this.error = e && e.message ? e.message : String(e);
        }
        if (token !== this.requestToken) return;
        this.loading = false;
      }
    },
    created: function () { if (this.item) this.load(this.item); }
  });

  Vue.component('lms-selection-bar', {
    template: `
<div v-if="ui.selectionMode" class="selection-bar">
  <button @click="cancel">Cancel</button>
  <strong>{{ selectionLabel }}</strong>
</div>`,
    data: function () { return { ui: LmsUi.state }; },
    computed: {
      values: function () {
        return Object.keys(this.ui.selected).map(function (k) { return LmsUi.state.selected[k]; });
      },
      count: function () { return this.values.length; },
      selectionLabel: function () {
        var text = this.count === 1 ? 'item selected' : 'items selected';
        if (window.LmsStr && LmsStr.t) text = LmsStr.t(text);
        return this.count + ' ' + text;
      }
    },
    methods: {
      cancel: function () { LmsUi.clearSelection(); }
    }
  });

  Vue.component('lms-favorites', {
    template: `
<div class="favorites-body">
  <div class="favourite-organize">
    <button v-if="!editing" type="button" class="text-command" @click="createFolder">New favourite folder…</button>
    <span v-else class="favourite-edit-hint">Alt + ↑/↓ moves · Delete removes · Esc finishes</span>
    <button type="button" class="text-command" :aria-pressed="String(editing)" @click="editing = !editing">
      {{ editing ? 'Done' : 'Edit' }}
    </button>
  </div>
  <section v-if="ui.pins.length" class="pinned-section">
    <div class="sectitle">Pinned</div>
    <div class="pinned-scroll">
	  <div v-for="(p, pinIndex) in ui.pins" :key="LmsUi.selectionKey(p)" class="pinned-item-wrap">
	    <button class="pinned-item"
              @click="open(p)">
        <span class="pinned-art" :style="art(p)"></span>
        <span class="ell">{{ p.title || p.label || p.name }}</span>
      </button>
	    <span class="pin-reorder"><button :disabled="pinIndex === 0" @click="movePin(pinIndex, -1)" aria-label="Move pinned item left">←</button><button :disabled="pinIndex === ui.pins.length - 1" @click="movePin(pinIndex, 1)" aria-label="Move pinned item right">→</button></span>
	  </div>
    </div>
  </section>
  <div class="favorites-list">
    <lms-opml root="favorites" tab="favourites" :editing="editing"
              @finish-edit="editing = false"></lms-opml>
  </div>
</div>`,
    data: function () { return { ui: LmsUi.state, LmsUi: LmsUi, editing: false }; },
    methods: {
      createFolder: async function () {
        var name = window.prompt('Favourite folder name');
        if (!name || !name.trim()) return;
        try {
          await LmsApi.favoriteFolderAdd(name.trim());
          LmsUi.notify('Favourite folder created.', 'success');
          this.$forceUpdate();
        } catch (e) { LmsUi.notify('Could not create the favourite folder. ' + e.message, 'error', 6500); }
      },
      art: function (item) {
        var id = item.coverId || item.artworkTrackId || (item.kind === 'album' ? item.id : null);
        var url = id ? LmsFmt.coverUrl(id, 100) : '';
        return url ? { backgroundImage: 'url(' + url + ')', backgroundSize: 'cover' } : {};
      },
      open: function (item) { LmsUi.openActions(item); }
      ,movePin: function (index, delta) { LmsUi.movePin(index, index + delta); }
    }
  });
})();
