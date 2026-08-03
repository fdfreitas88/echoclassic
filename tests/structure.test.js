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
  assert.match(joined, /Fila de reprodução/);
  assert.match(joined, /Abrir Minha Música/);
  assert.match(joined, /albumSubtitle\(a\)/);
  assert.match(helpers.read('EchoClassic/HTML/echoclassic/html/js/opmlview.js'), /Você ainda não adicionou favoritos/);
});
