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
  const calls = { musicView: [], reset: [], resume: [] };
  const ctx = helpers.browserContext({
    document: doc,
    history: { pushState: function () {}, replaceState: function () {} },
    addEventListener: function () {},
    Vue: { component: function (name, def) { definition = def; } },
    LmsUi: {
      state: ui,
      MUSIC_VIEWS: ROOTS,
      setMusicView: function (key) { calls.musicView.push(key); ui.musicView = key; ui.picker = false; },
      viewLabel: function () { return 'Artists'; },
      resumeSearch: function (tab) { calls.resume.push(tab); return true; }
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
  return { self: self, def: definition, ctx: ctx, ui: ui, doc: doc, options: options, trigger: trigger, calls: calls };
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

/* NAV-01, second half: the suspended search only helps if something returns to
   it. Both Back paths -- the contextual one in the nav bar and the browser's
   own -- have to land on the results; if they disagree, the same gesture means
   two different things depending on where the user's hand is. */

function navWithSearch(suspended) {
  const values = {};
  const history = {
    state: null,
    pushState: function (state) { this.state = state; },
    replaceState: function (state) { this.state = state; }
  };
  const listeners = {};
  const resumed = [];
  const ctx = helpers.browserContext({
    localStorage: {
      getItem: function () { return null; },
      setItem: function (key, value) { values[key] = value; }
    },
    history: history,
    addEventListener: function (name, fn) { listeners[name] = fn; },
    Vue: {
      observable: function (value) { return value; },
      set: function (object, key, value) { object[key] = value; }
    },
    LmsUi: {
      state: { tab: 'music' },
      restoreTab: function () {},
      resumeSearch: function (tab) {
        resumed.push(tab);
        return suspended === tab;
      }
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/nav.js');
  return { nav: ctx.LmsNav, popstate: listeners.popstate, resumed: resumed, history: history };
}

test('NAV-01: browser Back to an empty stack offers the suspended search back', function () {
  const harness = navWithSearch('music');
  harness.nav.push('music', { kind: 'artist', id: 1, label: 'The Beatles', fromSearch: true });

  harness.popstate({ state: { echoClassic: true, tab: 'music', depth: 0, frames: [] } });

  assert.equal(harness.nav.depth('music'), 0);
  assert.deepEqual(harness.resumed, ['music'],
    'the browser arrow has to reach the same screen the nav bar Back reaches');
});

test('NAV-01: browser Back into a deeper frame does not resume -- that is still navigation inside the tab', function () {
  const harness = navWithSearch('music');
  harness.nav.push('music', { kind: 'artist', id: 1, label: 'The Beatles', fromSearch: true });
  harness.nav.push('music', { kind: 'album', id: 9, label: 'Revolver' });

  harness.popstate({
    state: {
      echoClassic: true, tab: 'music', depth: 1,
      frames: [{ kind: 'artist', id: 1, label: 'The Beatles', fromSearch: true }]
    }
  });

  assert.equal(harness.nav.depth('music'), 1);
  assert.deepEqual(harness.resumed, [], 'album -> artist is one step inside the stack, not a return to the search');
});

test('NAV-01: with nothing suspended, reaching the bottom of a stack is just the tab root', function () {
  const harness = navWithSearch(null);
  harness.nav.push('apps', { kind: 'opml', label: 'Qobuz' });

  harness.popstate({ state: { echoClassic: true, tab: 'apps', depth: 0, frames: [] } });

  assert.equal(harness.nav.depth('apps'), 0);
  assert.deepEqual(harness.resumed, ['apps'],
    'the offer is made and declined by LmsUi -- nav.js must not keep its own idea of whether a search is pending');
});

test('NAV-01: the contextual Back returns to the search only when it pops the search frame itself', function () {
  const app = appInstance();
  const stack = [];
  app.self.nav.music = stack;
  app.ctx.LmsNav = {
    stacks: { music: stack },
    top: function () { return stack.length ? stack[stack.length - 1] : null; },
    back: function () { return stack.pop(); },
    depth: function () { return stack.length; },
    reset: function () { stack.length = 0; },
    parentLabel: function (tab, root) { return stack.length > 1 ? stack[stack.length - 2].label : root; }
  };

  stack.push({ kind: 'artist', id: 1, label: 'The Beatles', fromSearch: true });
  stack.push({ kind: 'album', id: 9, label: 'Revolver' });

  app.self.goBack();
  assert.equal(stack.length, 1);
  assert.deepEqual(app.calls.resume, [], 'one level up from the album is the artist, not the results');

  app.self.goBack();
  assert.equal(stack.length, 0);
  assert.deepEqual(app.calls.resume, ['music'],
    'popping the frame that came from the search is what returns to it');
});

test('NAV-01: the Back label reads Search only while a search is actually suspended', function () {
  const app = appInstance();
  const stack = [];
  app.self.nav.music = stack;
  app.ctx.LmsNav = {
    stacks: { music: stack },
    top: function () { return stack.length ? stack[stack.length - 1] : null; },
    depth: function () { return stack.length; },
    parentLabel: function (tab, root) { return stack.length > 1 ? stack[stack.length - 2].label : root; }
  };
  Object.keys(app.def.computed).forEach(function (name) {
    Object.defineProperty(app.self, name, { get: app.def.computed[name].bind(app.self), configurable: true });
  });
  stack.push({ kind: 'artist', id: 1, label: 'The Beatles', fromSearch: true });

  app.ui.searchReturn = true;
  assert.equal(app.self.back, 'Search');

  /* After a reload the stack survives in localStorage and the snapshot does
     not. Promising a return that cannot happen is worse than the defect. */
  app.ui.searchReturn = false;
  assert.equal(app.self.back, 'Artists');
});
