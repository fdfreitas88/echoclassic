const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

function settingsMethods() {
  let definition = null;
  helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/settings.js', {
    Vue: { component: function (name, def) { definition = def; } },
    LmsUi: { state: {} },
    LmsStore: { state: {} },
    LmsApi: {}
  });
  return definition.methods;
}

test('settings import validation rejects malformed stored values', function () {
  const methods = settingsMethods();
  const ctx = Object.assign({}, methods);

  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ tab: 'musica' })), null);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ tab: 'broken' })), /tab/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.nav.v1', JSON.stringify({ musica: 'bad' })), /pilha/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.history.v1', JSON.stringify({})), /lista/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.session.v2', 'not json'), /não é JSON válido/);
});
