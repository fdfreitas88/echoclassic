const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* O LmsUi vem do proprio ui.js, e nao de um stub escrito a mao. O stub antigo
   era `{ state: {} }`, sem TABS nem MUSIC_VIEWS -- e no 3.1.2, quando
   validateImportValue deixou de duplicar aqueles enums e passou a ler
   LmsUi.TABS, o stub virou a unica coisa que nao tinha as listas. O teste quebrou
   sem que nada estivesse errado no codigo de producao. */
function settingsMethods() {
  let definition = null;
  const ctx = helpers.uiContext({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  helpers.runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/settings.js');
  return definition.methods;
}

test('settings import validation rejects malformed stored values', function () {
  const methods = settingsMethods();
  const ctx = Object.assign({}, methods);

  assert.equal(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ tab: 'music' })), null);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.ui.v2', JSON.stringify({ tab: 'broken' })), /tab/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.nav.v1', JSON.stringify({ music: 'bad' })), /navigation stack/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.history.v1', JSON.stringify({})), /lista/);
  assert.match(methods.validateImportValue.call(ctx, 'echoclassic.session.v2', 'not json'), /não é JSON válido/);
});
