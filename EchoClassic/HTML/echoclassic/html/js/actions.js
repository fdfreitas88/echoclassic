
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
  <div ref="sheet" class="action-sheet" :class="{anchored: !!anchor}" :style="sheetStyle"
       role="dialog" :aria-label="'Ações para ' + (item.title || item.label || item.name)"
       :aria-modal="String(!anchor)" tabindex="-1"
       @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus">
    <div class="sheet-title">
      <div class="t ell">{{ item.title || item.label || item.name }}</div>
      <div v-if="item.artist || item.sub" class="s ell">{{ item.artist || item.sub }}</div>
    </div>
    <button v-if="ctl" @click="playNow">Reproduzir agora</button>
    <button v-if="ctl" @click="next">Reproduzir a seguir</button>
    <button v-if="ctl" @click="later">Adicionar ao final da fila</button>
    <button v-if="item.url" @click="showPlaylists = !showPlaylists">Adicionar à playlist…</button>
    <div v-if="showPlaylists" class="sheet-choices">
      <button v-for="p in playlists" :key="p.id" @click="addToPlaylist(p)">{{ p.name }}</button>
      <div v-if="!playlists.length" class="sheet-note">Nenhuma playlist editável.</div>
    </div>
    <button v-if="item.url" @click="favorite">
      {{ favoriteExists ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos' }}
    </button>
    <button @click="pin">{{ pinned ? 'Remover dos itens fixados' : 'Fixar no Echo Classic' }}</button>
    <button v-if="item.kind === 'track' || item.type === 'track'" @click="info">Créditos e informações</button>
    <button v-if="!anchor" class="cancel" @click="close">Cancelar</button>
  </div>
</div>`,
    data: function () {
      return { ui: LmsUi.state, playlists: [], showPlaylists: false, busy: false,
               favoriteExists: false, favoriteIndex: null, sheetStyle: {},
               previousFocus: null };
    },
    computed: {
      item: function () { return this.ui.actionItem; },
      anchor: function () { return this.ui.actionAnchor; },
      ctl: function () { return control(this.item); },
      pinned: function () { return this.item ? LmsUi.isPinned(this.item) : false; }
    },
    watch: {
      item: function (value) {
        this.showPlaylists = false;
        this.favoriteExists = false;
        this.favoriteIndex = null;
        if (value) this.previousFocus = document.activeElement;
        if (value && value.url) {
          this.loadPlaylists();
          this.loadFavorite(value.url);
        }
        this.$nextTick(this.prepareSheet);
      },
      anchor: function () { this.$nextTick(this.positionSheet); },
      showPlaylists: function () {
        var self = this;
        this.$nextTick(function () { self.positionSheet(); });
      }
    },
    methods: {
      close: function () {
        var previous = this.previousFocus;
        LmsUi.closeActions();
        setTimeout(function () { if (previous && previous.focus) previous.focus(); }, 0);
      },
      prepareSheet: function () {
        this.positionSheet();
        if (this.$refs.sheet) {
          var first = this.$refs.sheet.querySelector('button');
          if (first) first.focus(); else this.$refs.sheet.focus();
        }
      },
      trapFocus: function (event) {
        if (this.anchor || !this.$refs.sheet) return;
        var nodes = Array.prototype.slice.call(this.$refs.sheet.querySelectorAll('button:not([disabled])'));
        if (!nodes.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault(); nodes[nodes.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          event.preventDefault(); nodes[0].focus();
        }
      },
      positionSheet: function () {
        if (!this.anchor || !this.$refs.sheet) {
          this.sheetStyle = {};
          return;
        }
        var margin = 8;
        var gap = 7;
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        var width = Math.min(320, viewportWidth - margin * 2);
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
      playNow: function () {
        var c = this.ctl;
        if (!c) return;
        var self = this;
        LmsStore.playContainer(c.key, c.id, 0).then(function (ok) { if (ok !== false) self.close(); });
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
      loadFavorite: async function (url) {
        try {
          var found = await LmsApi.favoriteExists(url);
          if (!this.item || this.item.url !== url) return;
          this.favoriteExists = found.exists;
          this.favoriteIndex = found.index;
        } catch (e) {}
      },
      favorite: async function () {
        if (!this.item || !this.item.url) return;
        this.busy = true;
        LmsUi.setBusy('Atualizando favoritos…');
        try {
          if (this.favoriteExists && this.favoriteIndex !== null) {
            await LmsApi.favoriteRemove(this.favoriteIndex);
          } else {
            await LmsApi.favoriteAdd(this.item.url, this.item.title || this.item.label);
          }
          this.close();
        } catch (e) {
          LmsUi.notify('Não foi possível atualizar os favoritos. ' + e.message, 'error', 6500);
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
        try { this.playlists = await LmsApi.playlists(0, 500); }
        catch (e) { this.playlists = []; }
      },
      addToPlaylist: async function (playlist) {
        if (!this.item || !this.item.url || this.busy) return;
        this.busy = true;
        LmsUi.setBusy('Adicionando à playlist…');
        try {
          await LmsApi.editPlaylist(playlist.id, 'add', {
            title: this.item.title || this.item.label,
            url: this.item.url
          });
          this.close();
        } catch (e) {
          LmsUi.notify('Não foi possível adicionar à playlist. ' + e.message, 'error', 6500);
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
           aria-label="Informações da faixa" tabindex="-1"
           @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus">
    <div class="info-head">
      <button class="back-command" @click="close">Concluído</button>
      <div class="ttl">Informações</div>
    </div>
    <div v-if="loading" class="empty"><div class="p">Carregando…</div></div>
    <div v-else-if="error" class="empty">
      <div class="p">{{ error }}</div>
      <button class="retry-command" @click="load(item)">Tentar novamente</button>
    </div>
    <div v-else-if="info" class="info-content scroller">
      <div class="info-title">{{ info.title || item.title }}</div>
      <div class="info-sub">{{ [info.artist, info.album].filter(Boolean).join(' — ') }}</div>
      <div class="sgh">Lançamento</div>
      <div class="sgroup">
        <div class="srow">Ano desta edição <span class="v">{{ info.year || 'Não informado' }}</span></div>
        <div class="srow">Ano original <span class="v">{{ info.originalYear || 'Não informado' }}</span></div>
        <div v-if="info.releaseType" class="srow">Tipo <span class="v">{{ info.releaseType }}</span></div>
      </div>
      <div class="sgh">Créditos</div>
      <div class="sgroup">
        <div v-if="info.albumArtist" class="srow">Artista do álbum <span class="v">{{ info.albumArtist }}</span></div>
        <div v-if="info.composer" class="srow">Composição <span class="v">{{ info.composer }}</span></div>
        <div v-if="info.conductor" class="srow">Regência <span class="v">{{ info.conductor }}</span></div>
        <div v-if="info.band" class="srow">Conjunto <span class="v">{{ info.band }}</span></div>
        <div v-if="!info.albumArtist && !info.composer && !info.conductor && !info.band"
             class="srow"><span class="muted">Créditos não informados nos metadados.</span></div>
      </div>
      <div class="sgh">Biblioteca</div>
      <div class="sgroup">
        <div class="srow">Avaliação <span class="v">{{ stars }}</span></div>
        <div class="srow">Reproduções <span class="v">{{ info.playCount || 0 }}</span></div>
        <div v-if="info.genre" class="srow">Gênero <span class="v">{{ info.genre }}</span></div>
      </div>
      <div class="sgh">Arquivo</div>
      <div class="sgroup">
        <div class="srow">Formato <span class="v">{{ info.format || '—' }}</span></div>
        <div class="srow">Resolução <span class="v">{{ resolution }}</span></div>
        <div v-if="info.bitrate" class="srow">Bitrate <span class="v">{{ Math.round(info.bitrate / 1000) }} kbps</span></div>
      </div>
    </div>
  </section>
</div>`,
    data: function () {
      return { ui: LmsUi.state, info: null, loading: false, error: '', previousFocus: null };
    },
    computed: {
      item: function () { return this.ui.infoItem; },
      stars: function () {
        var rating = Math.max(0, Math.min(5, Math.round((this.info && this.info.rating || 0) / 20)));
        return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(rating);
      },
      resolution: function () {
        if (!this.info) return '—';
        var rate = LmsFmt.rate(this.info.sampleRate);
        var depth = LmsFmt.depth(this.info.sampleSize);
        return [rate, depth].filter(Boolean).join(' / ') || '—';
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
      }
    },
    methods: {
      close: function () {
        var previous = this.previousFocus;
        this.ui.infoItem = null;
        setTimeout(function () { if (previous && previous.focus) previous.focus(); }, 0);
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
        this.loading = true;
        this.error = '';
        this.info = null;
        try { this.info = await LmsApi.songInfo(LmsStore.state.playerId || '', item.id); }
        catch (e) { this.error = e && e.message ? e.message : String(e); }
        this.loading = false;
      }
    },
    created: function () { if (this.item) this.load(this.item); }
  });

  Vue.component('lms-selection-bar', {
    template: `
<div v-if="ui.selectionMode" class="selection-bar">
  <button @click="cancel">Cancelar</button>
  <strong>{{ count }} selecionado{{ count === 1 ? '' : 's' }}</strong>
</div>`,
    data: function () { return { ui: LmsUi.state }; },
    computed: {
      values: function () {
        return Object.keys(this.ui.selected).map(function (k) { return LmsUi.state.selected[k]; });
      },
      count: function () { return this.values.length; }
    },
    methods: {
      cancel: function () { LmsUi.clearSelection(); }
    }
  });

  Vue.component('lms-favorites', {
    template: `
<div class="favorites-body">
  <section v-if="ui.pins.length" class="pinned-section">
    <div class="sectitle">Fixados</div>
    <div class="pinned-scroll">
      <button v-for="p in ui.pins" :key="LmsUi.selectionKey(p)" class="pinned-item"
              @click="open(p)">
        <span class="pinned-art" :style="art(p)"></span>
        <span class="ell">{{ p.title || p.label || p.name }}</span>
      </button>
    </div>
  </section>
  <div class="favorites-list">
    <lms-opml root="favorites" tab="favoritos"></lms-opml>
  </div>
</div>`,
    data: function () { return { ui: LmsUi.state, LmsUi: LmsUi }; },
    methods: {
      art: function (item) {
        var id = item.coverId || item.artworkTrackId || (item.kind === 'album' ? item.id : null);
        var url = id ? LmsFmt.coverUrl(id, 100) : '';
        return url ? { backgroundImage: 'url(' + url + ')', backgroundSize: 'cover' } : {};
      },
      open: function (item) { LmsUi.openActions(item); }
    }
  });
})();