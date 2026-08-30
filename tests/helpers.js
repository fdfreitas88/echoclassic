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
  /* format.js de verdade, e nao um stub: o comparador de edicoes mora la, e um
     stub inventado mentiria sobre a forma do objeto -- foi assim que
     settings-import quebrou. */
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/format.js');
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');
  return { def: definition, ctx: ctx };
}

/* Mesmo arreio do browse, para o painel: LmsUi de verdade, format.js de verdade,
   e um LmsApi que devolve os generos que o painel pede. */
function filterPanelComponent(extra) {
  let definition = null;
  const ctx = uiContext(Object.assign({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    },
    LmsApi: {
      genres: async function () {
        return [{ id: 11, name: 'Rock' }, { id: 12, name: 'Jazz' }];
      }
    },
    LmsStore: { state: { playerId: 'p1' } },
    innerWidth: 1280,
    innerHeight: 900,
    addEventListener: function () {},
    removeEventListener: function () {}
  }, extra || {}));
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/format.js');
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/filterpanel.js');
  return { def: definition, ctx: ctx };
}

/* Instancia o painel sem Vue: liga os dados, resolve os computeds sob demanda e
   deixa os metodos com um `this` de verdade. */
function panelInstance(extra) {
  const captured = filterPanelComponent(extra);
  const def = captured.def;
  const self = def.data();
  self.$nextTick = function (f) { if (f) f(); };
  self.$refs = {};
  Object.keys(def.methods).forEach(function (name) {
    self[name] = def.methods[name].bind(self);
  });
  Object.keys(def.computed).forEach(function (name) {
    Object.defineProperty(self, name, { get: def.computed[name].bind(self) });
  });
  return { self: self, def: def, ctx: captured.ctx };
}

/* lms-settings, same no-Vue harness as the filter panel: real LmsUi, real
   LmsFmt. WP5 (3.2.6b, next pass) needs this to exercise the Appearance
   screens without duplicating the arreio settings-import.test.js already
   rolls for validateImportValue -- that file keeps its own settingsMethods()
   on purpose and is unaffected by this helper existing. */
function settingsComponent(extra) {
  let definition = null;
  const ctx = uiContext(Object.assign({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    },
    LmsApi: {},
    LmsStore: { state: { players: [], connected: false, playerId: null } }
  }, extra || {}));
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/format.js');
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/settings.js');
  return { def: definition, ctx: ctx };
}

/* Instancia o painel de ajustes sem Vue: liga os dados, resolve os computeds
   sob demanda e deixa os metodos com um `this` de verdade -- o mesmo arreio
   de panelInstance, para o componente que WP5 vai estender. */
function settingsInstance(extra) {
  const captured = settingsComponent(extra);
  const def = captured.def;
  const self = def.data();
  self.$nextTick = function (f) { if (f) f(); };
  self.$refs = {};
  Object.keys(def.methods).forEach(function (name) {
    self[name] = def.methods[name].bind(self);
  });
  Object.keys(def.computed).forEach(function (name) {
    Object.defineProperty(self, name, { get: def.computed[name].bind(self) });
  });
  return { self: self, def: def, ctx: captured.ctx };
}

/* The sort menu, instantiated the same way the filter panel is: no Vue, data
   bound, computeds resolved on demand, methods given a real `this`. */
function sortMenuInstance(extra, props) {
  let definition = null;
  const ctx = uiContext(Object.assign({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    },
    innerWidth: 1280,
    innerHeight: 900,
    addEventListener: function () {},
    removeEventListener: function () {}
  }, extra || {}));
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/sortmenu.js');
  /* The component reads document.activeElement to decide where focus goes.
     uiContext already installs a document with the listeners ui.js needs, so
     this adds the property rather than replacing the object. */
  if (ctx.document && !('activeElement' in ctx.document)) ctx.document.activeElement = null;
  const def = definition;
  const self = Object.assign(def.data(), {
    options: [], value: '', desc: false
  }, props || {});
  self.$nextTick = function (f) { if (f) f.call(self); };
  self.$refs = {};
  self.$emit = function (name, payload) { self.emitted.push([name, payload]); };
  self.emitted = [];
  Object.keys(def.methods).forEach(function (name) {
    self[name] = def.methods[name].bind(self);
  });
  Object.keys(def.computed).forEach(function (name) {
    Object.defineProperty(self, name, { get: def.computed[name].bind(self) });
  });
  return { self: self, def: def, ctx: ctx };
}

/* lms-queue, same no-Vue harness as the filter panel: real LmsUi (so
   queueArtMode reads the real default and setter), real LmsFmt, and a
   LmsStore stub the test fills in per case. */
function queueComponent(extra) {
  let definition = null;
  const ctx = uiContext(Object.assign({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, def) { definition = def; },
      nextTick: function (f) { if (f) f(); }
    },
    LmsStore: {
      state: {
        queue: [], queueIndex: 0, queueTotal: 0, mode: 'stop',
        shuffle: 0, repeat: 0, queueUndo: [], np: { id: null }
      },
      queueRemaining: function () { return 0; }
    }
  }, extra || {}));
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/format.js');
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/queue.js');
  return { def: definition, ctx: ctx };
}

function queueInstance(extra) {
  const captured = queueComponent(extra);
  const def = captured.def;
  const self = def.data();
  self.$nextTick = function (f) { if (f) f(); };
  self.$refs = {};
  Object.keys(def.methods).forEach(function (name) {
    self[name] = def.methods[name].bind(self);
  });
  Object.keys(def.computed).forEach(function (name) {
    Object.defineProperty(self, name, { get: def.computed[name].bind(self) });
  });
  return { self: self, def: def, ctx: captured.ctx };
}

module.exports = {
  /* strings.txt indexado por chave e idioma. Testes que so querem saber se um
     par EN/PT existe devem usar isto, e nao um regex de linhas vizinhas: a
     ordem das linhas de idioma dentro do bloco muda a cada idioma novo. */
  strings: function () {
    const text = module.exports.read('EchoClassic/strings.txt');
    const out = {}; let key = null;
    for (const line of text.split(/\r?\n/)) {
      if (/^[A-Z][A-Z0-9_]*$/.test(line)) { key = line; out[key] = out[key] || {}; continue; }
      const m = line.match(/^\t([A-Z]{2})\t([\s\S]*)$/);
      if (m && key) out[key][m[1]] = m[2];
    }
    return out;
  },
  root,
  skin,
  read,
  browserContext,
  runBrowserFile,
  runInContext,
  templates,
  uiContext,
  browseComponent,
  filterPanelComponent,
  panelInstance,
  settingsComponent,
  settingsInstance,
  sortMenuInstance,
  queueInstance
};
