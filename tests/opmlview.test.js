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
  self.$refs = {};
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
    'The station did not answer.',
    'New', 'Load next 100', 'Loading next 100…',
    'Could not load more items', 'The items already loaded are still available.',
    'No new items were returned. The items already loaded are still available.',
    'All 1 item loaded.', 'All {count} items loaded.',
    'Loaded one more item. {total} items loaded.',
    'Loaded {count} more items. {total} items loaded.'
  ].forEach(function (phrase) {
    assert.ok(strings.indexOf('\tEN\t' + phrase) >= 0, 'missing from strings.txt: ' + phrase);
  });
});

function pageItem(id, kind) {
  kind = kind || 'audio';
  return {
    identity: kind + ':id:' + id, kind: kind, title: 'Item ' + id,
    playNode: kind === 'audio' ? { cmd: ['play'], params: ['id:' + id] } : null,
    node: kind === 'menu' ? { cmd: ['items'], params: ['id:' + id] } : null
  };
}

test('LIST-01: first browse uses a 100-item page and offers continuation only for a full page', async function () {
  const view = opmlInstance();
  const calls = [];
  view.ctx.LmsApi.opmlBrowse = async function (player, node, start, count) {
    calls.push([player, start, count]);
    return Array.from({ length: 100 }, function (_, i) { return pageItem(i); });
  };

  await view.self.load();

  assert.deepEqual(calls, [['p1', 0, 100]]);
  assert.equal(view.self.items.length, 100);
  assert.equal(view.self.hasMore, true);
  assert.equal(view.self.nextStart, 100);
  assert.match(view.def.template, /opml-new-label/);
  assert.match(view.def.template, /Load next 100/);
});

test('LIST-01: next page appends unique usable rows, keeps actions and advances by the server page', async function () {
  const view = opmlInstance();
  view.ctx.LmsApi.opmlBrowse = async function (player, node, start, count) {
    if (start === 0) return Array.from({ length: 100 }, function (_, i) { return pageItem(i); });
    return [pageItem(99), pageItem(100), { identity: 'bad', kind: 'menu', node: null }];
  };
  await view.self.load();
  await view.self.loadMore();

  assert.equal(view.self.items.length, 101, 'boundary duplicate and malformed row are not appended');
  assert.equal(view.self.items[100].playNode.params[0], 'id:100', 'the appended row keeps its action');
  assert.equal(view.self.nextStart, 103, 'offset follows server rows, not the deduplicated visible count');
  assert.equal(view.self.hasMore, false, 'a short server page ends pagination');
  assert.match(view.self.pageStatus, /one more item.*101 items loaded/);
});

test('LIST-01: a full duplicate page stops with no progress instead of looping', async function () {
  const view = opmlInstance();
  const first = Array.from({ length: 100 }, function (_, i) { return pageItem(i); });
  view.ctx.LmsApi.opmlBrowse = async function (player, node, start) {
    return start ? first.slice() : first.slice();
  };
  await view.self.load();
  await view.self.loadMore();

  assert.equal(view.self.items.length, 100);
  assert.equal(view.self.hasMore, false);
  assert.equal(view.self.endReached, true);
  assert.equal(view.self.noProgress, true);
  assert.match(view.self.endMessage, /No new items/);
});

test('LIST-01: a recoverable page error preserves rows and retry uses the same offset', async function () {
  const view = opmlInstance();
  let failures = 1;
  const starts = [];
  view.ctx.LmsApi.opmlBrowse = async function (player, node, start) {
    starts.push(start);
    if (!start) return Array.from({ length: 100 }, function (_, i) { return pageItem(i); });
    if (failures--) throw qobuzFailure();
    return [pageItem(100)];
  };
  await view.self.load();
  await view.self.loadMore();
  assert.equal(view.self.items.length, 100);
  assert.ok(view.self.pageError);
  await view.self.loadMore();

  assert.deepEqual(starts, [0, 100, 100]);
  assert.equal(view.self.items.length, 101);
  assert.equal(view.self.pageError, '');
});

test('LIST-01: a response for a player that is no longer selected cannot append', async function () {
  const view = opmlInstance();
  let resolvePage;
  view.ctx.LmsApi.opmlBrowse = function (player, node, start) {
    if (!start) return Promise.resolve(Array.from({ length: 100 }, function (_, i) { return pageItem(i); }));
    return new Promise(function (resolve) { resolvePage = resolve; });
  };
  await view.self.load();
  const pending = view.self.loadMore();
  view.ctx.LmsStore.state.playerId = 'p2';
  resolvePage([pageItem(100)]);
  await pending;

  assert.equal(view.self.items.length, 100);
  assert.equal(view.self.items.some(function (it) { return it.identity === 'audio:id:100'; }), false);
});

test('LIST-01: changing player during the first page restarts loading for the new player', async function () {
  const view = opmlInstance();
  let resolveOld;
  view.ctx.LmsApi.opmlBrowse = function (player) {
    if (player === 'p1') return new Promise(function (resolve) { resolveOld = resolve; });
    return Promise.resolve([pageItem(200)]);
  };
  const oldLoad = view.self.load();
  view.ctx.LmsStore.state.playerId = 'p2';
  const newLoad = view.def.watch.playerId.call(view.self);
  await newLoad;
  resolveOld([pageItem(1)]);
  await oldLoad;

  assert.equal(view.self.loading, false);
  assert.equal(view.self.items.length, 1);
  assert.equal(view.self.items[0].identity, 'audio:id:200');
});

/* ERR-01, same class in the album screen. `rg "Could not open|Failed to fetch"`
   turned up a second catch printing e.message whole -- the marker and the RPC
   verb again, on the screen an artist or album lands on. */

test('ERR-01: the album screen reports a failure the same way Apps does', function () {
  const detail = helpers.read('EchoClassic/HTML/echoclassic/html/js/detail.js');
  assert.doesNotMatch(detail, /e && e\.message \? e\.message : String\(e\)/,
    'handing the raw message to the screen is the defect, wherever it appears');
  assert.match(detail, /this\.error = this\.serviceError\(e\);/);
  assert.match(detail, /LmsStore\.friendlyError\(e, 'This screen did not load\.'\)/,
    'friendlyError is what keeps the protocol string in the console instead of on screen');
  assert.match(detail, /this\.tr\('Check the connection or the service status and try again\.'\)/,
    'the action is the half a person can act on');
  const strings = helpers.read('EchoClassic/strings.txt');
  assert.ok(strings.indexOf('\tEN\tThis screen did not load.') >= 0);
});
