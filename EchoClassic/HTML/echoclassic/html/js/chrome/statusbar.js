
/* The iOS 9 status bar, repurposed: the device name slot carries the skin's
   brand and the battery slot carries the server version, because neither a
   device name nor a battery means anything here. */
Vue.component('lms-statusbar', {
  template: `
<div class="statusbar" aria-hidden="true">
  <b class="brand">Echo Classic</b>
  <span class="mid">{{ clock }}</span>
  <span class="srv">Servidor LMS {{ version }}</span>
</div>`,
  data: function () {
    return { clock: '', timer: null };
  },
  computed: {
    version: function () {
      return typeof LMS_VERSION === 'string' && LMS_VERSION ? LMS_VERSION : '—';
    }
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
    }
  },
  /* 15s: o relogio imita o do iOS e nao pode ficar meio minuto atras do
     relogio do sistema, que fica logo acima dele na tela. */
  created: function () {
    this.tick();
    this.timer = setInterval(this.tick, 15000);
  },
  beforeDestroy: function () {
    clearInterval(this.timer);
  }
});