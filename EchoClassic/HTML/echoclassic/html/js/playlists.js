
/* Playlists. The server's own list, not a synthesised one: this library holds 19
   of them, all imported from Qobuz. Selecting one pushes a frame, which is what
   gives the nav bar its back button. */
Vue.component('lms-playlists', {
  template: `
<div class="scroller">
  <div v-if="loading" class="empty"><div class="p">Loading…</div></div>
  <div v-else-if="error" class="empty">
    <div class="h">Could not read the playlists</div><div class="p">{{ error }}</div>
    <button class="retry-command" @click="retry">Try again</button>
  </div>

  <template v-else-if="frame">
    <div style="display:flex">
      <div style="flex:1;min-width:0">
        <div class="albhead">
          <input v-if="editing" v-model="editName" class="playlist-name-input"
                 aria-label="Nome da playlist" @keyup.enter="rename">
          <div v-else class="big ell">{{ frame.label }}</div>
        </div>
        <div class="albsub">{{ tracks.length }} {{ tracks.length === 1 ? 'song' : 'songs' }}<span v-if="total"> • {{ total }}</span></div>
        <div class="acts-row">
          <button class="playlist-command pointer" @click="playAll">Play</button>
          <button class="playlist-command pointer" @click="shuffle">Shuffle</button>
          <button class="playlist-command pointer"
                  @click="toggleEdit">{{ editing ? 'Done' : 'Editar' }}</button>
          <button v-if="editing && selectedCount" class="playlist-command pointer"
                  @click="removeSelected">Remove {{ selectedCount }}</button>
	          <button v-if="editing" class="playlist-command destructive pointer"
	                  @click="confirmDelete = true">Delete playlist</button>
        </div>
	        <div v-for="t in tracks" :key="t.id" class="trow"
	             :class="{playing: store.np.id === t.id, chosen: isSelected(t)}"
	             role="group" :aria-label="trackLabel(t)">
	          <button type="button" class="trow-main pointer" :aria-label="trackLabel(t)"
	                  @click="trackClick(t)">
	            <span v-if="editing" class="select-mark" :class="{on: isSelected(t)}"></span>
	            <span class="cover" :style="t.coverId ? {backgroundImage:'url(' + cover(t) + ')', backgroundSize:'cover'} : {}"></span>
	            <span class="ell">
	              <span class="t ell">{{ t.title }}</span>
	              <span class="s ell">{{ t.artist }}</span>
	            </span>
	            <span v-if="hires(t)" class="spec">{{ shortRate(t) }}</span>
	            <span class="dur">{{ dur(t.duration) }}</span>
	          </button>
	          <template v-if="editing">
	            <button class="reorder-command" title="Move up"
	                    :aria-label="'Move ' + t.title + ' up'" @click.stop="move(t, -1)">↑</button>
	            <button class="reorder-command" title="Move down"
	                    :aria-label="'Move ' + t.title + ' down'" @click.stop="move(t, 1)">↓</button>
	          </template>
	          <button v-else class="more-command" title="More actions"
	                  :aria-label="'More actions for ' + t.title"
	                  @click.stop="actions(t, $event)">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle class="more-ring" cx="12" cy="12" r="8.5"/>
              <circle class="more-dot" cx="8.5" cy="12" r="1"/>
              <circle class="more-dot" cx="12" cy="12" r="1"/>
              <circle class="more-dot" cx="15.5" cy="12" r="1"/>
            </svg>
          </button>
        </div>
        <button v-if="tracksHasMore" class="load-more-command" :disabled="tracksLoadingMore"
                @click="loadMoreTracks">
          {{ tracksLoadingMore ? 'Loading…' : 'Load more songs' }}
        </button>
        <div v-if="!tracks.length" class="empty"><div class="p">This playlist has no songs yet.</div></div>
      </div>
    </div>
  </template>

  <template v-else>
	    <button v-if="!creating" type="button" class="row noart pointer newpl"
	            @click="startCreate">
	      <span class="favicon">
	        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
	      </span>
	      <span class="ell"><span class="t ell">New playlist…</span></span>
	    </button>
    <div v-else class="opsearch">
      <input ref="newname" v-model="newName" placeholder="Nome da playlist"
             @keyup.enter="doCreate" @keyup.esc="creating = false">
      <button class="opsearch-action pointer" @click="doCreate">Criar</button>
      <button class="opsearch-action secondary pointer" @click="creating = false">Cancel</button>
    </div>
	    <div v-if="notice" class="optext">{{ notice }}</div>
	    <div v-if="lists.length > 30" class="opsearch">
	      <input v-model="filter" type="search" placeholder="Filtrar playlists"
	             aria-label="Filtrar playlists">
	    </div>

	    <button v-for="p in filteredLists" :key="p.id" type="button" class="row noart pointer"
	            @click="open(p)">
	      <span class="ell"><span class="t ell">{{ p.name }}</span></span>
	      <span v-if="p.source && p.source !== 'Local library'" class="playlist-source">{{ p.source }}</span>
	      <svg class="ic chev" style="width:9px;height:15px" viewBox="0 0 9 15"><path d="M1 1l6.5 6.5L1 14"/></svg>
	    </button>
	    <div v-if="!filteredLists.length" class="optext">
	      {{ lists.length ? 'No playlist matches this filter.' : 'No saved playlists. Tap “New playlist…” to create the first one.' }}
	    </div>
  </template>

  <div v-if="confirmDelete" class="confirm-stage" role="dialog" aria-modal="true"
       aria-labelledby="delete-playlist-title">
    <div class="confirm-back" @click="confirmDelete = false"></div>
    <div class="confirm-panel">
      <strong id="delete-playlist-title">Delete “{{ frame.label }}”?</strong>
      <span>This removes the playlist from LMS.</span>
      <button class="destructive" @click="remove">Delete playlist</button>
      <button @click="confirmDelete = false">Cancel</button>
    </div>
  </div>
</div>`,
  data: function () {
	    return { store: LmsStore.state, lists: [], tracks: [], filter: '', loading: true, error: '',
             creating: false, newName: '', notice: '', editing: false,
             editName: '', selected: {}, tracksHasMore: false,
             tracksLoadingMore: false, tracksPageSize: 250, confirmDelete: false };
  },
  computed: {
    frame: function () { return LmsNav.top('playlists'); },
    total: function () {
      var s = this.tracks.reduce(function (a, t) { return a + (t.duration || 0); }, 0);
      return s ? LmsFmt.longDuration(s) : '';
    },
	    selectedCount: function () { return Object.keys(this.selected).length; },
	    filteredLists: function () {
	      var q = this.normalize(this.filter);
	      if (!q) return this.lists;
	      return this.lists.filter(function (p) {
	        return this.normalize([p.name, p.source].filter(Boolean).join(' ')).indexOf(q) >= 0;
	      }, this);
	    }
	  },
  watch: {
    frame: function (f) { if (f) this.loadTracks(f); }
  },
  methods: {
    dur: function (s) { return LmsFmt.duration(s); },
    cover: function (t) { return LmsFmt.coverUrl(t.coverId, 50); },
    hires: function (t) { return LmsFmt.isHiRes(t.sampleRate, t.sampleSize); },
	    shortRate: function (t) {
	      if (!t.sampleRate) return '';
	      return t.sampleRate >= 2822400 ? 'DSD' : Math.round(t.sampleRate / 1000) + 'k';
	    },
	    trackLabel: function (t) {
	      return [t.title, t.artist, t.album].filter(Boolean).join(', ');
	    },
	    normalize: function (value) {
	      var s = String(value || '').toLowerCase();
	      return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
	    },
    open: function (p) { LmsNav.push('playlists', { kind: 'playlist', id: p.id, label: p.name }); },
    startCreate: function () {
      this.creating = true;
      this.notice = '';
      var self = this;
      this.$nextTick(function () { if (self.$refs.newname) self.$refs.newname.focus(); });
    },
    runOperation: async function (label, action) {
      LmsUi.setBusy(label);
      try {
        return await action();
      } catch (e) {
        var message = e && e.message ? e.message : String(e);
        this.error = message;
        /* Mesma regra do store.js: frase montada por concatenacao nunca casa
           inteira no dicionario, entao cada pedaco e traduzido sozinho. */
        var tr = (window.LmsStr && LmsStr.t) || function (s) { return s; };
        LmsUi.notify(tr(label) + ' ' + tr('failed.') + ' ' + message, 'error', 6500);
        return false;
      } finally {
        LmsUi.setBusy('');
      }
    },
    doCreate: async function () {
      var name = (this.newName || '').trim();
      if (!name) return;
      var self = this;
      await this.runOperation('Criando playlist…', async function () {
        var r = await LmsApi.createPlaylist(name);
        self.notice = r.existed
          ? 'A playlist with that name already existed; it was reused.'
          : '';
        self.creating = false;
        self.newName = '';
        await self.load();
      });
    },
    playTrack: function (t) {
      var i = this.tracks.findIndex(function (x) { return x.id === t.id; });
      LmsStore.playContainer('playlist_id', this.frame.id, i > 0 ? i : 0);
    },
    trackItem: function (t) {
      return {
        kind: 'track', id: t.id, title: t.title, artist: t.artist,
        album: t.album, url: t.url, coverId: t.coverId
      };
    },
    trackClick: function (t) {
      if (!this.editing) return this.playTrack(t);
      var key = String(t.index);
      if (this.selected[key]) this.$delete(this.selected, key);
      else this.$set(this.selected, key, t);
    },
    isSelected: function (t) { return !!this.selected[String(t.index)]; },
    actions: function (t, event) {
      LmsUi.openActions(this.trackItem(t), event && event.currentTarget);
    },
    toggleEdit: async function () {
      if (this.editing && this.editName.trim() !== this.frame.label && await this.rename() === false) return;
      this.editing = !this.editing;
      this.editName = this.frame.label;
      this.selected = {};
    },
    rename: async function () {
      var name = this.editName.trim();
      if (!name || name === this.frame.label) return;
      var self = this;
      return this.runOperation('Renomeando playlist…', async function () {
        await LmsApi.renamePlaylist(self.frame.id, name);
        self.frame.label = name;
        await self.load();
      });
    },
    move: async function (t, delta) {
      var to = t.index + delta;
      if (to < 0 || to >= this.tracks.length) return;
      var self = this;
      await this.runOperation('Reordenando playlist…', async function () {
        await LmsApi.editPlaylist(self.frame.id, 'move', { index: t.index, toIndex: to });
        await self.loadTracks(self.frame);
      });
    },
    removeSelected: async function () {
      var indices = Object.keys(this.selected).map(Number).sort(function (a, b) { return b - a; });
      var self = this;
      await this.runOperation('Removing songs…', async function () {
        for (var i = 0; i < indices.length; i++) {
          await LmsApi.editPlaylist(self.frame.id, 'delete', { index: indices[i] });
        }
        self.selected = {};
        await self.loadTracks(self.frame);
      });
    },
    playAll: function () {
      if (this.tracks.length) LmsStore.playContainer('playlist_id', this.frame.id, 0);
    },
    shuffle: function () {
      if (!this.tracks.length) return;
      var id = this.frame.id;
      LmsStore.playContainer('playlist_id', id, 0).then(function (ok) {
        if (ok !== false) return LmsStore.cycleShuffle();
      });
    },
    remove: async function () {
      var f = this.frame;
      if (!f) return;
      this.confirmDelete = false;
      await this.runOperation('Apagando playlist…', async function () {
        await LmsApi.deletePlaylist(f.id);
        LmsNav.reset('playlists');
      });
    },
    loadTracks: async function (f, append) {
      if (append) this.tracksLoadingMore = true;
      else this.loading = true;
      this.error = '';
      if (!append) this.tracks = [];
      this.editName = f.label;
      try {
        var start = append ? this.tracks.length : 0;
        var page = await LmsApi.playlistTracks(f.id, start, this.tracksPageSize);
        var sourceCount = page.sourceCount == null ? page.length : page.sourceCount;
        this.tracks = append ? this.tracks.concat(page) : page;
        this.tracksHasMore = sourceCount === this.tracksPageSize;
      } catch (e) {
        this.error = e && e.message ? e.message : String(e);
      }
      this.loading = false;
      this.tracksLoadingMore = false;
    },
    loadMoreTracks: function () { return this.loadTracks(this.frame, true); },
    retry: function () { return this.frame ? this.loadTracks(this.frame) : this.load(); },
    load: async function () {
      this.loading = true;
      this.error = '';
      try {
        this.lists = await LmsApi.playlists(0, 500);
      } catch (e) {
        this.error = e && e.message ? e.message : String(e);
      }
      this.loading = false;
    }
  },
  created: function () {
    var f = this.frame;
    if (f) this.loadTracks(f); else this.load();
  }
});
