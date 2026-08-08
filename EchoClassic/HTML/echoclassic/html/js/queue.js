
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
	      <span class="ttl">{{ queueTitle }}</span>
	      <span class="n" v-if="confirmClear">Clear the whole queue?</span>
	      <span class="n" v-else-if="tracks.length">{{ countLabel }} · {{ remaining }}</span>
      <template v-if="confirmClear">
        <button type="button" class="clear destructive pointer" @click="clear">Clear all</button>
        <button type="button" class="clear pointer" @click="confirmClear = false">Cancel</button>
      </template>
      <template v-else>
        <button type="button" class="clear pointer" v-if="store.queueUndo.length"
                @click="undo">Undo</button>
        <button type="button" class="clear pointer" v-if="tracks.length > store.queueIndex + 1"
                @click="clearUpcoming">Clear upcoming</button>
        <button type="button" class="clear destructive pointer" v-if="tracks.length"
                @click="confirmClear = true">Clear all</button>
      </template>
      <button v-if="!inline" type="button" class="queue-dismiss pointer"
              title="Close queue" aria-label="Close queue" @click="close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
	    <div class="queue-modes">
	      <button type="button" :class="{on: store.shuffle}" @click="shuffle">{{ shuffleLabel }}</button>
	      <button type="button" :class="{on: store.repeat}" @click="repeat">{{ repeatLabel }}</button>
	    </div>
	    <div v-if="playStartsLabel" class="queue-start" role="status">{{ playStartsLabel }}</div>

	    <div class="qbody" v-if="tracks.length">
	      <template v-for="(t, i) in tracks">
	      <div v-if="showCaption(t, i)" :key="'cap-' + t.index" class="qcaption ell">{{ t.album }}</div>
	      <div :key="t.index + '-' + t.id" class="qrow"
	           :class="{now: isNow(t)}" :aria-current="isNow(t) ? 'true' : null"
	           role="group" :aria-label="trackLabel(t)">
	        <button type="button" class="qrow-main pointer" :aria-label="trackLabel(t)"
	                @click="jump(t)">
	          <span v-if="isNow(t)" class="nowmark" aria-hidden="true">▶</span>
	          <span class="cover" :style="showCover(t, i) ? coverStyle(t) : {}"></span>
	          <span class="ell">
	            <span class="t ell">{{ t.title }}</span>
	            <span class="s ell">{{ sub(t) }}</span>
	          </span>
	          <span class="dur">{{ dur(t.duration) }}</span>
	        </button>
	        <span class="queue-reorder">
          <button type="button" :data-move="t.index + ':-1'" :disabled="t.index <= 0"
                  :title="'Move ' + t.title + ' up'" :aria-label="'Move ' + t.title + ' up'"
                  @click.stop="move(t, -1)">↑</button>
          <button type="button" :data-move="t.index + ':1'" :disabled="t.index >= tracks.length - 1"
                  :title="'Move ' + t.title + ' down'" :aria-label="'Move ' + t.title + ' down'"
                  @click.stop="move(t, 1)">↓</button>
        </span>
        <button type="button" class="drag pointer" title="Remove"
                :aria-label="'Remove ' + t.title + ' from the queue'" @click.stop="remove(t)">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      </template>
    </div>

    <div class="qempty" v-else>
      The queue is empty. Play an album or a playlist and the tracks that follow appear here.
    </div>
  </div>
</div>`,
  data: function () {
    return { ui: LmsUi.state, store: LmsStore.state, previousFocus: null,
             confirmClear: false };
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
	      return s ? LmsFmt.longDuration(s) + 'remaining' : 'live';
	    },
	    countLabel: function () {
	      var total = this.store.queueTotal || this.tracks.length;
	      var label = total + (total === 1 ? 'track' : 'tracks');
	      return total > this.tracks.length ? this.tracks.length + ' de ' + label + ' carregadas' : label;
	    },
	    playStartsLabel: function () {
	      if (!this.tracks.length || this.store.mode !== 'stop') return '';
	      var index = Math.max(0, Math.min(this.tracks.length - 1, this.store.queueIndex || 0));
	      var track = this.tracks.filter(function (t) { return t.index === index; })[0] || this.tracks[index];
	      /* O rotulo e montado aqui, entao a frase pronta nunca bate com uma
	         chave do dicionario. Traduz-se o prefixo antes de concatenar. */
	      var prefix = (window.LmsStr ? LmsStr.t('Play will start: ') : 'Play will start: ');
	      return track ? prefix + track.title : '';
	    },
    shuffleLabel: function () {
      return ['Shuffle off', 'Shuffle songs', 'Shuffle albums'][this.store.shuffle] ||
             'Shuffle off';
    },
    repeatLabel: function () {
      return ['Repeat off', 'Repeat one song', 'Repeat the whole queue'][this.store.repeat] ||
             'Repeat off';
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
    remove: function (t) { LmsStore.removeFromQueue(t.index); },
    move: function (t, delta) {
      var to = t.index + delta;
      if (to < 0 || to >= this.tracks.length) return;
      var self = this;
      /* A linha e recriada a cada reordenacao; sem devolver o foco ao botao o
         teclado cai no body e o passo seguinte fica inalcancavel. */
      Promise.resolve(LmsStore.moveInQueue(t.index, to)).then(function () {
        self.$nextTick(function () { self.focusMove(to, delta); });
      });
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
    clearUpcoming: function () { LmsStore.clearUpcoming(); },
    undo: function () { LmsStore.undoQueue(); },
    clear: function () {
      this.confirmClear = false;
      LmsStore.clearQueue();
    }
  },
  created: function () { LmsStore.loadQueue(); },
  mounted: function () {
    if (this.inline) return;
    this.previousFocus = document.activeElement;
    var self = this;
    this.$nextTick(function () { if (self.$refs.queue) self.$refs.queue.focus(); });
  }
});
