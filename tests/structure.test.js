const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('templates keep structural accessibility gates closed', function () {
  const templates = helpers.templates();
  const joined = templates.map(function (item) { return item.template; }).join('\n');
  const buttonRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  let match;

  while ((match = buttonRe.exec(joined))) {
    assert.doesNotMatch(match[1], /<button\b/i);
  }
  templates.forEach(function (item) {
    const roleButton = /role="button"/i.test(item.template);
    if (roleButton) {
      const roleChunks = item.template.split(/role="button"/i).slice(1);
      roleChunks.forEach(function (chunk) {
        const beforeClose = chunk.split(/<\/[^>]+>/)[0];
        assert.doesNotMatch(beforeClose, /<button\b/i, item.file);
      });
    }
  });
  assert.match(joined, /<h1[^>]*>\{\{ pageHeading \}\}<\/h1>/);
  assert.match(joined, /Playback queue/);
  assert.match(joined, /Choose a My Music root/);
  assert.match(joined, /albumSubtitle\(a\)/);
  assert.match(helpers.read('EchoClassic/HTML/echoclassic/html/js/opmlview.js'), /You have not added any favourites yet/);
  assert.match(helpers.read('EchoClassic/HTML/echoclassic/html/js/actions.js'), /tab="favourites"/);
  assert.doesNotMatch(helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js'), /'Filter' \+ viewLabel/);
});

test('a disconnected player identifies cached playback data instead of contradicting it', function () {
  const app = helpers.read('EchoClassic/HTML/echoclassic/html/js/app.js');
  assert.match(app, /\{\{ connectionMessage \}\}/);
  assert.match(app, /this\.store\.lastSuccess && this\.store\.np && this\.store\.np\.id/);
  assert.match(app, /Player connection lost\. Showing the last known track\./);
  assert.match(app, /Reconnecting…/);
  assert.doesNotMatch(app, /Reconectando…/);
});

test('dark footer tokens and tablet single-column breakpoint are explicit', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const dark = css.match(/body\.dark,\s*\[data-surface-theme="dark"\]\{([\s\S]*?)\n\}/);
  assert.ok(dark, 'dark theme block');
  ['--mini-bg:#0A0A0C', '--tab-bg:#0A0A0C', '--mini-control:#FFFFFF'].forEach(function (token) {
    assert.match(dark[1], new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.match(css, /responsivo: celular e tablet vertical[\s\S]*@media \(max-width:820px\)/);
  assert.match(css, /\.swatch-dot\{width:44px;height:44px/);
  assert.match(css, /@media \(max-width:480px\)[\s\S]*\.srow>\.swatch-row\{width:100%/);
});

/* O template so quebra em producao: um erro de compilacao aqui aparece como
   tela branca no navegador, sem nada no console do servidor. A Fase 2b
   acrescentou um `<template v-for>` com dois filhos com chave -- exatamente o
   padrao que o Vue 2 recusa quando a chave esta no lugar errado. */
test('todo template de componente compila no Vue 2', function () {
  const compiler = require('vue-template-compiler');
  const templates = helpers.templates();
  assert.ok(templates.length > 10, 'esperava encontrar os templates da skin');
  templates.forEach(function (item) {
    const out = compiler.compile(item.template);
    assert.deepEqual(out.errors, [], item.file + ': ' + out.errors.join(' | '));
  });
});

/* Um "--" dentro de comentario XML e ilegal, e um SVG mal formado pode
   simplesmente nao ser desenhado -- o icone do plugin e a primeira coisa que o
   usuario ve na pagina de Plugins. */
test('todo SVG servido como arquivo e XML bem formado', function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const dir = path.join(helpers.skin, 'images');
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).filter(function (f) { return f.endsWith('.svg'); }).forEach(function (f) {
    const full = path.join(dir, f);
    execFileSync('python3', ['-c',
      'import sys,xml.dom.minidom as m; m.parse(sys.argv[1])', full]);
    const src = fs.readFileSync(full, 'utf8');
    assert.doesNotMatch(src.replace(/<!--[\s\S]*?-->/g, ''), /--/,
      f + ': dois hifens fora de comentario tambem quebram parsers estritos');
  });
});

/* PUB-01: the 3.2.8 descriptor arrived ready to publish while saying, in its
   own words, "PRIVATE 3.2.8 QA CANDIDATE ... Do not publish", pointing at
   private-candidate/EchoClassic-3.2.8.zip. Every gate passed: check-version
   only compares numbers, and the packaging step only counted files -- and the
   file count was right, because the stale zip had the same files with older
   contents (its ios9.css and actions.js hashed differently from the tree).

   These pin the two gates that would have caught it. The release script itself
   is shell; what a test can hold is that the checks are declared and wired to
   the one URL the descriptor is allowed to carry. */

test('PUB-01: release.sh derives the public asset URL and rewrites the descriptor to it', function () {
  const release = helpers.read('tools/release.sh');
  assert.match(release, /EXPECTED_URL="https:\/\/github\.com\/fdfreitas88\/echoclassic\/releases\/download\/\$TAG\/EchoClassic-\$VERSION\.zip"/,
    'the URL has to be derived from the version, so the bump and the gate cannot disagree');
  assert.match(release, /sed -i '' "s\|<url>\[\^<\]\*<\/url>\|<url>\$EXPECTED_URL<\/url>\|" repo\.xml/,
    'the old sed only matched a URL that was already public, so private-candidate/... passed the bump untouched');
  assert.doesNotMatch(release, /s\|releases\/download\/v\[0-9\.\]\*/,
    'that narrower substitution is the hole PUB-01 came through');
});

test('PUB-01: release.sh refuses a descriptor that still calls itself private', function () {
  const release = helpers.read('tools/release.sh');
  assert.match(release, /grep -qi 'private-candidate\\\|do not publish\\\|nao publique' repo\.xml/,
    'a descriptor that says not to publish it cannot be the published descriptor');
  assert.match(release, /grep -q "<url>\$EXPECTED_URL<\/url>" repo\.xml/);
});

test('PUB-01: release.sh compares the package against the tree that produced it, not just the file count', function () {
  const release = helpers.read('tools/release.sh');
  assert.match(release, /unzip -qq "\$ZIP" -d "\$VERIFY"/);
  assert.match(release, /diff -r "\$SRC" "\$VERIFY\/\$SRC"/,
    'the 3.2.8 zip had the right number of files and the wrong contents -- only a content comparison sees that');
  assert.match(release, /o pacote nao e a arvore que o gerou/);
});

test('PUB-01: the committed descriptor is publishable -- public asset URL, no candidate marker, version agreed', function () {
  const repo = helpers.read('repo.xml');
  assert.doesNotMatch(repo, /private-candidate|[Dd]o not publish/,
    'this exact text shipped in the 3.2.8 descriptor while it sat ready to publish');

  const version = repo.match(/<plugin\s+name="EchoClassic"\s+version="([^"]+)"/)[1];
  const url = repo.match(/<url>([^<]+)<\/url>/)[1];
  assert.equal(url,
    'https://github.com/fdfreitas88/echoclassic/releases/download/v' + version +
    '/EchoClassic-' + version + '.zip',
    'the descriptor has to point at the asset of its own release: a local path installs nothing, and a URL from another version installs the wrong thing');
});
