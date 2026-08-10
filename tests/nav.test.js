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

