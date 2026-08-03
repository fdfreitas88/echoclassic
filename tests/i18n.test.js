const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('strings.txt parses PT keys and EN values', function () {
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
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH.PT, 'Buscar');
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH.EN, 'Search');
  assert.equal(entries.ECHOCLASSIC_UI_SEARCH_THE_LIBRARY.PT, 'Buscar na biblioteca');
  assert.ok(Object.keys(entries).length >= 250);
});

test('i18n rewrites default expressions but preserves Vue filters', function () {
  const captured = {};
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/i18n.js', {
    LMS_LANG: 'EN',
    LMS_STRINGS: {
      'Ajustes': 'Settings',
      'não informado': 'unknown',
      'Volume': 'Volume',
      'Álbum': 'Album'
    },
    Vue: {
      prototype: {},
      component: function (name, definition) {
        captured[name] = definition;
        return definition;
      }
    },
    document: { readyState: 'complete' }
  });

  const tpl = "<div>Ajustes {{ value || 'não informado' }} {{ amount | count }} <input placeholder=\"Álbum\"></div>";
  const translated = ctx.LmsStr.translateTemplate(tpl);
  assert.match(translated, />Settings/);
  assert.match(translated, /\{\{ \$t\(value \|\| 'não informado'\) \}\}/);
  assert.match(translated, /\{\{ amount \| count \}\}/);
  assert.match(translated, /placeholder="Album"/);
});
