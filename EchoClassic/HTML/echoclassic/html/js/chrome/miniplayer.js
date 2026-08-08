
/* Always-visible bottom bar. Reads LmsStore and never writes to it directly.
   The spec puts the rate and depth badges here as well as in the full-screen
   player, which is a deliberate departure from iOS 9 — the whole reason this
   skin exists is to show what actually reaches the DAC. */
Vue.component('lms-miniplayer', {
  template: `
<div class="mini" :class="{empty: !hasTrack, inactive: ui.full}" v-bind="surfaceAttrs">
  <div v-if="!ui.full && hasTrack" class="transport">
	    <button type="button" class="mini-action mini-prev pointer" title="Previous"
	            aria-label="Previous track" @click="prev">
      <svg class="ic fill" viewBox="0 0 24 24"><path d="M11 12L20 6v12zM2 12l9-6v12z"/></svg>
    </button>
	    <button type="button" class="mini-action pointer" :title="playing ? 'Pause' : 'Play'"
	            :aria-label="playing ? 'Pause' : 'Play'"
	            @click="playing ? pause() : play()">
      <svg v-if="playing" class="ic fill" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
      <svg v-else class="ic fill" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>
    </button>
	    <button type="button" class="mini-action pointer" title="Stop" aria-label="Stop" @click="stop">
      <svg class="ic fill" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
    </button>
	    <button type="button" class="mini-action pointer" title="Next" aria-label="Next track" @click="next">
      <svg class="ic fill" viewBox="0 0 24 24"><path d="M13 12L4 18V6zM22 12l-9 6V6z"/></svg>
    </button>
  </div>
  <button v-if="!ui.full" type="button" class="np" :class="{pointer: hasTrack}"
          :disabled="!hasTrack" :aria-label="openLabel" @click="open">
    <span v-if="hasTrack" class="mini-cover" :class="{placeholder: !coverUrl || coverFailed}">
      <img v-if="coverUrl && !coverFailed" :src="coverUrl" alt="" @error="coverFailed = true">
      <span v-else aria-hidden="true">♫</span>
    </span>
    <span class="mini-copy">
      <span class="t ell">{{ hasTrack ? np.title : 'Nothing playing' }}</span>
      <span class="s ell" v-if="hasTrack && (np.artist || np.album)">{{ subtitle }}</span>
      <span v-if="hasTrack && !np.live" class="mini-progress">
        <span class="mini-time">{{ elapsed }}</span>
        <span class="mini-gauge"><i :style="{width: progress + '%'}"></i></span>
        <span class="mini-time">-{{ remaining }}</span>
      </span>
      <span v-else-if="hasTrack" class="mini-live">LIVE</span>
      <span class="badges mini-badges" v-if="hasTrack && ui.showBadges && badges.length">
        <span v-for="b in badges" :key="b.text" class="badge" :class="{hi: b.hi}">{{ b.text }}</span>
      </span>
    </span>
  </button>
  <div v-if="!ui.full" class="r">
    <button type="button" class="mini-action queuebtn pointer" title="Playback queue"
            aria-label="Playback queue" @click="$emit('queue')">
      <svg class="ic" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
      <span class="queue-label">Playback queue</span>
    </button>
  </div>
</div>`,
  data: function () {
    return { store: LmsStore.state, ui: LmsUi.state, coverFailed: false };
  },
  computed: {
    /* Mini is always the 'mini' surface -- there is only one on screen. */
    surfaceAttrs: function () { return LmsUi.surfaceAttrs('mini'); },
    np: function () { return this.store.np; },
    hasTrack: function () {
      return this.np.id != null || !!this.np.title || !!this.np.url;
    },
    /* Descreve apenas se ha som saindo. Nao serve para decidir o que a barra
       mostra: com a fila carregada e o player parado ainda existe faixa
       corrente, e o player cheio precisa continuar alcancavel. */
    activePlayback: function () {
      return this.hasTrack && this.store.mode !== 'stop';
    },
    openLabel: function () {
      if (!this.hasTrack) return 'Nothing playing';
      return 'Abrir o player' + (this.np.title ? ': ' + this.np.title : '');
    },
    playing: function () { return this.store.mode === 'play'; },
    coverUrl: function () { return LmsFmt.coverUrl(this.np.coverId, 50); },
    subtitle: function () {
      var parts = [];
      if (this.np.artist) parts.push(this.np.artist);
      if (this.np.album) parts.push(this.np.album);
      return parts.join(' — ');
    },
    progress: function () {
      // a live stream has no position to show
      if (this.np.live || !this.store.duration) return 0;
      return Math.min(100, this.store.time / this.store.duration * 100);
    },
    elapsed: function () { return LmsFmt.duration(this.store.time); },
    remaining: function () {
      return LmsFmt.duration(Math.max(0, this.store.duration - this.store.time));
    },
    badges: function () {
      var out = [];
      /* Cada etiqueta responde pelo proprio numero: um rip 44,1 kHz/24 bits so
         destaca a profundidade, nunca a taxa. */
      var mark = this.ui.markHires;
      var r = LmsFmt.rate(this.np.sampleRate);
      var d = LmsFmt.depth(this.np.sampleSize);
      if (r) out.push({ text: r, hi: mark && LmsFmt.isHiRes(this.np.sampleRate, 0) });
      if (d) out.push({ text: d, hi: mark && LmsFmt.isHiRes(0, this.np.sampleSize) });
      if (this.np.format) out.push({ text: LmsFmt.format(this.np.format), hi: false });
      return out;
    }
  },
  watch: {
    'np.id': function () { this.coverFailed = false; }
  },
  methods: {
    open: function () { if (this.hasTrack) this.$emit('full'); },
    play: function () { LmsStore.play(); },
    pause: function () { LmsStore.pause(); },
    stop: function () { LmsStore.stop(); },
    next: function () { LmsStore.next(); },
    prev: function () { LmsStore.prev(); }
  }
});
