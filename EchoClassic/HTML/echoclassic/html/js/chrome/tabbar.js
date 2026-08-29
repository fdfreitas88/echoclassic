
/* Five primary tabs on a phone, all destinations on wider screens. The glyphs are hand-drawn SVG: Apple's are not ours
   to ship, and an icon font would drag in a dependency the skin does not need. */
Vue.component('lms-tabbar', {
  template: `
<div class="tabbar" role="tablist" aria-label="Main navigation">
	  <button v-for="t in visibleTabs" :key="t.key" class="tab pointer" role="tab"
	       :aria-selected="String(isSelected(t.key))"
	       :class="{on: isSelected(t.key)}" @click="pick(t.key)">
    <svg viewBox="0 0 24 24" v-html="icon(t.key)"></svg>{{ t.label }}
  </button>
</div>`,
  data: function () {
    return { ui: LmsUi.state, tabs: LmsUi.TABS, compact: false, media: null };
  },
  computed: {
    visibleTabs: function () {
      if (!this.compact) return this.tabs.filter(function (tab) { return tab.key !== 'more'; });
      var order = ['favourites', 'radio', 'playlists', 'music', 'more'];
      return order.map(function (key) {
        return this.tabs.filter(function (tab) { return tab.key === key; })[0];
      }, this).filter(Boolean);
    }
  },
  created: function () {
    if (!window.matchMedia) return;
    this.media = window.matchMedia('(max-width: 820px)');
    this.compact = this.media.matches;
    if (this.media.addEventListener) this.media.addEventListener('change', this.mediaChanged);
    else if (this.media.addListener) this.media.addListener(this.mediaChanged);
  },
  beforeDestroy: function () {
    if (!this.media) return;
    if (this.media.removeEventListener) this.media.removeEventListener('change', this.mediaChanged);
    else if (this.media.removeListener) this.media.removeListener(this.mediaChanged);
  },
  methods: {
    mediaChanged: function (event) {
      this.compact = event.matches;
      /* More is a compact-navigation root, not a sixth content destination.
         If a rotation reveals the wide bar, return to the predictable library
         root instead of leaving a page with no selected tab. */
      if (!this.compact && this.ui.tab === 'more') LmsUi.setTab('music');
    },
    isSelected: function (key) {
      if (this.ui.searching) return false;
      if (this.compact && key === 'more') {
        return this.ui.tab === 'more' || this.ui.tab === 'apps' || this.ui.tab === 'settings';
      }
      return this.ui.tab === key;
    },
    pick: function (key) {
      if (key === 'settings' && this.ui.tab === 'settings') {
        if (this.ui.advancedSettings) {
          if (LmsUi.canLeaveAdvancedSettings && !LmsUi.canLeaveAdvancedSettings()) return;
          if (window.LmsNav && LmsNav.top && LmsNav.top('settings') && LmsNav.top('settings').advanced) {
            LmsNav.pop('settings');
          } else {
            this.ui.advancedSettings = false;
          }
          return;
        }
        if (this.ui.appearanceScreen) {
          if (window.LmsNav && LmsNav.top && LmsNav.top('settings') && LmsNav.top('settings').screen) {
            LmsNav.pop('settings');
          } else {
            this.ui.appearanceScreen = null;
          }
          return;
        }
      }
      if (key === this.ui.tab) {
        if (window.LmsNav && LmsNav.reset) LmsNav.reset(key);
        var scroller = document.querySelector('.workspace');
        if (scroller) scroller.scrollTop = 0;
        return;
      }
      LmsUi.setTab(key);
    },
    icon: function (key) {
      var d = {
        favourites: '<path d="M12 20s-7-4.6-7-9.3A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.7c0 4.7-7 9.3-7 9.3z"/>',
        radio: '<circle cx="12" cy="13" r="2.4"/><path d="M7.5 8.5a6 6 0 000 9M16.5 8.5a6 6 0 010 9M4.5 5.5a10 10 0 000 15M19.5 5.5a10 10 0 010 15"/>',
        playlists: '<path d="M4 7h11M4 12h11M4 17h7"/><path d="M18 16V6l3-1"/><circle cx="17" cy="17" r="1.6"/>',
        music: '<path d="M9 17V5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.6"/><circle cx="16.5" cy="15.5" r="2.6"/>',
        apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
        settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.9 1.9M16.1 16.1L18 18M18 6l-1.9 1.9M7.9 16.1L6 18"/>'
        ,more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
      };
      return d[key] || '';
    }
  }
});

Vue.component('lms-more', {
  template: `
<section class="more-screen" aria-labelledby="more-heading">
  <div id="more-heading" class="sgh">More</div>
  <div class="sgroup more-destinations">
    <button type="button" class="srow settings-command-row pointer" @click="open('apps')">
      <span class="more-glyph" aria-hidden="true">▦</span><span class="setting-copy">Apps<small>Music services and plugins</small></span><span class="v">›</span>
    </button>
    <button type="button" class="srow settings-command-row pointer" @click="open('settings')">
      <span class="more-glyph" aria-hidden="true">⚙</span><span class="setting-copy">Settings<small>Player, appearance and server</small></span><span class="v">›</span>
    </button>
  </div>
  <div class="sgh">About</div>
  <div class="sgroup more-destinations">
    <button type="button" class="srow settings-command-row pointer" @click="serverInfo">
      <span class="more-glyph more-info" aria-hidden="true">i</span><span class="setting-copy">Server information<small>LMS {{ version }}</small></span><span class="v">›</span>
    </button>
  </div>
</section>`,
  computed: {
    version: function () { return typeof LMS_VERSION === 'string' && LMS_VERSION ? LMS_VERSION : '—'; }
  },
  methods: {
    open: function (tab) { LmsUi.setTab(tab); },
    serverInfo: function () {
      LmsUi.setTab('settings');
      LmsUi.state.appearanceScreen = 'about-settings';
      if (window.LmsNav && LmsNav.push) LmsNav.push('settings', { label: 'About', screen: 'about-settings' });
    }
  }
});
