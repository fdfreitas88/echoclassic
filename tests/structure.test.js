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
  assert.match(joined, /Abrir Minha Música/);
  assert.match(joined, /albumSubtitle\(a\)/);
  assert.match(helpers.read('EchoClassic/HTML/echoclassic/html/js/opmlview.js'), /Você ainda não adicionou favoritos/);
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
