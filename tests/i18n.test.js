const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('strings.txt is keyed by English, with the translations alongside', function () {
  const text = helpers.read('EchoClassic/strings.txt');
  const entries = {};
  let key = '';
  text.split(/\r?\n/).forEach(function (line) {
    const top = line.match(/^([A-Z0-9_]+)$/);
    if (top) {
      key = top[1];
      entries[key] = {};
      return;
    }
    const value = line.match(/^\t([A-Z]{2})\t([\s\S]*)$/);
    if (value && key) entries[key][value[1]] = value[2];
  });
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH.EN, 'Search');
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH.PT, 'Buscar');
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH_THE_LIBRARY.EN, 'Search the library');
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH_THE_LIBRARY.PT, 'Buscar na biblioteca');
  assert.ok(Object.keys(entries).length >= 250);
});

test('i18n rewrites default expressions but preserves Vue filters', function () {
  const captured = {};
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/i18n.js', {
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: {
        'Settings': 'Ajustes',
        'not available': 'não informado',
        'Volume': 'Volume',
        'Album': 'Álbum'
      }
    },
    LMS_LANG_NAMES: { EN: 'English', PT: 'Português' },
    Vue: {
      prototype: {},
      component: function (name, definition) {
        captured[name] = definition;
        return definition;
      }
    },
    document: { readyState: 'complete' }
  });

  const tpl = "<div>Settings {{ value || 'not available' }} {{ amount | count }} <input placeholder=\"Album\"></div>";
  const translated = ctx.LmsStr.translateTemplate(tpl);
  assert.match(translated, />Ajustes/);
  assert.match(translated, /\{\{ \$t\(value \|\| 'not available'\) \}\}/);
  assert.match(translated, /\{\{ amount \| count \}\}/);
  assert.match(translated, /placeholder="Álbum"/);
});

/* friendlyError devolve literais em portugues que a interpolacao do template
   traduz em tempo de execucao -- mas so se a frase existir no dicionario. A de
   timeout nao existia, e aparecia em portugues numa sessao em ingles, por cima
   do cabecalho. Este teste cobre todas de uma vez. */
test('toda frase de friendlyError tem entrada no strings.txt', function () {
  const store = helpers.read('EchoClassic/HTML/echoclassic/html/js/store.js');
  const corpo = store.split('function friendlyError')[1].split('\n  }')[0];
  const frases = (corpo.match(/return '[^']+'/g) || [])
    .map(function (m) { return m.slice(8, -1); })
    .filter(function (f) { return /[a-zA-Z]/.test(f) && f.indexOf('{') < 0; });
  assert.ok(frases.length >= 4, 'esperava achar as frases de erro');

  const strings = helpers.read('EchoClassic/strings.txt');
  frases.forEach(function (frase) {
    assert.ok(strings.indexOf('\t' + frase) >= 0,
      'frase de erro sem traducao possivel: ' + frase);
  });
});

/* O projeto e internacional: nenhum rotulo montado em JavaScript pode chegar a
   tela sem ter como ser traduzido. Este teste varre os literais de interface de
   todos os modulos -- os que o translateTemplate nao alcanca, porque nascem de
   um return e nao de um no de texto -- e cobra entrada no strings.txt. Foi
   assim que "Set the volume on the DAC" e "Local library" apareceram em
   portugues numa sessao em ingles, e o segundo saiu numa foto do README. */
test('todo rotulo de interface montado em JavaScript pode ser traduzido', function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const strings = helpers.read('EchoClassic/strings.txt');
  const dir = path.join(helpers.skin, 'js');

  const arquivos = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (entry) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) arquivos.push(full);
    });
  })(dir);

  const portugues = /\b(não|você|está|para|com|sem|pelo|pela|dos|das|uma|nenhum|todos|volume|ajuste|servidor|reprodução|faixa|álbum|fila|erro|falha|fixo|escala|cheia|silêncio|aviso|salva|salvo)\b/i;
  const literal = /return '([^'\\]{8,120})'|\? '([^'\\]{8,120})' : '([^'\\]{8,120})'/g;
  const faltando = [];

  arquivos.forEach(function (file) {
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = literal.exec(src))) {
      [m[1], m[2], m[3]].forEach(function (frase) {
        if (!frase || !portugues.test(frase)) return;
        /* Frase com marcador e montada depois da traducao; tag HTML nao e texto. */
        if (frase.indexOf('{') >= 0 || frase.indexOf('<') >= 0) return;
        if (strings.indexOf('\t' + frase) >= 0) return;
        faltando.push(path.basename(file) + ': ' + frase);
      });
    }
  });

  assert.deepEqual(faltando, [], 'rotulos sem entrada no strings.txt');
});

/* I18N-01: the action sheet shipped three Portuguese commands in an English
   session. `Reproduzir agora`, `Reproduzir a seguir` and `Fixar no Echo
   Classic` are template literals, so i18n.js could never translate them: the
   dictionary is keyed by the English phrase, and there was no English phrase.
   Everyone saw them in Portuguese, in every language.

   This pins both halves of the fix -- English in the source, Portuguese in
   strings.txt -- because either one alone silently reintroduces the defect. */

function stringsEntries() {
  const text = helpers.read('EchoClassic/strings.txt');
  const entries = {};
  let key = '';
  text.split(/\r?\n/).forEach(function (line) {
    const top = line.match(/^([A-Z0-9_]+)$/);
    if (top) { key = top[1]; entries[key] = {}; return; }
    const value = line.match(/^\t([A-Z]{2})\t([\s\S]*)$/);
    if (value && key) entries[key][value[1]] = value[2];
  });
  return entries;
}

test('I18N-01: the action sheet commands are English in the source', function () {
  const actions = helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
  ['Reproduzir agora', 'Reproduzir a seguir', 'Fixar no Echo Classic'].forEach(function (pt) {
    assert.ok(actions.indexOf(pt) < 0,
      'a Portuguese template literal cannot be translated -- ' + pt + ' would show in every language');
  });
  assert.match(actions, />Play now</);
  assert.match(actions, />Play next</);
  assert.match(actions, /'Remove from pinned items' : 'Pin to Echo Classic'/,
    'the pin label is an expression, so it is $t() at runtime -- it still has to hold the English phrase to look up');
});

test('I18N-01: each action-sheet command has its Portuguese translation', function () {
  const entries = stringsEntries();
  const expected = {
    ECHOCLASSIC_UI_PLAY_NOW: ['Play now', 'Reproduzir agora'],
    ECHOCLASSIC_UI_PLAY_NEXT: ['Play next', 'Reproduzir a seguir'],
    ECHOCLASSIC_UI_PIN_TO_ECHO_CLASSIC: ['Pin to Echo Classic', 'Fixar no Echo Classic']
  };
  Object.keys(expected).forEach(function (key) {
    assert.ok(entries[key], key + ' missing from strings.txt');
    assert.equal(entries[key].EN, expected[key][0]);
    assert.equal(entries[key].PT, expected[key][1]);
  });
});

test('I18N-01: the sheet is fully translated in PT -- no command falls back to English', function () {
  const actions = helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js');
  const entries = stringsEntries();
  const dictionary = {};
  Object.keys(entries).forEach(function (key) {
    if (/^ECHOCLASSIC_UI_/.test(key) && entries[key].EN && entries[key].PT) {
      dictionary[entries[key].EN] = entries[key].PT;
    }
  });
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/i18n.js', {
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: { PT: dictionary },
    LMS_LANG_NAMES: { EN: 'English', PT: 'Português' },
    Vue: { prototype: {}, component: function () {} },
    document: { readyState: 'complete' }
  });
  const template = actions.match(/template:\s*`([\s\S]*?)`\s*,\n/)[1];
  const translated = ctx.LmsStr.translateTemplate(template);
  assert.match(translated, />Reproduzir agora</);
  assert.match(translated, />Reproduzir a seguir</);
  assert.equal(ctx.LmsStr.t('Pin to Echo Classic'), 'Fixar no Echo Classic',
    'the pin label goes through $t() at runtime rather than the template rewrite');
});
