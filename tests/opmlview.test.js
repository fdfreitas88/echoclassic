const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function component() {
  let definition = null;
  const ctx = helpers.browserContext({
    Vue: { component: function (name, def) { definition = def; } },
    LmsNav: { top: function () { return null; } },
    LmsApi: {},
    LmsStore: { state: {} },
    LmsUi: {}
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/opmlview.js');
  return definition;
}

test('malformed favourite is an actionable recovery state, not a dead row', function () {
  const def = component();
  const vm = { root: 'favorites', items: [{ kind: 'audio', title: 'No Reply', playNode: null }] };
  vm.hasContent = def.computed.hasContent.call(vm);
  assert.equal(vm.hasContent, false);
  assert.equal(def.computed.invalidContent.call(vm), true);
  assert.match(def.template, /Could not load favourites/);
  assert.match(def.template, /@click="load">Try again/);
});

test('OPML content only includes controls that can perform their action', function () {
  const def = component();
  assert.equal(def.computed.hasContent.call({ items: [{ kind: 'menu', node: null }] }), false);
  assert.equal(def.computed.hasContent.call({ items: [{ kind: 'menu', node: 'x' }] }), true);
  assert.equal(def.computed.hasContent.call({ items: [{ kind: 'audio', playNode: 'x' }] }), true);
  assert.equal(def.computed.hasContent.call({ items: [{ kind: 'search' }] }), true);
});

/* ERR-01: the Apps screen printed the wire straight to the user --
   `[network] qobuz items 0 200 menu:qobuz: Failed to fetch`. The RPC verb, the
   pagination window and the fetch's own words, none of which tell anyone what
   to do. The technical string belongs in the console, which is where
   friendlyError already puts it; the screen gets the family of failure plus a
   human action. */

function opmlInstance(extra) {
  let definition = null;
  const notices = [];
  const ctx = helpers.browserContext(Object.assign({
    Vue: { component: function (name, def) { definition = def; } },
    LmsNav: { top: function () { return null; }, push: function () {} },
    LmsApi: { opmlRoot: function () { return 'menu:qobuz'; } },
    LmsStore: {
      state: { playerId: 'p1' },
      /* The real implementation: the point of the fix is that the view calls
         it, so a stub would prove nothing. */
      friendlyError: function (error, fallback) {
        if (!error) return fallback;
        if (error.kind === 'network') return 'Could not reach the server.';
        if (error.kind === 'timeout') return 'The server took too long to answer.';
        return (error.kind ? fallback : (error.message || fallback)) || fallback;
      }
    },
    LmsUi: { notify: function (message) { notices.push(message); } },
    console: { debug: function () {} }
  }, extra || {}));
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/opmlview.js');

  const self = Object.assign(definition.data(), { root: 'apps', tab: 'apps' });
  self.$nextTick = function (f) { if (f) f.call(self); };
  Object.keys(definition.methods).forEach(function (name) {
    self[name] = definition.methods[name].bind(self);
  });
  Object.keys(definition.computed).forEach(function (name) {
    Object.defineProperty(self, name, { get: definition.computed[name].bind(self) });
  });
  return { self: self, def: definition, notices: notices, ctx: ctx };
}

/* The exact shape api.js raises for the failure the audit saw. */
function qobuzFailure() {
  const error = new Error('[network] qobuz items 0 200 menu:qobuz: Failed to fetch');
  error.kind = 'network';
  return error;
}

function assertNoWire(text) {
  assert.doesNotMatch(text, /\[network\]|\[timeout\]|\[http\]|\[lms\]|\[parse\]/,
    'the error kind is a marker for the console, not for a person: ' + text);
  assert.doesNotMatch(text, /Failed to fetch/, 'the fetch\'s own words say nothing actionable: ' + text);
  assert.doesNotMatch(text, /menu:|qobuz items/, 'the RPC verb must not reach the screen: ' + text);
  assert.doesNotMatch(text, /\b0 200\b/, 'the pagination window is an implementation detail: ' + text);
}

test('ERR-01: a failed browse states the problem and the action, never the RPC', async function () {
  const view = opmlInstance();
  view.ctx.LmsApi.opmlBrowse = async function () { throw qobuzFailure(); };

  await view.self.load();

  assertNoWire(view.self.error);
  assert.equal(view.self.error,
    'Could not reach the server. Check the connection or the service status and try again.');
  assert.deepEqual(JSON.parse(JSON.stringify(view.self.items)), [], 'the list is emptied, and the template already offers Try again and Back to Apps');
});

test('ERR-01: a failed station play says the same thing in a notice', async function () {
  const view = opmlInstance();
  view.ctx.LmsApi.opmlPlay = async function () { throw qobuzFailure(); };

  await view.self.play({ title: 'Radio Paradise', playNode: 'x' });

  assert.equal(view.notices.length, 1);
  assertNoWire(view.notices[0]);
  assert.match(view.notices[0], /Radio Paradise/, 'which station failed is the one detail worth keeping');
  assert.match(view.notices[0], /Check the connection or the service status and try again\./);
});

test('ERR-01: a failed in-service search reports against the field, still without the wire', async function () {
  const view = opmlInstance();
  view.ctx.LmsApi.opmlSearch = async function () { throw qobuzFailure(); };
  view.self.terms = { 0: 'beatles' };

  await view.self.search({ node: 'menu:qobuz' }, 0);

  assertNoWire(view.self.fieldError);
  assert.match(view.self.fieldError, /Check the connection or the service status and try again\./);
});

test('ERR-01: every phrase the view adds is translatable', function () {
  const strings = helpers.read('EchoClassic/strings.txt');
  [
    'Check the connection or the service status and try again.',
    'This service did not answer.',
    'The station did not answer.'
  ].forEach(function (phrase) {
    assert.ok(strings.indexOf('\tEN\t' + phrase) >= 0, 'missing from strings.txt: ' + phrase);
  });
});
