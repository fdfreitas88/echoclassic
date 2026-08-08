const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const helpers = require('./helpers');

/* 3.2.6b WP2/WP3: assercoes estaticas sobre o CSS (nao ha DOM real neste
   harness) e sobre os templates (via helpers.templates()). O que aqui vira
   asserção nao pode regredir em silencio -- um par [data-surface-scheme]
   esquecido para um esquema novo so aparece na tela quando alguem escolhe
   justamente aquele esquema numa superficie. */

function css() {
  return helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
}

function ui() {
  let definition = null;
  const ctx = helpers.uiContext({
    Vue: {
      observable: function (o) { return o; },
      component: function () {},
      nextTick: function (f) { if (f) f(); }
    }
  });
  return ctx.LmsUi;
}

test('todo esquema de cor tem par claro e par escuro de superficie no CSS', function () {
  const sheet = css();
  const LmsUi = ui();
  LmsUi.COLOR_SCHEMES.forEach(function (scheme) {
    const light = new RegExp('\\[data-surface-scheme="' + scheme.key + '"\\]\\s*\\{');
    const dark = new RegExp('\\[data-surface-theme="dark"\\]\\[data-surface-scheme="' +
      scheme.key + '"\\]\\s*\\{');
    assert.match(sheet, light, scheme.key + ': falta [data-surface-scheme="' + scheme.key + '"]');
    assert.match(sheet, dark, scheme.key + ': falta o par escuro combinado com data-surface-theme');
  });
});

/* Forma estatica do defeito relatado pelo coordenador: um
   [data-surface-scheme="k"] desacompanhado de qualquer mencao a
   data-surface-theme no MESMO seletor sempre aplica o par de acento sem
   olhar para o chao (claro/escuro) em que a superficie esta -- foi assim que
   um esquema escolhido so no Mini, com o tema do Mini em "Follow app" e o
   app no tema escuro, pintava o par CLARO sobre o fundo escuro. Uma regra
   correta sempre qualifica o chao, seja excluindo o oposto
   (":not([data-surface-theme=\"dark\"])"), seja exigindo o proprio
   (compondo com "[data-surface-theme=\"light\"]" ou ="dark""). */
test('nenhuma regra [data-surface-scheme] aparece sem qualificar o chao (tema)', function () {
  const sheet = css();
  const selectors = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRe.exec(sheet))) {
    match[1].split(',').forEach(function (sel) { selectors.push(sel.trim()); });
  }
  /* So os seletores que fixam um esquema especifico (com valor entre aspas)
     sao o padrao do defeito -- a regra generica do alias do gauge usa
     [data-surface-scheme] sem valor, casa com qualquer esquema, e nao fixa
     --accent sozinha; essa nao precisa (nem faz sentido) qualificar chao. */
  const schemeSelectors = selectors.filter(function (sel) {
    return /data-surface-scheme\s*=\s*"/.test(sel);
  });
  assert.ok(schemeSelectors.length > 0, 'esperava encontrar seletores data-surface-scheme');
  schemeSelectors.forEach(function (sel) {
    assert.ok(sel.indexOf('data-surface-theme') >= 0,
      'seletor sem qualificador de chao: "' + sel + '"');
  });
});

test('toda fonte tem uma regra [data-surface-font] no CSS', function () {
  const sheet = css();
  const LmsUi = ui();
  LmsUi.FONT_OPTIONS.forEach(function (font) {
    const re = new RegExp('\\[data-surface-font="' + font.key + '"\\]\\s*\\{');
    assert.match(sheet, re, font.key + ': falta [data-surface-font="' + font.key + '"]');
  });
});

/* N7 (audit 3.2.6c C1): [data-surface-font="x"] so redefine a custom property
   --app-font; sem uma regra que reaplique font-family a partir dela na propria
   superficie, o valor nunca e re-resolvido e a superficie herda a familia ja
   resolvida do body -- a troca de fonte por player fica sem efeito. */
test('[data-surface-font] reaplica font-family a partir de --app-font', function () {
  const sheet = css();
  assert.match(sheet, /\[data-surface-font\]\s*\{\s*font-family\s*:\s*var\(--app-font\)\s*\}/,
    'falta a regra que torna a fonte por superficie efetiva');
});

test('os dois blocos de tema de superficie existem e declaram os tokens essenciais', function () {
  const sheet = css();
  const lightMatch = sheet.match(/\[data-surface-theme="light"\]\s*\{([^}]*)\}/);
  const darkMatch = sheet.match(/\[data-surface-theme="dark"\][^{,]*\{([^}]*)\}|body\.dark,\s*\[data-surface-theme="dark"\]\s*\{([^}]*)\}/);
  assert.ok(lightMatch, 'falta [data-surface-theme="light"]');
  assert.ok(darkMatch, 'falta [data-surface-theme="dark"] (isolado ou combinado com body.dark)');

  const lightBody = lightMatch[1];
  const darkBody = darkMatch[1] || darkMatch[2];
  ['--content', '--text', '--chrome', '--accent'].forEach(function (token) {
    assert.match(lightBody, new RegExp(token.replace(/[-]/g, '\\-') + '\\s*:'),
      'tema claro de superficie sem ' + token);
    assert.match(darkBody, new RegExp(token.replace(/[-]/g, '\\-') + '\\s*:'),
      'tema escuro de superficie sem ' + token);
  });
  assert.match(lightBody, /color-scheme\s*:\s*light/);
  assert.match(darkBody, /color-scheme\s*:\s*dark/);
});

test('os dois @font-face declaram font-display:swap e apontam para ../fonts/*.woff2', function () {
  const sheet = css();
  const faces = sheet.match(/@font-face\s*\{[^}]*\}/g) || [];
  const podium = faces.filter(function (b) { return /Podium Sans/.test(b); })[0];
  const espy = faces.filter(function (b) { return /Espy Sans/.test(b); })[0];
  assert.ok(podium, 'falta @font-face de Podium Sans');
  assert.ok(espy, 'falta @font-face de Espy Sans');
  [podium, espy].forEach(function (block) {
    assert.match(block, /font-display\s*:\s*swap/);
    assert.match(block, /url\(["']\.\.\/fonts\/[^"')]+\.woff2["']\)\s*format\(["']woff2["']\)/);
  });
});

test('html/fonts existe e nao contem nenhum .woff2 -- a base da queda para Geneva/Verdana', function () {
  const dir = path.join(helpers.skin, 'fonts');
  assert.ok(fs.existsSync(dir), 'html/fonts deveria existir');
  const entries = fs.readdirSync(dir);
  assert.ok(entries.length > 0, 'html/fonts nao pode ficar vazio (git nao versiona diretorio vazio)');
  entries.forEach(function (name) {
    assert.doesNotMatch(name, /\.woff2$/i, name + ': o dono ainda nao forneceu as fontes');
  });
});

test('nenhum template contem um data-surface-* literal igual a "app"', function () {
  const templates = helpers.templates();
  templates.forEach(function (item) {
    assert.doesNotMatch(item.template, /data-surface-(theme|scheme|font)\s*=\s*"app"/,
      item.file + ': vazou o sentinela "app" para o template');
  });
});

/* WP4 (3.2.6b): a UI pass que criou o branch appearanceScreen ficou proibida
   de tocar ios9.css e por isso enviou classes sem NENHUMA regra correspondente
   -- este e exatamente o defeito que a passada de CSS teve que consertar.
   Esta funcao extrai a lista de classes literalmente usada naquele branch (e
   nao uma lista copiada a mao, que fica presa no dia em que foi escrita) para
   que o teste continue valendo se o branch crescer. */
function appearanceDetailClasses() {
  const templates = helpers.templates();
  const settingsTpl = templates.filter(function (item) {
    return item.file.indexOf(path.join('js', 'settings.js')) >= 0;
  })[0];
  assert.ok(settingsTpl, 'nao achei o template de lms-settings via helpers.templates()');

  const start = settingsTpl.template.indexOf('v-else-if="ui.appearanceScreen"');
  const end = settingsTpl.template.indexOf('<div v-else class="settings">');
  assert.ok(start >= 0 && end > start,
    'nao achei o branch appearanceScreen (settings.js mudou de forma?)');
  const branch = settingsTpl.template.slice(start, end);

  /* Por tag, para saber quais classes (estaticas + dinamicas) co-ocorrem no
     MESMO elemento -- e o que separa um wrapper puramente semantico (que
     nunca teve regra propria: .font-option-group, .color-scheme-group ja
     eram assim antes desta passada) de uma classe de linha/conteudo, que
     precisa mesmo de uma regra. */
  const tags = branch.match(/<[a-zA-Z][^<>]*>/g) || [];
  const perTagClasses = [];
  tags.forEach(function (tag) {
    const classes = {};
    const attrRe = /:?class="([^"]*)"/g;
    let m;
    while ((m = attrRe.exec(tag))) {
      const dynamic = m[0].charAt(0) === ':';
      const val = m[1];
      if (dynamic) {
        // ternario: :class="cond ? 'a' : (...)" -- so o ramo verdadeiro e um
        // literal estatico previsivel; o outro ramo aqui e sempre concatenacao.
        let tm;
        const ternRe = /\?\s*'([^']+)'/g;
        while ((tm = ternRe.exec(val))) { classes[tm[1].trim()] = true; }
        // sintaxe de objeto: :class="{on: expr}"
        let om;
        const objRe = /\{\s*([a-zA-Z0-9_-]+)\s*:/g;
        while ((om = objRe.exec(val))) { classes[om[1]] = true; }
      } else {
        val.split(/\s+/).forEach(function (t) { if (t) classes[t] = true; });
      }
    }
    const list = Object.keys(classes);
    if (list.length) perTagClasses.push(list);
  });

  /* Classes que co-ocorrem, na MESMA tag, com uma destas tres ja cobrem toda
     a aparencia sem precisar de regra propria -- e o padrao ja usado antes
     desta passada: .sgroup/.settings dao a caixa inteira (container), e
     .setting-select ja da toda a aparencia do <select> em si; as classes
     mini-gauge-color/player-gauge-color penduradas nele [code: ui.js:469-470
     le body[data-mini-gauge-color]/body[data-player-gauge-color], nunca a
     classe] sao so identificadores, nunca ganchos de estilo. */
  var SELF_SUFFICIENT = ['sgroup', 'settings', 'setting-select'];
  const all = new Set();
  const groupHooks = new Set();
  perTagClasses.forEach(function (list) {
    list.forEach(function (c) { all.add(c); });
    if (list.some(function (c) { return SELF_SUFFICIENT.indexOf(c) >= 0; })) {
      list.forEach(function (c) { groupHooks.add(c); });
    }
  });

  return { all: Array.from(all), groupHooks: groupHooks };
}

test('toda classe do branch appearanceScreen tem regra correspondente em ios9.css (ou e um wrapper puro, como .sgroup ja era)', function () {
  const sheet = css();
  const derived = appearanceDetailClasses();

  /* Uma classe que so aparece ao lado de .sgroup/.settings na mesma tag nunca
     precisou de regra propria neste arquivo -- .font-option-group e
     .color-scheme-group [code: ios9.css nao tem nenhuma ocorrencia de
     nenhuma das duas string] ja seguiam essa convencao antes desta passada,
     e e exatamente por isso que .theme-option-group / .player-position-group
     tambem nao ganharam regra propria aqui: a caixa vem inteira de .sgroup. */
  derived.all.forEach(function (name) {
    if (derived.groupHooks.has(name)) return;
    const re = new RegExp('\\.' + name.replace(/[-]/g, '\\-') + '(?![a-zA-Z0-9_-])');
    assert.match(sheet, re, name + ': classe usada no branch appearanceScreen sem nenhuma regra em ios9.css');
  });
});

/* O ponto inteiro de .surface-preview e nunca mentir sobre a superficie: toda
   cor tem que vir de --content/--chrome/--text/--text2/--accent, nunca de um
   hex literal (que so estaria certo para UM esquema/tema por acidente). */
test('nenhuma regra de .surface-preview* usa uma cor hexadecimal literal', function () {
  const sheet = css();
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  let checked = 0;
  while ((match = ruleRe.exec(sheet))) {
    const selectors = match[1].split(',').map(function (s) { return s.trim(); });
    const touchesSurfacePreview = selectors.some(function (sel) {
      return sel.indexOf('.surface-preview') >= 0;
    });
    if (!touchesSurfacePreview) continue;
    checked += 1;
    assert.doesNotMatch(match[2], /#[0-9a-fA-F]{3,8}\b/,
      'regra de .surface-preview com hex literal: ' + match[1].trim());
  }
  assert.ok(checked > 0, 'esperava encontrar pelo menos uma regra de .surface-preview em ios9.css');
});
