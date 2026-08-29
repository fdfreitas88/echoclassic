
/* Nav bar. The centred title is an absolutely positioned full-width container so
   the label sits centred in the WINDOW, as iOS 9 does, rather than in whatever
   space the side icons leave. That is why it carries pointer-events:none with
   auto on its clickable child — without it the container covers the whole bar and
   swallows the clicks of the icons at both ends. That bug shipped twice. */
Vue.component('lms-navbar', {
  props: {
    title: { type: String, default: '' },
    back: { type: String, default: null },
    pickable: { type: Boolean, default: false },
    segments: { type: Array, default: function () { return []; } },
    segment: { type: String, default: '' }
  },
  template: `
<div class="navbar" :class="{searching:ui.searching}">
  <template v-if="ui.searching">
    <div class="searchwrap">
      <svg class="ic sm-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7.5"/><path d="M16 16l5.5 5.5"/></svg>
      <input ref="q" v-model="ui.query" placeholder="Search the library"
             @keydown.esc.prevent="cancel">
    </div>
    <span class="sp"></span>
    <span class="r"><button class="cancel pointer" @click="cancel">Cancel</button></span>
  </template>

  <template v-else>
    <button v-if="back !== null" class="back pointer"
            :aria-label="'Back to ' + back" :title="'Back to ' + back"
            @click="$emit('back')">
      <svg class="ic chevleft" viewBox="0 0 13 20"><path d="M10 1L2.5 10 10 19"/></svg>
      <span>{{ back }}</span>
    </button>
    <button v-else class="theme pointer" :title="themeTitle" :aria-label="themeTitle" @click="toggle">
      <svg class="ic" viewBox="0 0 24 24">
        <template v-if="ui.theme === 'dark'">
          <circle cx="12" cy="12" r="4.2"/>
          <path d="M12 2.6v2.5M12 18.9v2.5M2.6 12h2.5M18.9 12h2.5M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"/>
        </template>
        <template v-else-if="ui.theme === 'legacy'">
          <rect x="4.5" y="5" width="15" height="14" rx="3"/>
          <path d="M8 9h8M8 12h8M8 15h5"/>
        </template>
        <path v-else d="M20.5 14.6A8.6 8.6 0 019.4 3.5a8.6 8.6 0 1011.1 11.1z"/>
      </svg>
    </button>

    <div class="center">
	      <button v-if="pickable" id="picker-trigger" class="pickttl pointer"
	              aria-haspopup="listbox" :aria-expanded="String(ui.picker)"
	              :aria-label="'Choose a My Music root. Current: ' + title"
	              @click="$emit('picker', $event.currentTarget)">
        {{ title }}
        <svg class="ic sm" viewBox="0 0 12 12"><path d="M1.5 4L6 8.5 10.5 4"/></svg>
      </button>
      <span v-else-if="!segments.length">{{ title }}</span>

      <span v-if="segments.length" class="segmented" role="tablist">
        <button v-for="sg in segments" :key="sg.key" class="seg pointer" role="tab"
              :aria-selected="String(sg.key === segment)" :class="{on: sg.key === segment}"
              @click="$emit('segment', sg.key)">{{ sg.label }}</button>
      </span>
    </div>

    <span class="sp"></span>
    <span class="r">
      <button v-if="ui.advancedSettings" class="nav-apply pointer" @click="applyAdvanced">Save</button>
      <button v-else ref="searchButton" class="search pointer" title="Search" aria-label="Search" @click="open">
        <svg class="ic" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7.5"/><path d="M16 16l5.5 5.5"/></svg>
      </button>
    </span>
  </template>
</div>`,
  data: function () {
    return { ui: LmsUi.state };
  },
  computed: {
    themeTitle: function () {
      if (this.ui.theme === 'light') return 'Dark theme';
      if (this.ui.theme === 'dark') return 'Legacy theme';
      return 'Light theme';
    }
  },
  methods: {
    toggle: function () { LmsUi.toggleTheme(); },
    open: function () {
      LmsUi.openSearch();
      var self = this;
      this.$nextTick(function () { if (self.$refs.q) self.$refs.q.focus(); });
    },
    applyAdvanced: function () {
      if (LmsUi.applyAdvancedSettings) LmsUi.applyAdvancedSettings();
    },
    /* Fechar a busca sem devolver o foco deixava o teclado no <body> e a
       navegacao recomecava do topo da pagina. */
    cancel: function () {
      LmsUi.closeSearch();
      var self = this;
      this.$nextTick(function () {
        if (self.$refs.searchButton) self.$refs.searchButton.focus();
      });
    }
  }
});
