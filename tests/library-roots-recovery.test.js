const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('failed background root discovery preserves the selected library and settles without rejection', async () => {
  let definition, resets = 0;
  const ctx = helpers.uiContext({
    console: { debug() {} },
    Vue: { prototype: {}, observable: o => o, component: (name, def) => { definition = def; } },
    LmsApi: { libraryRoots: async () => { throw new Error('server timeout'); } },
    LmsUi: { setLibraryRoot: () => { resets++; } }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');
  const roots = [{ key: 'all' }, { key: 'library:one' }];
  const view = { libraries: roots, store: { playerId: 'p1' }, ui: { rootKey: 'library:one' } };
  assert.equal(await definition.methods.loadLibraries.call(view), false);
  assert.equal(view.libraries, roots);
  assert.equal(resets, 0);
});
