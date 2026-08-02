
/* Five tabs, iOS 9 spacing. The glyphs are hand-drawn SVG: Apple's are not ours
   to ship, and an icon font would drag in a dependency the skin does not need. */
Vue.component('lms-tabbar', {
  template: `
<div class="tabbar" role="tablist" aria-label="Navegação principal">
	  <button v-for="t in tabs" :key="t.key" class="tab pointer" role="tab"
	       :aria-selected="String(!ui.searching && ui.tab === t.key)"
	       :class="{on: !ui.searching && ui.tab === t.key}" @click="pick(t.key)">
    <svg viewBox="0 0 24 24" v-html="icon(t.key)"></svg>{{ t.label }}
  </button>
</div>`,
  data: function () {
    return { ui: LmsUi.state, tabs: LmsUi.TABS };
  },
  methods: {
    pick: function (key) {
      if (key === 'ajustes' && this.ui.tab === 'ajustes' && this.ui.advancedSettings) {
        this.ui.advancedSettings = false;
        return;
      }
      LmsUi.setTab(key);
    },
    icon: function (key) {
      var d = {
        favoritos: '<path d="M12 20s-7-4.6-7-9.3A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.7c0 4.7-7 9.3-7 9.3z"/>',
        radio: '<circle cx="12" cy="13" r="2.4"/><path d="M7.5 8.5a6 6 0 000 9M16.5 8.5a6 6 0 010 9M4.5 5.5a10 10 0 000 15M19.5 5.5a10 10 0 010 15"/>',
        playlists: '<path d="M4 7h11M4 12h11M4 17h7"/><path d="M18 16V6l3-1"/><circle cx="17" cy="17" r="1.6"/>',
        musica: '<path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.6"/><circle cx="16.5" cy="15.5" r="2.6"/>',
        ajustes: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.9 1.9M16.1 16.1L18 18M18 6l-1.9 1.9M7.9 16.1L6 18"/>'
      };
      return d[key] || '';
    }
  }
});
