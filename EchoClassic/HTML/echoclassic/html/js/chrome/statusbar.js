
/* The iOS 9 status bar. Server details live in More/About where they remain
   readable; the compact bar keeps the brand and the user's local clock. */
Vue.component('lms-statusbar', {
  template: `
<div class="statusbar">
  <div class="status-branding">
    <b class="brand">Echo Classic</b>
    <button type="button" class="support-trigger" aria-haspopup="menu"
            aria-controls="support-menu" :aria-expanded="String(open)"
            @click.stop="toggle" @keydown.esc.stop.prevent="close">Support</button>
    <div v-if="open" id="support-menu" ref="menu" class="support-menu" role="menu"
         aria-label="Support Echo Classic" @keydown.esc.stop.prevent="close(true)">
      <a ref="firstLink" role="menuitem" :href="patreonUrl" target="_blank"
         rel="noopener noreferrer" @click="close()"><strong>Patreon</strong><span>Become a monthly supporter</span></a>
      <a role="menuitem" :href="coffeeUrl" target="_blank"
         rel="noopener noreferrer" @click="close()"><strong>Buy Me a Coffee</strong><span>Make a one-time contribution</span></a>
    </div>
  </div>
  <span class="mid" aria-hidden="true">{{ clock }}</span>
  <span class="status-reserve" aria-hidden="true">Echo Classic · Support</span>
</div>`,
  data: function () {
    return {
      clock: '', timer: null, open: false,
      patreonUrl: ECHOCLASSIC_PATREON_URL,
      coffeeUrl: ECHOCLASSIC_COFFEE_URL
    };
  },
  methods: {
    /* toLocaleTimeString respeita a preferencia de 12h/24h do sistema; a
       montagem manual anterior forcava 24h e nao punha zero a esquerda. */
    tick: function () {
      var d = new Date();
      try {
        this.clock = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } catch (e) {
        var m = d.getMinutes();
        this.clock = d.getHours() + ':' + (m < 10 ? '0' + m : String(m));
      }
    },
    toggle: function () {
      this.open = !this.open;
      if (this.open) {
        var self = this;
        this.$nextTick(function () {
          if (self.$refs.firstLink) self.$refs.firstLink.focus();
        });
      }
    },
    close: function (returnFocus) {
      this.open = false;
      if (returnFocus) {
        var trigger = this.$el && this.$el.querySelector('.support-trigger');
        if (trigger) this.$nextTick(function () { trigger.focus(); });
      }
    },
    documentClick: function () {
      if (this.open) this.close();
    }
  },
  /* 15s: o relogio imita o do iOS e nao pode ficar meio minuto atras do
     relogio do sistema, que fica logo acima dele na tela. */
  created: function () {
    this.tick();
    this.timer = setInterval(this.tick, 15000);
    document.addEventListener('click', this.documentClick);
  },
  beforeDestroy: function () {
    clearInterval(this.timer);
    document.removeEventListener('click', this.documentClick);
  }
});
