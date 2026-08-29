
/* "Proximas" — a fila de reproducao. E a playlist do servidor espelhada, nao uma
   copia no cliente: tocar um album carrega o album inteiro no LMS e salta para a
   faixa, entao o que aparece aqui e exatamente o que o servidor vai tocar.

   Abre pelo hamburguer, que existe em dois lugares: na mini-barra e na fileira
   de transporte da tela cheia. Fica acima de tudo, inclusive da tela cheia — a
   ordem inversa ja quebrou duas vezes. */
Vue.component('lms-queue', {
  props: { inline: { type: Boolean, default: false } },
  template: `
<div :class="{'queue-wrap-inline': inline}">
  <div v-if="!inline" class="queueback" @click="close"></div>
  <div ref="queue" class="queue" :class="{overfull: ui.full && !inline, inline: inline}"
       role="dialog" :aria-modal="String(!inline)" aria-label="Playback queue"
       :tabindex="inline ? null : -1" @keydown.esc="onEsc" @keydown.tab="trapFocus">
    <div class="qhead">
      <button v-if="!inline" type="button" class="queue-back pointer" @click="close">‹ Player</button>
	      <span class="ttl">Queue</span>
	      <span class="n" v-if="confirmClear">Clear the whole queue?</span>
	      <span class="n" v-else-if="tracks.length">{{ countLabel }} · {{ remaining }}</span>
      <template v-if="confirmClear">
        <button type="button" class="clear destructive pointer" @click="clear">Clear all</button>
        <button type="button" class="clear pointer" @click="confirmClear = false">Cancel</button>
      </template>
      <template v-else>
        <button type="button" class="clear pointer" v-if="store.queueUndo.length"
                @click="undo">Undo</button>
      </template>
      <button v-if="!confirmClear" type="button" class="queue-overflow pointer"
              title="Queue settings" aria-label="Queue settings" @click="settingsOpen = !settingsOpen">•••</button>
    </div>
	    <div class="queue-primary-actions">
	      <button type="button" :class="{on: store.shuffle}" @click="shuffle"><span>Shuffle</span><small>{{ shuffleState }}</small></button>
	      <button type="button" :class="{on: store.repeat}" @click="repeat"><span>Repeat</span><small>{{ repeatState }}</small></button>
	    </div>
	    <div v-if="settingsOpen" class="queue-settings">
        <label class="queue-setting-toggle"><span>Show quick queue controls</span><input type="checkbox" :checked="ui.quickQueueControls" @change="setQuickControls($event.target.checked)"></label>
	      <button v-if="store.capabilities.dontstopthemusicsetting" type="button" @click="toggleDontStop"><span>Continue playback</span><span>{{ store.dontStopMusic.provider !== '0' ? 'On' : 'Off' }} ›</span></button>
	      <button v-if="store.capabilities.randomplay" type="button" @click="toggleRandom"><span>Start a random mix</span><span>›</span></button>
        <button v-if="tracks.length > store.queueIndex + 1" type="button" class="destructive" @click="clearUpcoming">Clear upcoming tracks</button>
        <button v-if="tracks.length" type="button" class="destructive" @click="confirmClear = true; settingsOpen = false">Clear whole queue</button>
	    </div>
	    <div v-if="randomOpen" class="queue-intelligence" aria-label="Random mix choices">
	      <div class="queue-intelligence-head">
	        <strong>Random mix</strong><span>Replaces the current queue with a server-generated mix.</span>
	      </div>
	      <div v-if="pendingMix" class="queue-intelligence-confirm" role="alert">
	        <span>Replace the unplayed tracks with {{ randomModeName(pendingMix) }}?</span>
	        <button type="button" :disabled="store.randomPlay.busy" @click="confirmRandom">Replace</button>
	        <button type="button" @click="pendingMix = ''">Cancel</button>
	      </div>
	      <div v-else class="queue-choice-grid">
	        <button v-for="mode in randomModes" :key="mode.id" type="button"
	                :class="{on: store.randomPlay.active === mode.id}"
	                :disabled="store.randomPlay.busy" @click="chooseRandom(mode.id)">{{ mode.name }}</button>
	        <button v-if="store.randomPlay.active" type="button" class="destructive"
	                :disabled="store.randomPlay.busy" @click="chooseRandom('disable')">Stop mix</button>
	      </div>
	    </div>
	    <div v-if="dontStopOpen" class="queue-intelligence" aria-label="Don't Stop The Music choices">
	      <div class="queue-intelligence-head">
	        <strong>Don’t Stop The Music</strong>
	        <span>{{ dontStopHelp }}</span>
	      </div>
	      <div class="queue-provider-list" role="radiogroup" aria-label="Continuation provider">
	        <button v-for="provider in store.dontStopMusic.providers" :key="provider.id" type="button"
	                role="radio" :aria-checked="String(store.dontStopMusic.provider === provider.id)"
	                :class="{on: store.dontStopMusic.provider === provider.id}"
	                :disabled="store.dontStopMusic.busy" @click="chooseProvider(provider.id)">
	          <span class="queue-radio" aria-hidden="true"></span><span>{{ provider.name }}</span>
	        </button>
	      </div>
	    </div>
	    <div v-if="playbackModeLabel" class="queue-start" role="status">{{ playbackModeLabel }}</div>
	    <div v-if="playStartsLabel" class="queue-start" role="status">{{ playStartsLabel }}</div>

	    <div class="queue-section-title" v-if="tracks.length">Up next · {{ countLabel }}, {{ remaining }}</div>
	    <div class="qbody" v-if="tracks.length">
	      <template v-for="(t, i) in tracks">
	      <div v-if="showCaption(t, i)" :key="'cap-' + t.index" class="qcaption"><span class="ell">{{ t.album }}</span></div>
	      <div :key="t.index + '-' + t.id" class="qrow" :data-queue-index="t.index"
	           draggable="true" @dragstart="dragStart(t, $event)" @dragover.prevent
	           @drop.prevent="dropOn(t)" @dragend="dragIndex = null"
	           tabindex="0" @keydown="onRowKey(t, $event)"
	           @pointerdown="startLongPress(t)" @pointerup="cancelLongPress" @pointercancel="cancelLongPress" @pointerleave="cancelLongPress"
	           :class="{now: isNow(t), nocover: !showCover(t, i)}" :aria-current="isNow(t) ? 'true' : null"
	           role="group" :aria-label="trackLabel(t)">
	        <button type="button" class="qrow-main pointer" :aria-label="trackLabel(t)"
	                @click="jump(t)">
	          <span v-if="isNow(t)" class="nowmark" aria-hidden="true">▶</span>
	          <span class="cover" :class="{collapse: !showCover(t, i)}"
	                :style="showCover(t, i) ? coverStyle(t) : {}"></span>
	          <span class="ell">
	            <span class="t ell">{{ t.title }}</span>
	            <span class="s ell">{{ sub(t) }}</span>
	          </span>
	          <span class="dur">{{ dur(t.duration) }}</span>
	        </button>
        <span v-if="ui.quickQueueControls || longPressIndex === t.index" class="queue-reorder">
          <button type="button" :data-move="t.index + ':-1'" :disabled="t.index <= 0"
                  :title="'Move ' + t.title + ' up'" :aria-label="'Move ' + t.title + ' up'"
                  @click.stop="move(t, -1)">↑</button>
          <button type="button" :data-move="t.index + ':1'" :disabled="t.index >= tracks.length - 1"
                  :title="'Move ' + t.title + ' down'" :aria-label="'Move ' + t.title + ' down'"
                  @click.stop="move(t, 1)">↓</button>
          <button type="button" class="queue-remove" :aria-label="'Remove ' + t.title + ' from the queue'" @click.stop="requestRemove(t)">×</button>
        </span>
        <button type="button" class="queue-more pointer" :aria-expanded="String(menuIndex === t.index)"
                :aria-label="'Actions for ' + t.title" @click.stop="toggleRowMenu(t)">•••</button>
        <div v-if="menuIndex === t.index" class="queue-row-menu" role="menu">
          <button type="button" role="menuitem" @click="playNext(t)">Play next</button>
          <button type="button" role="menuitem" :disabled="t.index <= 0" @click="moveEdge(t, 0)">Move to top</button>
          <button type="button" role="menuitem" :disabled="t.index >= tracks.length - 1" @click="moveEdge(t, tracks.length - 1)">Move to bottom</button>
          <button type="button" role="menuitem" class="destructive" @click="requestRemove(t)">Remove</button>
        </div>
      </div>
      </template>
    </div>

    <div class="qempty" v-else>
      The queue is empty. Play an album or a playlist and the tracks that follow appear here.
    </div>
    <p class="visually-hidden" aria-live="polite" aria-atomic="true">{{ liveStatus }}</p>
  </div>
</div>`,
  data: function () {
    return { ui: LmsUi.state, store: LmsStore.state, previousFocus: null,
             confirmClear: false, randomOpen: false, dontStopOpen: false,
             pendingMix: '', dragIndex: null, settingsOpen: false, menuIndex: null,
             longPressIndex: null, longPressTimer: null, liveStatus: '' };
  },
  computed: {
	    tracks: function () { return this.store.queue; },
	    queueTitle: function () { return 'Playback queue'; },
    /* queueIndex cai em zero quando o servidor nao manda indice; sem faixa
       corrente de fato isso marcaria a primeira linha por engano. */
    hasCurrent: function () {
      return this.store.mode !== 'stop' || this.store.np.id != null;
    },
	    remaining: function () {
	      var s = LmsStore.queueRemaining();
	      return s ? LmsFmt.longDuration(s) + ' ' + LmsStr.t('remaining') : LmsStr.t('live');
	    },
	    countLabel: function () {
	      var total = this.store.queueTotal || this.tracks.length;
	      var trackUnit = total === 1 ? LmsStr.t('track') : LmsStr.t('tracks');
	      var label = total + ' ' + trackUnit;
	      if (total > this.tracks.length) {
	        var msg = LmsStr.t('{{loaded}} of {{total}} loaded');
	        return msg.replace('{{loaded}}', this.tracks.length).replace('{{total}}', label);
	      }
	      return label;
	    },
	    playStartsLabel: function () {
	      if (!this.tracks.length || this.store.mode !== 'stop') return '';
	      var index = Math.max(0, Math.min(this.tracks.length - 1, this.store.queueIndex || 0));
	      var track = this.tracks.filter(function (t) { return t.index === index; })[0] || this.tracks[index];
	      /* O rotulo e montado aqui, entao a frase pronta nunca bate com uma
	         chave do dicionario. Traduz-se o prefixo antes de concatenar. */
	      var prefix = (window.LmsStr ? LmsStr.t('Play will start:') : 'Play will start:');
	      return track ? prefix + ' ' + track.title : '';
	    },
    shuffleLabel: function () {
      return ['Shuffle off', 'Shuffle songs', 'Shuffle albums'][this.store.shuffle] ||
             'Shuffle off';
    },
    repeatLabel: function () {
      return ['Repeat off', 'Repeat one song', 'Repeat the whole queue'][this.store.repeat] ||
             'Repeat off';
    },
    shuffleState: function () { return ['Off', 'Songs', 'Albums'][this.store.shuffle] || 'Off'; },
    repeatState: function () { return ['Off', 'One song', 'Whole queue'][this.store.repeat] || 'Off'; },
    randomModes: function () {
      return [
        { id: 'track', name: 'Tracks' }, { id: 'contributor', name: 'Artists' },
        { id: 'album', name: 'Albums' }, { id: 'year', name: 'Years' },
        { id: 'work', name: 'Classical works' }
      ];
    },
    playbackModeLabel: function () {
      if (this.store.randomPlay.active) return LmsStr.t('Random mix: {{mode}}')
        .replace('{{mode}}', this.randomModeName(this.store.randomPlay.active));
      if (this.store.dontStopMusic.provider !== '0') {
        var selected = this.store.dontStopMusic.providers.filter(function (provider) {
          return provider.id === this.store.dontStopMusic.provider;
        }, this)[0];
        return selected ? LmsStr.t('Continues with: {{provider}}').replace('{{provider}}', selected.name)
          : LmsStr.t('Don’t Stop The Music is on');
      }
      return '';
    },
    dontStopHelp: function () {
      return LmsStr.t(this.store.dontStopMusic.provider === '0'
        ? 'Off: playback stops when the queue ends.'
        : 'On: playback continues automatically when the queue ends.');
    },
    artMode: function () { return this.ui.queueArtMode; }
  },
  methods: {
    dur: function (s) { return s ? LmsFmt.duration(s) : '—'; },
    isNow: function (t) {
      return this.hasCurrent && t.index === this.store.queueIndex;
    },
    /* AUDIT-09: agrupa SO pelo albumId estavel de 2a -- nunca pelo nome do
       album (duas obras homonimas nao podem virar uma) nem pelo coverid (que
       e por faixa: uma compilacao com capa propria por faixa quebraria a
       sequencia, e uma faixa sem coverid colapsaria com qualquer outra sem
       capa). Uma linha sem albumId nunca agrupa com a vizinha, nem com outra
       linha tambem sem albumId -- cada uma mostra a propria capa. */
    showCover: function (t, i) {
      if (this.artMode === 'every') return true;
      if (t.albumId == null) return true;
      var prev = this.tracks[i - 1];
      return !prev || prev.albumId == null || prev.albumId !== t.albumId;
    },
    /* Legenda e um elemento separado, nao uma linha mais alta: .qrow continua
       com 52px em qualquer modo. */
    showCaption: function (t, i) {
      if (this.artMode !== 'headings') return false;
      if (!this.showCover(t, i)) return false;
      return !!t.album;
    },
	    sub: function (t) {
	      var parts = [];
	      if (t.artist) parts.push(t.artist);
	      if (t.album) parts.push(t.album);
	      return parts.join(' — ');
	    },
	    trackLabel: function (t) {
	      return [t.title, this.sub(t), this.dur(t.duration)].filter(Boolean).join(', ');
	    },
    coverStyle: function (t) {
      var url = LmsFmt.coverUrl(t.coverId, 50);
      return url ? { backgroundImage: 'url(' + url + ')', backgroundSize: 'cover' } : {};
    },
    close: function () {
      if (this.inline) return;
      LmsUi.state.queueOpen = false;
      var previous = this.previousFocus;
      setTimeout(function () { if (previous && previous.focus) previous.focus(); }, 0);
    },
    /* So engole o Esc quando ele fecha alguma coisa aqui; inline a folha nao
       fecha e o Esc precisa chegar ao player cheio. */
    onEsc: function (event) {
      if (this.menuIndex !== null || this.settingsOpen || this.longPressIndex !== null) {
        event.stopPropagation(); event.preventDefault();
        this.menuIndex = null; this.settingsOpen = false; this.longPressIndex = null;
        return;
      }
      if (this.confirmClear) {
        event.stopPropagation();
        event.preventDefault();
        this.confirmClear = false;
        return;
      }
      if (this.inline) return;
      event.stopPropagation();
      event.preventDefault();
      this.close();
    },
    trapFocus: function (event) {
      if (this.inline || !this.$refs.queue) return;
      var nodes = Array.prototype.slice.call(this.$refs.queue.querySelectorAll('button:not([disabled]), [tabindex="0"]'))
        .filter(function (node) { return node.offsetParent !== null; });
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault(); nodes[nodes.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        event.preventDefault(); nodes[0].focus();
      }
    },
    jump: function (t) { LmsStore.jumpTo(t.index); },
    setQuickControls: function (value) { LmsUi.setQuickQueueControls(value); },
    toggleRowMenu: function (t) { this.menuIndex = this.menuIndex === t.index ? null : t.index; },
    announce: function (message) { this.liveStatus = ''; var self = this; this.$nextTick(function () { self.liveStatus = message; }); },
    requestRemove: async function (t) {
      this.menuIndex = null;
      var accepted = await LmsUi.confirmAction({
        title: 'Remove from queue?', message: t.title || 'This track', confirmLabel: 'Remove', destructive: true
      });
      if (!accepted) return;
      await LmsStore.removeFromQueue(t.index);
      this.announce((t.title || 'Track') + ' removed from queue');
    },
    playNext: function (t) {
      this.menuIndex = null;
      var to = Math.min(this.tracks.length - 1, (this.store.queueIndex || 0) + 1);
      if (t.index === to) return;
      LmsStore.moveInQueue(t.index, to);
      this.announce((t.title || 'Track') + ' will play next');
    },
    moveEdge: function (t, to) {
      this.menuIndex = null;
      if (t.index === to) return;
      LmsStore.moveInQueue(t.index, to);
      this.announce((t.title || 'Track') + (to === 0 ? ' moved to top' : ' moved to bottom'));
    },
    onRowKey: function (t, event) {
      var key = event.key;
      if (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
        event.preventDefault(); this.move(t, key === 'ArrowUp' ? -1 : 1); return;
      }
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault(); this.focusRow(t.index + (key === 'ArrowUp' ? -1 : 1)); return;
      }
      if (key === 'Enter') { event.preventDefault(); this.toggleRowMenu(t); return; }
      if (key === 'Delete' || key === 'Backspace') { event.preventDefault(); this.requestRemove(t); }
    },
    focusRow: function (index) {
      if (!this.$refs.queue) return;
      var node = this.$refs.queue.querySelector('[data-queue-index="' + index + '"]');
      if (node && node.focus) node.focus();
    },
    startLongPress: function (t) {
      this.cancelLongPress(); var self = this;
      this.longPressTimer = setTimeout(function () { self.longPressIndex = t.index; self.announce('Reorder controls shown for ' + t.title); }, 550);
    },
    cancelLongPress: function () { if (this.longPressTimer) clearTimeout(this.longPressTimer); this.longPressTimer = null; },
    move: function (t, delta) {
      var to = t.index + delta;
      if (to < 0 || to >= this.tracks.length) return;
      var self = this;
      /* A linha e recriada a cada reordenacao; sem devolver o foco ao botao o
         teclado cai no body e o passo seguinte fica inalcancavel. */
      Promise.resolve(LmsStore.moveInQueue(t.index, to)).then(function () {
        self.announce((t.title || 'Track') + ' moved to position ' + (to + 1));
        self.$nextTick(function () { self.focusMove(to, delta); });
      });
    },
    moveTo: function (t) {
      var answer = window.prompt('Move to position (1–' + this.tracks.length + ')', String(t.index + 1));
      if (answer === null) return;
      var to = Math.max(0, Math.min(this.tracks.length - 1, Number(answer) - 1));
      if (!Number.isFinite(to) || to === t.index) return;
      LmsStore.moveInQueue(t.index, to);
    },
    dragStart: function (t, event) {
      this.dragIndex = t.index;
      if (event && event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(t.index));
      }
    },
    dropOn: function (t) {
      var from = Number(this.dragIndex);
      this.dragIndex = null;
      if (!Number.isFinite(from) || from === t.index) return;
      LmsStore.moveInQueue(from, t.index);
    },
    focusMove: function (index, delta) {
      if (!this.$refs.queue) return;
      var node = this.$refs.queue.querySelector('[data-move="' + index + ':' + delta + '"]');
      // no topo ou no fim o botao usado fica desabilitado; o par assume o foco
      if (!node || node.disabled) {
        node = this.$refs.queue.querySelector('[data-move="' + index + ':' + (-delta) + '"]');
      }
      if (node && !node.disabled && node.focus) node.focus();
    },
    shuffle: function () { LmsStore.cycleShuffle(); },
    repeat: function () { LmsStore.cycleRepeat(); },
    toggleRandom: function () {
      this.randomOpen = !this.randomOpen;
      if (this.randomOpen) this.dontStopOpen = false;
      this.pendingMix = '';
    },
    toggleDontStop: function () {
      this.dontStopOpen = !this.dontStopOpen;
      if (this.dontStopOpen) this.randomOpen = false;
    },
    randomModeName: function (id) {
      var mode = this.randomModes.filter(function (candidate) { return candidate.id === id; })[0];
      return mode ? LmsStr.t(mode.name) : id;
    },
    hasUnplayedTracks: function () {
      if (!this.tracks.length) return false;
      if (this.store.mode === 'stop') return true;
      return this.tracks.some(function (track) { return track.index > this.store.queueIndex; }, this);
    },
    chooseRandom: function (mode) {
      if (mode !== 'disable' && this.hasUnplayedTracks()) {
        this.pendingMix = mode;
        return;
      }
      this.runRandom(mode);
    },
    confirmRandom: function () {
      var mode = this.pendingMix;
      this.pendingMix = '';
      if (mode) this.runRandom(mode);
    },
    runRandom: function (mode) {
      var self = this;
      Promise.resolve(LmsStore.setRandomPlay(mode)).then(function () {
        if (mode === 'disable') self.randomOpen = false;
      });
    },
    chooseProvider: function (provider) { LmsStore.setDontStopMusic(provider); },
    clearUpcoming: function () { LmsStore.clearUpcoming(); },
    undo: function () { LmsStore.undoQueue(); },
    clear: function () {
      this.confirmClear = false;
      LmsStore.clearQueue();
    }
  },
  created: function () {
    LmsStore.loadQueue();
    LmsStore.refreshPlaybackIntelligence(true);
  },
  mounted: function () {
    if (this.inline) return;
    this.previousFocus = document.activeElement;
    var self = this;
    this.$nextTick(function () { if (self.$refs.queue) self.$refs.queue.focus(); });
  }
});
