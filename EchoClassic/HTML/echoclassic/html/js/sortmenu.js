/* The sort menu: an icon in the toolbar opens this, suspended over the list.

   It replaces a native <select>. The select was capped at 105px so it would fit
   the toolbar, and anything longer than that was cut mid-word -- "Recently
   added" showed as "Recer", and Portuguese, whose labels are longer, was worse.
   A menu sizes to its own content, so the cap disappears along with the
   problem, and the trigger costs 36px instead of 105.

   What a native select gave away for free and this has to earn back: keyboard
   navigation, Escape, focus returning to the trigger, and semantics a screen
   reader can announce. Those are the bulk of the file.

   Positioning is the same rule the row-actions sheet uses: open below the
   trigger, flip above when the space below is smaller and the space above would
   fit, and clamp to the viewport either way. */
Vue.component('lms-sort-menu', {
  template: `
<div class="sheet-stage anchored" @click.self="close">
  <div ref="menu" class="action-sheet anchored sort-menu" :style="menuStyle"
       role="menu" :aria-label="tr('Sort by')" tabindex="-1"
       @keydown.esc.stop.prevent="close" @keydown.tab="trapFocus"
       @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)">
    <div class="sheet-title">{{ tr('Sort by') }}</div>
    <button v-for="option in options" :key="option.key" type="button" role="menuitemradio"
            class="sort-menu-option" :class="{on: option.key === value}"
            :aria-checked="option.key === value ? 'true' : 'false'"
            @click="choose(option.key)">
      <span class="sort-menu-label">{{ option.label }}</span>
      <span class="sort-menu-check" aria-hidden="true"></span>
    </button>
    <button type="button" role="menuitemcheckbox" class="sort-menu-direction"
            :aria-checked="desc ? 'true' : 'false'" @click="toggleDirection">
      <span class="sort-menu-label">{{ tr('Descending order') }}</span>
      <span class="sw" :class="{on: desc}" aria-hidden="true"></span>
    </button>
  </div>
</div>`,
  props: {
    options: { type: Array, required: true },
    value: { type: String, default: '' },
    desc: { type: Boolean, default: false }
  },
  data: function () {
    return { ui: LmsUi.state, menuStyle: {}, previousFocus: null };
  },
  computed: {
    anchor: function () { return this.ui.sortAnchor; }
  },
  methods: {
    tr: function (text) {
      return window.LmsStr && LmsStr.t ? LmsStr.t(text) : text;
    },
    choose: function (key) {
      this.$emit('choose', key);
      this.close();
    },
    toggleDirection: function () {
      /* Stays open on purpose: reversing is something you often do straight
         after picking a key, and closing would cost a second trip. */
      this.$emit('direction');
    },
    close: function () {
      var previous = LmsUi.sortTrigger() || this.previousFocus;
      LmsUi.closeSortMenu();
      if (previous && previous.focus) {
        this.$nextTick(function () { previous.focus(); });
      }
    },
    /* Arrow keys move between options, which is what a menu is expected to do
       and what the select did without being asked. */
    step: function (delta) {
      var nodes = this.focusable();
      if (!nodes.length) return;
      var at = nodes.indexOf(document.activeElement);
      var next = at < 0 ? 0 : (at + delta + nodes.length) % nodes.length;
      nodes[next].focus();
    },
    focusable: function () {
      if (!this.$refs.menu) return [];
      return Array.prototype.slice.call(
        this.$refs.menu.querySelectorAll('button:not([disabled])')
      ).filter(function (node) { return node.offsetParent !== null; });
    },
    trapFocus: function (event) {
      var nodes = this.focusable();
      if (!nodes.length) return;
      if (event.shiftKey && document.activeElement === nodes[0]) {
        event.preventDefault(); nodes[nodes.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        event.preventDefault(); nodes[0].focus();
      }
    },
    position: function () {
      var menu = this.$refs.menu;
      if (!menu) return;
      var margin = 8;
      var gap = 6;
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      var width = Math.min(260, viewportWidth - margin * 2);
      var height = Math.min(menu.scrollHeight, viewportHeight - margin * 2);
      var anchor = this.anchor;

      if (!anchor) {
        /* No rectangle means the menu was opened by something other than the
           icon -- centre it rather than pinning it to a corner. */
        this.menuStyle = {
          left: Math.round((viewportWidth - width) / 2) + 'px',
          top: Math.round((viewportHeight - height) / 2) + 'px',
          width: Math.round(width) + 'px'
        };
        return;
      }

      /* Right-aligned to the icon: the toolbar sits at the left edge of the
         pane, and a left-aligned menu would hang over the list it filters. */
      var left = anchor.right - width;
      if (left < margin) left = margin;
      if (left + width > viewportWidth - margin) left = viewportWidth - width - margin;

      var below = viewportHeight - anchor.bottom - margin;
      var above = anchor.top - margin;
      var top;
      if (below >= height || below >= above) {
        top = Math.min(anchor.bottom + gap, viewportHeight - height - margin);
      } else {
        top = Math.max(margin, anchor.top - height - gap);
      }

      this.menuStyle = {
        left: Math.round(left) + 'px', top: Math.round(top) + 'px',
        width: Math.round(width) + 'px',
        maxHeight: Math.max(120, Math.round(viewportHeight - top - margin)) + 'px'
      };
    }
  },
  mounted: function () {
    this.previousFocus = document.activeElement;
    window.addEventListener('resize', this.position);
    this.$nextTick(function () {
      this.position();
      /* Focus the current choice, so a keyboard user starts where they are
         rather than at the top of the list. */
      var nodes = this.focusable();
      var at = 0;
      for (var i = 0; i < this.options.length; i++) {
        if (this.options[i].key === this.value) { at = i; break; }
      }
      if (nodes[at]) nodes[at].focus();
      else if (this.$refs.menu) this.$refs.menu.focus();
    }.bind(this));
  },
  beforeDestroy: function () {
    window.removeEventListener('resize', this.position);
  }
});
