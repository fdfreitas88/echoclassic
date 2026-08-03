const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const skin = path.join(root, 'EchoClassic', 'HTML', 'echoclassic', 'html');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function browserContext(extra) {
  const ctx = Object.assign({
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Error,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    parseFloat,
    parseInt,
    isFinite,
    encodeURIComponent
  }, extra || {});
  ctx.window = ctx;
  ctx.globalThis = ctx;
  return ctx;
}

function runBrowserFile(rel, extra) {
  const ctx = browserContext(extra);
  vm.runInNewContext(read(rel), ctx, { filename: rel });
  return ctx;
}

function runInContext(ctx, rel) {
  vm.runInNewContext(read(rel), ctx, { filename: rel });
  return ctx;
}

function templates() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  }
  walk(path.join(skin, 'js'));
  const out = [];
  files.sort().forEach(function (file) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /template:\s*`([\s\S]*?)`\s*,\n/g;
    let match;
    while ((match = re.exec(src))) {
      out.push({
        file: path.relative(root, file),
        template: match[1]
      });
    }
  });
  return out;
}

/* ui.js e browse.js sao arquivos de navegador: no momento em que carregam ja
   registram efeitos no documento e no Vue. Estes dois arreios dao o minimo de
   DOM que cada um encosta, para que possam ser exercitados sem navegador.

   Vale mais do que parece: um stub inventado de LmsUi mente sobre a forma do
   objeto real -- foi assim que settings-import passou a falhar quando settings.js
   deixou de duplicar os enums e passou a ler LmsUi.TABS. Aqui o LmsUi e o de
   verdade, montado a partir do proprio ui.js. */
function uiContext(extra) {
  const store = {};
  const ctx = browserContext(Object.assign({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: {
      addEventListener: function () {},
      removeEventListener: function () {},
      documentElement: {
        style: { setProperty: function () {} },
        classList: { add: function () {}, remove: function () {}, toggle: function () {} }
      },
      body: {
        setAttribute: function () {}, removeAttribute: function () {},
        classList: { add: function () {}, remove: function () {}, toggle: function () {} }
      }
    },
    matchMedia: function () {
      return { matches: false, addEventListener: function () {}, addListener: function () {} };
    },
    navigator: { language: 'pt-BR' },
    Vue: {
      observable: function (o) { return o; },
      component: function () {},
      nextTick: function (f) { if (f) f(); }
    },
    LmsStore: { state: {} },
    LmsApi: {},
    LmsNav: { reset: function () {}, top: function () { return null; } }
  }, extra || {}));
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/ui.js');
  return ctx;
}

/* Devolve a definicao que browse.js entrega ao Vue.component, junto do contexto
   em que ela foi criada -- os metodos fecham sobre o LmsUi daquele contexto,
   entao trocar LmsUi.setSort ali dentro e o que permite observar as chamadas. */
function browseComponent() {
  let definition = null;
  const ctx = uiContext({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');
  return { def: definition, ctx: ctx };
}

module.exports = {
  root,
  skin,
  read,
  browserContext,
  runBrowserFile,
  runInContext,
  templates,
  uiContext,
  browseComponent
};
