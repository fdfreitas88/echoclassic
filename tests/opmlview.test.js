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
