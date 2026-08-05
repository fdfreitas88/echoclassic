#!/usr/bin/env node
/* Troca o idioma de origem da interface: portugues -> ingles.
 *
 * A camada de traducao nunca dependeu de qual idioma estava embutido nos
 * templates -- ela procura o texto do template num mapa. O que amarrava a skin
 * ao portugues era so a escolha da chave. Este script reescreve os templates
 * para ingles usando as traducoes que ja existem no strings.txt, para que a
 * chave passe a ser a frase em ingles.
 *
 * Rode com --dry para ver o que casaria sem escrever nada.
 *
 * Duas armadilhas que ele fecha:
 *   - frase longa aparece quebrada em varias linhas dentro do template, entao a
 *     busca precisa normalizar espaco em branco, exatamente como o lookup() do
 *     i18n.js faz em tempo de execucao;
 *   - frase curta pode estar contida numa longa ("Tocar" dentro de "Tocar a
 *     seguir"), entao as substituicoes vao da mais longa para a mais curta.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const STRINGS = path.join(ROOT, 'EchoClassic', 'strings.txt');
const JS_DIR = path.join(ROOT, 'EchoClassic', 'HTML', 'echoclassic', 'html', 'js');
const DRY = process.argv.includes('--dry');

/* ---------------------------------------------------------------- strings */
function readEntries() {
  const lines = fs.readFileSync(STRINGS, 'utf8').split('\n');
  const entries = [];
  let key = null, val = {};
  const flush = () => { if (key) entries.push({ key, val }); };
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (/^\S/.test(line) && line.trim()) { flush(); key = line.trim(); val = {}; continue; }
    const m = line.match(/^\s+([A-Z]{2})\s+(.*)$/);
    if (m) val[m[1]] = m[2];
  }
  flush();
  return entries;
}

const entries = readEntries().filter((e) => e.key.startsWith('ECHOCLASSIC_UI_'));
const pairs = entries
  .filter((e) => e.val.PT && e.val.EN && e.val.PT !== e.val.EN)
  .map((e) => ({ key: e.key, pt: e.val.PT, en: e.val.EN }))
  /* Da mais longa para a mais curta: senao "Tocar" consome o inicio de
     "Tocar a seguir" e a frase longa nunca chega a casar. */
  .sort((a, b) => b.pt.length - a.pt.length);

/* ------------------------------------------------------------------ files */
function jsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/* A regra de casamento e a mesma do lookup() em tempo de execucao: a frase so
   e trocada quando ela e o CONTEUDO INTEIRO de uma unidade de texto -- um no de
   texto, o valor de um atributo, ou um literal de string. Nunca um pedaco.
 *
 * Procurar a frase solta pelo arquivo parece equivalente e nao e: frase curta
 * do dicionario casa dentro de frase longa que nao esta nele. "Voltar para "
 * virou "Back para ", e "Desativado" virou "Fromsativado" porque "De" era uma
 * entrada. O que sobra sem traducao continua em portugues e aparece no
 * check-source-language -- resultado honesto; texto corrompido nao e. */
const NORM = new Map();
for (const p of pairs) {
  const key = p.pt.replace(/\s+/g, ' ').trim();
  if (!NORM.has(key)) NORM.set(key, p);
}

function unit(raw) {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return NORM.get(trimmed) || null;
}

function mark(p) {
  hits.set(p.key, (hits.get(p.key) || 0) + 1);
  return p.en;
}

const ATTRS = /(\s(?:aria-label|title|placeholder|aria-valuetext|aria-description)=")([^"]*)(")/g;

const files = jsFiles(JS_DIR).filter((f) => !/\/i18n\.js$/.test(f));
const hits = new Map();
const perFile = new Map();

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let text = before;
  let count = 0;

  /* 1. Nos de texto do template: >Texto< */
  text = text.replace(/>([^<>]+)</g, (all, inner) => {
    if (inner.indexOf('{{') >= 0) {
      /* Trecho fixo entre interpolacoes: cada pedaco e sua propria unidade. */
      const out = inner.replace(/\{\{[\s\S]*?\}\}|([^{]+)/g, (piece, literal) => {
        if (literal === undefined) return piece;
        const p = unit(literal);
        if (!p) return piece;
        count++;
        return literal.replace(literal.trim(), mark(p));
      });
      return '>' + out + '<';
    }
    const p = unit(inner);
    if (!p) return all;
    count++;
    return all.replace(inner.trim(), mark(p));
  });

  /* 2. Atributos estaticos lidos por pessoa. */
  text = text.replace(ATTRS, (all, open, value, close) => {
    const p = unit(value);
    if (!p) return all;
    count++;
    return open + mark(p).replace(/"/g, '&quot;') + close;
  });

  /* 3. Literais de string do JavaScript, inteiros. O apostrofo do ingles
        fecharia um literal em aspas simples, entao ele e escapado -- armadilha
        que so aparece depois da troca, porque portugues quase nao o usa. */
  text = text.replace(/'((?:[^'\\\n]|\\.)*)'/g, (all, body) => {
    const p = unit(body);
    if (!p) return all;
    count++;
    return "'" + mark(p).replace(/'/g, "\\'") + "'";
  });
  text = text.replace(/"((?:[^"\\\n]|\\.)*)"/g, (all, body) => {
    const p = unit(body);
    if (!p) return all;
    count++;
    return '"' + mark(p).replace(/"/g, '\\"') + '"';
  });

  if (text !== before) {
    perFile.set(path.relative(ROOT, file), count);
    if (!DRY) fs.writeFileSync(file, text);
  }
}

/* ----------------------------------------------------------------- report */
console.log((DRY ? '(dry run) ' : '') + 'phrases with both PT and EN: ' + pairs.length);
console.log('phrases matched in the templates: ' + hits.size);
console.log('phrases never found: ' + (pairs.length - hits.size));
console.log('\nper file:');
for (const [file, n] of [...perFile].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(4) + '  ' + file);
}
const missed = pairs.filter((p) => !hits.has(p.key));
if (missed.length) {
  console.log('\nnot found in any template (dictionary entries with no code behind them,');
  console.log('or phrases the loose match could not reach):');
  for (const p of missed) console.log('  ' + p.key + '  ' + JSON.stringify(p.pt.slice(0, 60)));
}
