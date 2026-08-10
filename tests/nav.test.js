const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('contextual Back pops only the current tab stack', function () {
  let backCalls = 0;
  const values = {};
  const history = {
    state: null,
    pushState: function (state) { this.state = state; },
    replaceState: function (state) { this.state = state; },
    back: function () { backCalls += 1; }
  };
  const ctx = helpers.browserContext({
    localStorage: {
      getItem: function () { return null; },
      setItem: function (key, value) { values[key] = value; }
    },
    history: history,
    addEventListener: function () {},
    Vue: {
      observable: function (value) { return value; },
      set: function (object, key, value) { object[key] = value; }
    },
    LmsUi: { state: { tab: 'playlists' }, restoreTab: function () {} }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/nav.js');

  ctx.LmsNav.push('apps', { label: 'Qobuz' });
  ctx.LmsNav.markTab('apps');
  const removed = ctx.LmsNav.back('apps');

  assert.equal(removed.label, 'Qobuz');
  assert.equal(ctx.LmsNav.depth('apps'), 0);
  assert.equal(backCalls, 0);
  assert.equal(history.state.tab, 'apps');
  assert.equal(history.state.depth, 0);
});


/* A11Y-01: the My Music root picker was a bare stack of buttons. The trigger
   carried no aria-haspopup and no aria-expanded, `.picker` had no role, the
   options had no role and no programmatic selection, and opening it left focus
   on the trigger -- so Tab went to Search and a keyboard user had to cross the
   whole library list to reach an option. It is now a listbox per the ARIA APG:
   roles and selection on the popup and its options, focus on the current
   option, arrows/Home/End, Escape, focus restored to the trigger, and Tab
   contained inside the popup. */

const APP = 'EchoClassic/HTML/echoclassic/html/js/app.js';

const ROOTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'years', label: 'Years' }
];

function appInstance() {
  let definition = null;
  const doc = { readyState: 'loading', addEventListener: function () {}, activeElement: null };
  const ui = { picker: false, musicView: 'albums', tab: 'music' };
  const calls = { musicView: [], reset: [] };
  const ctx = helpers.browserContext({
    document: doc,
    history: { pushState: function () {}, replaceState: function () {} },
    addEventListener: function () {},
    Vue: { component: function (name, def) { definition = def; } },
    LmsUi: {
      state: ui,
      MUSIC_VIEWS: ROOTS,
      setMusicView: function (key) { calls.musicView.push(key); ui.musicView = key; ui.picker = false; }
    },
    LmsStore: { state: {} },
    LmsNav: { stacks: { music: [] }, reset: function (tab) { calls.reset.push(tab); }, top: function () { return null; } }
  });
  helpers.runInContext(ctx, APP);

  /* Fake option nodes: focus() is the whole contract the component uses, and
     document.activeElement is how it reads back where focus went. */
  const options = ROOTS.map(function (root) {
    const node = {
      root: root.key,
      focus: function () { doc.activeElement = node; }
    };
    return node;
  });
  const trigger = { focused: 0, focus: function () { trigger.focused += 1; doc.activeElement = trigger; } };

  const self = definition.data();
  self.$nextTick = function (fn) { if (fn) fn.call(self); };
  self.$refs = { picker: { querySelectorAll: function () { return options; } } };
  Object.keys(definition.methods).forEach(function (name) {
    self[name] = definition.methods[name].bind(self);
  });
  Object.keys(definition.watch || {}).forEach(function (name) {
    self['$watch_' + name.replace(/\W/g, '_')] = definition.watch[name].bind(self);
  });
  return { self: self, def: definition, ui: ui, doc: doc, options: options, trigger: trigger, calls: calls };
}

function openPicker(app) {
  app.self.openPicker(app.trigger);
  app.self.$watch_ui_picker(true);
}

test('A11Y-01: the trigger declares the popup and its open state', function () {
  const navbar = helpers.read('EchoClassic/HTML/echoclassic/html/js/chrome/navbar.js');
  const button = navbar.match(/<button v-if="pickable"[\s\S]*?>/)[0];
  assert.match(button, /id="picker-trigger"/,
    'the listbox borrows the trigger for its accessible name, which needs an id to point at');
  assert.match(button, /aria-haspopup="listbox"/);
  assert.match(button, /:aria-expanded="String\(ui\.picker\)"/,
    'a static aria-expanded would announce the same state open or closed');
  assert.match(button, /\$emit\('picker', \$event\.currentTarget\)/,
    'the element travels with the event because it is what focus returns to on close');
});

test('A11Y-01: the popup and its options carry listbox roles and programmatic selection', function () {
  const app = helpers.read(APP);
  const picker = app.match(/<div ref="picker" class="picker"[\s\S]*?<\/div>/)[0];
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /aria-labelledby="picker-trigger"/);
  assert.match(picker, /role="option"/);
  assert.match(picker, /:aria-selected="String\(ui\.musicView === v\.key\)"/,
    'the .on class is paint only -- a screen reader needs aria-selected to announce the current root');
});

test('A11Y-01: opening moves focus to the option in use, not to the top of the list', function () {
  const app = appInstance();
  openPicker(app);
  assert.equal(app.ui.picker, true);
  assert.equal(app.doc.activeElement, app.options[2],
    'musicView is albums, the third root -- focus starts where the user already is');
});

test('A11Y-01: arrows wrap, Home and End jump to the ends', function () {
  const app = appInstance();
  openPicker(app);

  app.self.stepPicker(1);
  assert.equal(app.doc.activeElement, app.options[3]);
  app.self.stepPicker(1);
  assert.equal(app.doc.activeElement, app.options[0], 'Down from the last option wraps to the first');
  app.self.stepPicker(-1);
  assert.equal(app.doc.activeElement, app.options[3], 'Up from the first wraps to the last');

  app.self.jumpPicker(0);
  assert.equal(app.doc.activeElement, app.options[0]);
  app.self.jumpPicker(-1);
  assert.equal(app.doc.activeElement, app.options[3]);
});

test('A11Y-01: Tab is contained inside the popup instead of leaving for Search', function () {
  const app = appInstance();
  openPicker(app);

  app.self.jumpPicker(-1);
  let prevented = 0;
  app.self.trapPicker({ shiftKey: false, preventDefault: function () { prevented += 1; } });
  assert.equal(prevented, 1, 'Tab off the last option must not escape into the library list');
  assert.equal(app.doc.activeElement, app.options[0]);

  app.self.trapPicker({ shiftKey: true, preventDefault: function () { prevented += 1; } });
  assert.equal(prevented, 2);
  assert.equal(app.doc.activeElement, app.options[3], 'Shift+Tab off the first wraps to the last');
});

test('A11Y-01: closing restores focus to the trigger, whether by Escape or by choosing', function () {
  const dismissed = appInstance();
  openPicker(dismissed);
  dismissed.self.closePicker();
  assert.equal(dismissed.ui.picker, false);
  assert.equal(dismissed.trigger.focused, 1, 'Escape and the backdrop both land here');
  assert.equal(dismissed.doc.activeElement, dismissed.trigger);

  const chosen = appInstance();
  openPicker(chosen);
  chosen.self.pickView('years');
  assert.deepEqual(chosen.calls.musicView, ['years']);
  assert.deepEqual(chosen.calls.reset, ['music']);
  assert.equal(chosen.ui.picker, false);
  assert.equal(chosen.trigger.focused, 1,
    'setMusicView closes the popup on its own; without this the focus fell back to <body>');
});
