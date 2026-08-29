
/* Now Playing em tela cheia em qualquer viewport. A composicao segue a
   hierarquia do iPod classic: capa, informacao da faixa, gauge, transporte,
   volume e opcoes.

   Estacao ao vivo nao tem posicao: a barra fica em zero e o lado direito diz
   AO VIVO em vez de um tempo restante negativo. */
Vue.component('lms-nowplaying', {
  props: {
    fullscreen: { type: Boolean, default: false }
  },
  template: `
<div class="npstage" :class="fullscreen ? 'mode-fullscreen' : 'mode-adaptive'" v-bind="surfaceAttrs">
  <div class="npback" @click="close"></div>
  <section ref="dialog" class="npfull" :class="{'with-queue': ui.queueInline}"
           role="dialog" :aria-modal="String(isModal)" aria-label="Now playing"
           tabindex="-1" @keydown.tab="trapFocus" @keydown.esc.stop.prevent="close"
           @keydown="onPlayerKey">
    <button v-if="!ui.kioskMode" type="button" class="dismiss pointer" title="Close" aria-label="Close player" @click="close">
      <svg viewBox="0 0 24 12"><path d="M3 3l9 6 9-6"/></svg>
    </button>
    <button v-if="!fullscreen && !ui.kioskMode" type="button" class="player-position pointer"
	            :title="positionTitle" :aria-label="positionTitle" @click="cyclePosition">
      <svg viewBox="0 0 30 20" aria-hidden="true">
        <rect x="1" y="2" width="8" height="16" rx="1"
              :class="{active: ui.playerPosition === 'left'}"/>
        <rect x="11" y="2" width="8" height="16" rx="1"
              :class="{active: ui.playerPosition === 'center'}"/>
        <rect x="21" y="2" width="8" height="16" rx="1"
              :class="{active: ui.playerPosition === 'right'}"/>
      </svg>
    </button>
    <button v-if="!ui.kioskMode" type="button" class="player-size pointer"
	            :title="fullscreen ? 'Back to adaptive mode' : 'Show full screen'"
	            :aria-label="fullscreen ? 'Back to adaptive mode' : 'Show full screen'"
	            @click="toggleFullscreen">
      <svg v-if="fullscreen" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/>
      </svg>
    </button>
    <button v-if="ui.kioskMode" type="button" class="kiosk-exit pointer"
            title="Exit kiosk mode" aria-label="Exit kiosk mode" @click="close">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
    </button>

    <div class="cover" :class="{placeholder: !coverUrl || coverFailed}">
      <img v-if="coverUrl && !coverFailed" :src="coverUrl" alt="" @error="coverFailed = true">
      <span v-else class="art-placeholder" aria-hidden="true">♫</span>
    </div>

    <div class="head">
      <div class="t ell" :title="np.title || 'Nothing playing'"
           :aria-label="np.title || 'Nothing playing'">{{ np.title || 'Nothing playing' }}</div>
      <button type="button" class="np-player-row pointer" :aria-label="playerPickerLabel"
              @click="openPlayerPicker">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h3l5 4V5L7 9z"/></svg>
        <span class="ell">{{ activePlayerName }}</span>
        <svg class="chevron" viewBox="0 0 12 20" aria-hidden="true"><path d="M2 2l8 8-8 8"/></svg>
      </button>
      <div class="s ell" :title="subtitle" :aria-label="subtitle">{{ subtitle }}</div>
    </div>

    <div v-if="hasTrack" class="scrub">
      <div class="bar">
        <i :style="{width: pct + '%'}"></i><b :style="{left: 'calc(' + pct + '% - 12px)'}"></b>
        <input class="range-hit" type="range" min="0" :max="store.duration || 1"
               step="1" :value="seekValue" :disabled="np.live || !store.duration || !store.commandable"
               aria-label="Track position" @input="previewSeek"
               @pointercancel="cancelSeek" @change="commitSeek">
      </div>
      <div class="times">
        <span>{{ elapsed }}</span>
        <span v-if="!np.live">-{{ remaining }}</span>
        <span v-else class="live">LIVE</span>
      </div>
    </div>

    <!-- STATE-01: mesma regra do mini player -- a faixa fica como ultima
         conhecida, o comando sem destino nao. -->
    <div v-if="hasTrack" class="transport">
	      <button type="button" class="np-action previous pointer" title="Previous" aria-label="Previous track"
	              :disabled="!store.commandable" @click="prev">
        <svg viewBox="0 0 32 32"><path d="M15 16L28 7v18zM4 16l11-9v18z"/></svg>
      </button>
	      <button type="button" class="np-action playpause pointer" :title="playing ? 'Pause' : 'Play'"
	              :aria-label="playing ? 'Pause' : 'Play'"
	              :disabled="!store.commandable" @click="toggle">
        <svg v-if="playing" viewBox="0 0 32 32"><rect x="6" y="4" width="7" height="24" rx="1"/><rect x="19" y="4" width="7" height="24" rx="1"/></svg>
        <svg v-else viewBox="0 0 32 32"><path d="M8 4l20 12L8 28z"/></svg>
      </button>
	      <button type="button" class="np-action stop pointer" title="Stop" aria-label="Stop"
	              :disabled="!store.commandable" @click="stop">
        <svg viewBox="0 0 32 32"><rect x="7" y="7" width="18" height="18" rx="1"/></svg>
      </button>
	      <button type="button" class="np-action next pointer" title="Next" aria-label="Next track"
	              :disabled="!store.commandable" @click="next">
        <svg viewBox="0 0 32 32"><path d="M17 16L4 25V7zM28 16l-11 9V7z"/></svg>
      </button>
    </div>

    <div class="bottom">
      <div class="vol" :class="{fixed: !store.volumeControllable}" :title="volumeTitle">
        <button type="button" class="volume-step quiet pointer" aria-label="Volume down"
                :disabled="!store.volumeControllable" @click="stepVolume(-ui.volumeStep)"><svg class="mono" viewBox="0 0 24 24"><path d="M4 9v6h3l5 4V5L7 9z"/></svg></button>
        <div class="vbar">
          <i :style="{width: volPct + '%'}"></i>
          <b :style="{left: 'calc(' + volPct + '% - 12px)'}"></b>
          <input class="range-hit" type="range" min="0" max="100" step="1"
                 :value="volumeValue" :disabled="!store.volumeControllable"
                 :title="store.volumeControllable ? 'Volume' : 'Disabled: set the volume on the DAC'"
                 aria-label="Volume" @pointerdown="beginVolume"
                 @pointercancel="cancelVolume" @pointerup="releaseVolume"
                 @lostpointercapture="releaseVolume"
                 @input="previewVolume" @change="commitVolume">
        </div>
        <button type="button" class="volume-step loud pointer" aria-label="Volume up"
                :disabled="!store.volumeControllable" @click="stepVolume(ui.volumeStep)"><svg class="mono" viewBox="0 0 24 24"><path d="M3 9v6h3l5 4V5L6 9zM15 9a4 4 0 010 6M18 6.5a8 8 0 010 11"/></svg></button>
      </div>
      <button type="button" class="volume-mode pointer"
	              :class="{fixed: store.fixedVolume, unsynced: !store.volumeModeSynced}"
	              role="switch" :aria-checked="String(!store.fixedVolume)"
	              :aria-label="volumeModeTitle"
	              :disabled="store.volumeModeBusy || !store.connected"
              @click="toggleVolumeMode">
        <span class="volume-mode-copy">
          <strong>{{ ui.queueInline ? compactVolumeModeTitle : volumeModeTitle }}</strong>
          <small v-if="!ui.queueInline">{{ volumeModeDetail }}</small>
        </span>
        <span class="volume-mode-switch" aria-hidden="true"><i></i></span>
      </button>
    </div>

    <div class="np-secondary">
      <button type="button" class="secondary-action pointer"
              :title="favoriteLabel" :aria-label="favoriteLabel"
              :aria-pressed="String(store.npFavorite)" @click="favorite">
        <svg class="heart" :class="{on: store.npFavorite}" aria-hidden="true"
             viewBox="0 0 24 24"><path d="M12 20s-7-4.6-7-9.3A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.7c0 4.7-7 9.3-7 9.3z"/></svg>
      </button>
      <div class="np-signal" v-if="badges.length || signalPathText || replayGainText"
           aria-live="polite" :title="signalPathTitle">
        <div class="specs" v-if="badges.length" aria-label="Output stream">
          <span v-for="b in badges" :key="b.text" class="badge" :class="{hi: b.hi}">{{ b.text }}</span>
        </div>
        <div class="signal-path" v-if="signalPathText">
          <span v-if="np.isTranscoded" class="transcoded">Transcoded</span>
          <span>{{ signalPathText }}</span>
          <span v-if="replayGainText">{{ replayGainText }}</span>
        </div>
      </div>
      <button v-if="store.equalizer.status === 'ready'" type="button"
              class="secondary-action player-equalizer-command pointer"
              :class="{on: store.equalizer.settings && !store.equalizer.settings.Client.Bypass}"
              title="Equalizer" aria-label="Equalizer" @click="openEqualizer">
        <svg viewBox="0 0 20 20" aria-hidden="true"><g><path d="M4 2.5v15M10 2.5v15M16 2.5v15"/><circle cx="4" cy="12" r="2.2"/><circle cx="10" cy="6" r="2.2"/><circle cx="16" cy="10" r="2.2"/></g></svg>
      </button>
      <button type="button" class="secondary-action pointer" :class="{on: ui.queueInline}"
            :title="ui.queueInline ? 'Hide queue' : 'Show queue'"
            :aria-label="ui.queueInline ? 'Hide queue' : 'Show queue'"
            :aria-pressed="String(ui.queueInline)" @click="toggleQueueInline">
        <svg class="mono queue-toggle" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
      </button>
    </div>

    <div class="np-tools">
      <button type="button" :class="{on: store.shuffle}" :aria-pressed="String(!!store.shuffle)" @click="shuffle">{{ shuffleLabel }}</button>
      <button type="button" :class="{on: store.repeat}" :aria-pressed="String(!!store.repeat)" @click="repeat">{{ repeatLabel }}</button>
      <button type="button" v-if="np.id" @click="info">Information</button>
    </div>
    <div v-if="store.canRate && np.id" class="rating-row" aria-label="Rating">
      <button type="button" v-for="n in 5" :key="n" :class="{on: n <= rating}" @click="rate(n)"
              :aria-label="ratingLabel(n)">★</button>
      <span>{{ playCount }} {{ playCount === 1 ? 'playback' : 'plays' }}</span>
    </div>

    <lms-queue v-if="ui.queueInline" :inline="true"></lms-queue>
  </section>
</div>`,
  data: function () {
    return {
      ui: LmsUi.state, store: LmsStore.state,
      dragTime: null, dragVolume: null, coverFailed: false,
      viewportWidth: window.innerWidth, previousFocus: null
    };
  },
  computed: {
    /* This one component serves both the 'small' (adaptive/inline) and
       'full' (fullscreen) surfaces -- the fullscreen prop already carries
       that distinction, so it also picks the surface name. */
    surfaceAttrs: function () {
      return LmsUi.surfaceAttrs(this.fullscreen ? 'full' : 'small');
    },
    np: function () { return this.store.np; },
    hasTrack: function () {
      return this.np.id != null || !!this.np.title || !!this.np.url;
    },
    playing: function () { return this.store.mode === 'play'; },
    isModal: function () {
      return this.fullscreen || this.ui.playerPosition === 'center' || this.viewportWidth < 900;
    },
    subtitle: function () {
      var parts = [];
      if (this.np.artist) parts.push(this.np.artist);
      if (this.np.album) parts.push(this.np.album);
      return parts.join(' — ');
    },
    /* Nome do servidor, nunca traduzido -- so o texto fixo da linha e que
       precisa do dicionario. */
    activePlayerName: function () {
      var id = this.store.playerId;
      var found = (this.store.players || []).filter(function (p) { return p.id === id; })[0];
      return found ? found.name : 'No player';
    },
    /* Vai para um :aria-label, que e binding dinamico e portanto nao passa
       pela reescrita de template -- a traducao acontece aqui, na mao. */
    playerPickerLabel: function () {
      var text = 'Change player';
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    seekValue: function () {
      return this.dragTime === null ? this.store.time : this.dragTime;
    },
    pct: function () {
      if (this.np.live || !this.store.duration) return 0;
      return Math.min(100, this.seekValue / this.store.duration * 100);
    },
    elapsed: function () { return LmsFmt.duration(this.seekValue); },
    remaining: function () {
      return LmsFmt.duration(Math.max(0, this.store.duration - this.seekValue));
    },
    volumeValue: function () {
      return this.dragVolume === null ? this.store.volume : this.dragVolume;
    },
    volPct: function () { return this.store.volumeControllable ? this.volumeValue : 100; },
    volumeTitle: function () {
      if (this.store.fixedVolume && this.store.useVolumeControl) return this.tr('External amplifier volume');
      return this.tr(this.store.volumeControllable ? 'Volume' : 'Fixed volume on server');
    },
    volumeModeTitle: function () {
      if (this.store.volumeModeBusy) return 'Confirming volume mode…';
      return this.store.fixedVolume ? 'Fixed output (no attenuation)' : 'Volume controlled by LMS';
    },
    volumeModeDetail: function () {
      if (!this.store.volumeModeSynced) return 'Not confirmed by LMS';
      return this.store.fixedVolume ? 'Set the volume on the DAC' : 'LMS adjusts the output level';
    },
    compactVolumeModeTitle: function () {
      if (this.store.volumeModeBusy) return this.tr('Confirming…');
      return this.store.fixedVolume ? 'Fixed output' : 'LMS volume';
    },
    coverUrl: function () { return LmsFmt.coverUrl(this.np.coverId, 600); },
    badges: function () {
      var out = [];
      /* Cada etiqueta responde pelo proprio numero: um rip 44,1 kHz/24 bits so
         destaca a profundidade, nunca a taxa. */
      var mark = this.ui.markHires;
      var r = LmsFmt.rate(this.np.sampleRate);
      var d = LmsFmt.depth(this.np.sampleSize);
      if (r) out.push({ text: r, hi: mark && LmsFmt.isHiRes(this.np.sampleRate, 0) });
      if (d) out.push({ text: d, hi: mark && LmsFmt.isHiRes(0, this.np.sampleSize) });
      if (this.np.bitrate) out.push({ text: Math.round(this.np.bitrate) + ' kbps', hi: false });
      if (this.np.format) out.push({ text: LmsFmt.format(this.np.format), hi: false });
      return out;
    },
    signalPathText: function () {
      var output = this.streamLabel(this.np.activeStream);
      var source = this.streamLabel(this.np.sourceStream);
      if (this.np.isTranscoded && source && output) return source + ' → ' + output;
      return output ? 'Output ' + output : '';
    },
    replayGainText: function () {
      if (this.store.replayGainApplied == null || !isFinite(Number(this.store.replayGainApplied))) return '';
      var gain = Number(this.store.replayGainApplied);
      return 'Replay Gain ' + (gain > 0 ? '+' : '') + gain.toFixed(2).replace(/\.00$/, '') + ' dB';
    },
    signalPathTitle: function () {
      var source = this.streamLabel(this.np.sourceStream);
      var output = this.streamLabel(this.np.activeStream);
      var parts = [];
      if (source) parts.push('Source: ' + source);
      if (output) parts.push('Output to player: ' + output);
      if (this.replayGainText) parts.push(this.replayGainText);
      return parts.join('. ');
    },
    rating: function () {
      return Math.round((this.store.trackInfo && this.store.trackInfo.rating || 0) / 20);
    },
    playCount: function () {
      return this.store.trackInfo ? this.store.trackInfo.playCount || 0 : 0;
    },
    favoriteLabel: function () {
      return this.store.npFavorite ? 'Remove from favourites' : 'Add to favourites';
    },
    /* Um valor fora de 0..2 vindo do servidor deixaria o botao sem texto. */
    shuffleLabel: function () {
      return ['Shuffle off', 'Shuffle songs', 'Shuffle albums'][this.store.shuffle] ||
             'Shuffle off';
    },
    repeatLabel: function () {
      return ['Repeat off', 'Repeat one song', 'Repeat the whole queue'][this.store.repeat] ||
             'Repeat off';
    },
    positionTitle: function () {
      var labels = { right: this.tr('Right'), left: this.tr('Left'), center: this.tr('Center') };
      var next = { right: 'left', left: 'center', center: 'right' }[this.ui.playerPosition];
      return this.tr('Current position:') + ' ' + labels[this.ui.playerPosition] +
        '. ' + this.tr('Next:') + ' ' + labels[next];
    }
  },
  watch: {
    'np.id': function () { this.coverFailed = false; },
    isModal: function () { this.updateIsolation(); },
    'ui.queueInline': function (open) {
      if (!open) return;
      this.$nextTick(function () {
        if (this.$refs.dialog) this.$refs.dialog.scrollTop = 0;
      });
    }
  },
  methods: {
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    ratingLabel: function (rating) {
      return rating + ' ' + this.tr(rating === 1 ? 'star' : 'stars');
    },
    streamLabel: function (stream) {
      if (!stream) return '';
      var parts = [];
      var rate = LmsFmt.rate(stream.sampleRate);
      var depth = LmsFmt.depth(stream.sampleSize);
      if (rate) parts.push(rate);
      // Lossy streams intentionally have no bit depth in LMS 9.2.
      if (depth) parts.push(depth);
      if (stream.bitrate) parts.push(Math.round(stream.bitrate) + ' kbps');
      if (stream.format) parts.push(LmsFmt.format(stream.format));
      return parts.join(' · ');
    },
    close: function () {
      LmsUi.closePlayer();
    },
    openPlayerPicker: function (event) {
      LmsUi.openActions({ kind: 'player-picker', title: 'Player' },
                         event && event.currentTarget);
    },
    toggleFullscreen: function () { LmsUi.togglePlayerFullscreen(); },
    cyclePosition: function () { LmsUi.cyclePlayerPosition(); },
    onResize: function () { this.viewportWidth = window.innerWidth; },
    updateIsolation: function () {
      var body = document.querySelector('.body');
      if (!body) return;
      if (this.isModal) {
        body.setAttribute('inert', '');
        body.setAttribute('aria-hidden', 'true');
      } else {
        body.removeAttribute('inert');
        body.removeAttribute('aria-hidden');
      }
    },
    trapFocus: function (event) {
      if (!this.isModal || !this.$refs.dialog) return;
      var nodes = Array.prototype.slice.call(this.$refs.dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(function (node) { return node.offsetParent !== null; });
      if (!nodes.length) return;
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    },
    onPlayerKey: function (event) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      var target = event.target || {};
      var tag = String(target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button' || target.isContentEditable) return;
      var key = event.key;
      if ((key === ' ' || key === 'Spacebar') && this.store.commandable) {
        event.preventDefault(); this.toggle(); return;
      }
      if ((key === 'ArrowLeft' || key === 'ArrowRight') && this.store.commandable && !this.np.live && this.store.duration) {
        event.preventDefault();
        var delta = key === 'ArrowLeft' ? -10 : 10;
        LmsStore.seek(Math.max(0, Math.min(this.store.duration, Number(this.store.time || 0) + delta)));
        return;
      }
      if ((key === 'ArrowUp' || key === 'ArrowDown') && this.store.volumeControllable) {
        event.preventDefault(); this.stepVolume(key === 'ArrowUp' ? this.ui.volumeStep : -this.ui.volumeStep);
      }
    },
    toggle: function () { this.playing ? LmsStore.pause() : LmsStore.play(); },
    stop: function () { LmsStore.stop(); },
    next: function () { LmsStore.next(); },
    prev: function () { LmsStore.prev(); },
    previewSeek: function (e) { this.dragTime = Number(e.target.value); },
    /* Um pointercancel no toque nunca gera change: sem devolver dragTime a null
       o gauge e os tempos ficariam congelados na posicao arrastada. */
    cancelSeek: function () { this.dragTime = null; },
    commitSeek: function (e) {
      var value = Number(e.target.value);
      this.dragTime = null;
      LmsStore.seek(value);
    },
    beginVolume: function () { LmsStore.setVolumeDragging(true); },
    cancelVolume: function () {
      this.dragVolume = null;
      LmsStore.setVolumeDragging(false);
    },
    /* Solta a trava de sincronizacao assim que o dedo sai, mesmo que o change
       ainda esteja por vir; dragVolume segura o valor mostrado ate o commit. */
    releaseVolume: function () { LmsStore.setVolumeDragging(false); },
    /* A regra do ui.js e nao mutar o estado pelo template; enquanto o LmsUi nao
       tiver a acao, a mutacao fica isolada aqui. */
    toggleQueueInline: function () {
      if (LmsUi.toggleQueueInline) return LmsUi.toggleQueueInline();
      this.ui.queueInline = !this.ui.queueInline;
    },
    previewVolume: function (e) {
      LmsStore.setVolumeDragging(true);
      this.dragVolume = Number(e.target.value);
    },
    commitVolume: async function (e) {
      var value = Number(e.target.value);
      await LmsStore.setVolume(value);
      this.dragVolume = null;
      LmsStore.setVolumeDragging(false);
    },
    stepVolume: function (amount) { LmsStore.setVolume(this.volumeValue + amount); },
    toggleVolumeMode: function () { LmsStore.setFixedVolume(!this.store.fixedVolume); },
    favorite: function () { LmsStore.toggleFavorite(); },
    shuffle: function () { LmsStore.cycleShuffle(); },
    repeat: function () { LmsStore.cycleRepeat(); },
    rate: function (n) { LmsStore.setRating(n === this.rating ? 0 : n); },
    info: function () {
      this.ui.infoItem = {
        kind: 'track', id: this.np.id, title: this.np.title,
        artist: this.np.artist, album: this.np.album, url: this.np.url,
        coverId: this.np.coverId
      };
    },
    openEqualizer: function () {
      LmsStore.setEqualizerContext(null);
      LmsUi.closePlayer();
      LmsUi.setTab('settings');
      LmsNav.push('settings', { label: 'Equalizer', screen: 'equalizer' });
      this.ui.appearanceScreen = 'equalizer';
    }
  },
  mounted: function () {
    this.previousFocus = document.activeElement;
    window.addEventListener('resize', this.onResize);
    this.updateIsolation();
    var self = this;
    this.$nextTick(function () { if (self.$refs.dialog) self.$refs.dialog.focus(); });
  },
  beforeDestroy: function () {
    window.removeEventListener('resize', this.onResize);
    /* Fechar o player com o ponteiro ainda no slider deixava volumeDragging
       ligado, e o store para de sincronizar o volume enquanto isso durar. */
    this.dragTime = null;
    this.dragVolume = null;
    LmsStore.setVolumeDragging(false);
    var body = document.querySelector('.body');
    if (body) { body.removeAttribute('inert'); body.removeAttribute('aria-hidden'); }
    if (this.previousFocus && this.previousFocus.focus) this.previousFocus.focus();
  }
});
