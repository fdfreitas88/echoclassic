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
