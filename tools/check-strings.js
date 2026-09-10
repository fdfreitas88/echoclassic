#!/usr/bin/env node
/* Portao de validacao de strings.txt, feito para quem traduz e nao mexe no codigo.
   Pega justamente os erros que nao aparecem: o arquivo continua "parecendo certo"
   e a traducao simplesmente nao chega na tela.

   Uso:
     node tools/check-strings.js          verifica e lista os problemas
     node tools/check-strings.js --fix    normaliza o formato (nao traduz nada)

   O --fix so mexe em formatacao: ordem das linhas de idioma (EN primeiro, o resto
   em ordem alfabetica), uma linha em branco entre blocos, sem BOM, sem CRLF.
   Nunca altera o texto de nenhuma traducao. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.resolve(__dirname, '..', 'EchoClassic/strings.txt');
const SOURCE = 'EN';
/* Codigos aceitos. Acrescentar um idioma = acrescentar o codigo aqui e as linhas
   no strings.txt. Nao ha nada mais a registrar em lugar nenhum. */
const LANGS = ['CS','DA','DE','EN','ES','FI','FR','HE','IT','NL','NO','PL','PT','RU','SV'];

const errors = [];
const warns = [];
const err = (line, msg) => errors.push({ line, msg });
const warn = (line, msg) => warns.push({ line, msg });

let raw = fs.readFileSync(FILE, 'latin1');
if (raw.charCodeAt(0) === 0xEF && raw.charCodeAt(1) === 0xBB && raw.charCodeAt(2) === 0xBF) {
  err(1, 'o arquivo comeca com BOM UTF-8; a primeira chave nao sera reconhecida');
}
if (/\r\n/.test(raw)) {
  err(0, 'o arquivo usa quebras de linha CRLF (Windows); use LF');
}

const text = fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '');
const lines = text.split('\n');

/* --- leitura, com a mesma regra do Plugin.pm --------------------------- */
const blocks = [];
let block = null;
lines.forEach((line, i) => {
  const n = i + 1;
  if (line === '') return;
  if (/^#/.test(line)) return;

  if (!/^[\t ]/.test(line)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(line.replace(/\s+$/, ''))) {
      err(n, `linha de chave invalida: ${JSON.stringify(line)}`);
      block = null; return;
    }
    if (/\s$/.test(line)) warn(n, `a chave tem espaco no fim: ${JSON.stringify(line)}`);
    block = { key: line.trim(), line: n, langs: {}, order: [] };
    blocks.push(block);
    return;
  }

  if (/^ /.test(line)) {
    err(n, 'linha de idioma indentada com ESPACO; tem de ser um TAB '
         + '(erro classico ao copiar e colar de um chat ou editor)');
    return;
  }
  const m = line.match(/^\t([A-Za-z]{2})\t([\s\S]*)$/);
  if (!m) {
    err(n, `linha de idioma malformada, esperado TAB + codigo + TAB + texto: ${JSON.stringify(line)}`);
    return;
  }
  if (!block) { err(n, 'linha de idioma antes de qualquer chave'); return; }
  const code = m[1];
  if (code !== code.toUpperCase()) err(n, `codigo de idioma em minusculas: ${code}`);
  const up = code.toUpperCase();
  if (!LANGS.includes(up)) err(n, `codigo de idioma desconhecido: ${up}`);
  if (block.langs[up] !== undefined) err(n, `${block.key}: idioma ${up} repetido no mesmo bloco`);
  block.langs[up] = m[2];
  block.order.push(up);
  block.lastLine = n;
});

/* --- chaves repetidas -------------------------------------------------- */
/* O parser do Plugin.pm faz $out{$key} = {} ao ver a chave: o bloco anterior
   e descartado inteiro, em silencio. */
const seen = new Map();
for (const b of blocks) {
  if (seen.has(b.key)) {
    const first = seen.get(b.key);
    const same = JSON.stringify(first.langs) === JSON.stringify(b.langs);
    (same ? warn : err)(b.line,
      `chave repetida ${b.key} (a primeira esta na linha ${first.line}); `
      + (same ? 'os blocos sao identicos, mas so o ultimo e lido'
              : 'os blocos DIFEREM e o primeiro e descartado em silencio'));
  } else seen.set(b.key, b);
}

/* --- por bloco --------------------------------------------------------- */
const PLACEHOLDER = /\{\{?[a-zA-Z_][a-zA-Z0-9_]*\}?\}/g;
const set = s => new Set(String(s).match(PLACEHOLDER) || []);
const eq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

for (const b of blocks) {
  const en = b.langs[SOURCE];
  if (en === undefined) { err(b.line, `${b.key}: nao tem linha ${SOURCE}`); continue; }
  if (en === '') warn(b.line, `${b.key}: o texto ${SOURCE} esta vazio`);

  for (const code of Object.keys(b.langs)) {
    if (code === SOURCE) continue;
    const t = b.langs[code];
    const at = b.lastLine;
    if (t === '') { err(at, `${b.key} [${code}]: traducao vazia`); continue; }

    if (!eq(set(en), set(t))) {
      err(at, `${b.key} [${code}]: os marcadores nao batem com o ${SOURCE}. `
            + `${SOURCE}: ${[...set(en)].join(' ') || '(nenhum)'} / `
            + `${code}: ${[...set(t)].join(' ') || '(nenhum)'}`);
    }
    const lead = s => (s.match(/^\s*/) || [''])[0];
    const tail = s => (s.match(/\s*$/) || [''])[0];
    if (lead(en) !== lead(t) || tail(en) !== tail(t)) {
      warn(at, `${b.key} [${code}]: o espaco no inicio/fim difere do ${SOURCE}. `
             + `Esta frase e um pedaco que se junta a outra; o espaco faz parte dela.`);
    }
    /* So interessa em PEDACO de frase -- os que comecam ou terminam numa aspa
       e sao concatenados com um nome no meio. Numa frase inteira, cada idioma
       usa as aspas que quiser ("..." em ingles, `,,..." em alemao, << >> em
       frances) e isso nao e erro. */
    const isFragment = /^[“”]|[“”]$/.test(en);
    const q = s => (s.match(/[“”„«»]/g) || []).length;
    if (isFragment && q(en) !== q(t)) {
      warn(at, `${b.key} [${code}]: e um pedaco de frase e o numero de aspas `
             + `nao bate com o ${SOURCE} (${q(en)} contra ${q(t)}); o pedaco precisa `
             + `abrir/fechar as aspas igual, senao a frase montada fica torta`);
    }
  }
}

/* --- colisoes: mesma frase em ingles, traducao diferente --------------- */
/* getStringMap indexa pela frase em ingles. Duas chaves com o mesmo ingles e
   traducoes diferentes = uma delas some, sem aviso na tela. */
for (const code of LANGS) {
  if (code === SOURCE) continue;
  const byEn = new Map();
  for (const b of blocks) {
    const en = b.langs[SOURCE], t = b.langs[code];
    if (en === undefined || t === undefined || en === '' || t === '') continue;
    if (t === en) continue;
    if (byEn.has(en) && byEn.get(en).t !== t) {
      err(b.lastLine,
        `colisao em ${code}: o ingles ${JSON.stringify(en)} aparece em ${byEn.get(en).key} `
        + `e em ${b.key} com traducoes diferentes; uma das duas nunca aparece na tela`);
    } else byEn.set(en, { t, key: b.key });
  }
}

/* --- cobertura --------------------------------------------------------- */
const present = {};
for (const b of blocks) for (const c of Object.keys(b.langs)) present[c] = (present[c] || 0) + 1;
const total = blocks.length;

/* --- --fix: so formatacao --------------------------------------------- */
if (process.argv.includes('--fix')) {
  const out = [];
  let bi = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#/.test(line)) { out.push(line); i++; continue; }
    if (line === '') { i++; continue; }
    if (!/^[\t ]/.test(line)) {
      const b = blocks[bi++];
      if (!b || b.key !== line.trim()) { out.push(line); i++; continue; }
      if (out.length && out[out.length - 1] !== '') out.push('');
      out.push(b.key);
      const codes = Object.keys(b.langs).sort((a, c) =>
        a === SOURCE ? -1 : c === SOURCE ? 1 : a.localeCompare(c));
      for (const c of codes) out.push('\t' + c + '\t' + b.langs[c]);
      i++;
      while (i < lines.length && (/^[\t ]/.test(lines[i]) || lines[i] === '')) {
        if (!/^[\t ]/.test(lines[i]) ) break;
        i++;
      }
      continue;
    }
    i++;
  }
  while (out.length && out[0] === '') out.shift();
  fs.writeFileSync(FILE, out.join('\n') + '\n', 'utf8');
  console.log('strings.txt normalizado (apenas formatacao).');
}

/* --- relatorio --------------------------------------------------------- */
console.log(`\nstrings.txt: ${total} blocos`);
for (const c of LANGS) {
  if (!present[c]) continue;
  const n = present[c];
  console.log(`  ${c}  ${String(n).padStart(4)} / ${total}` + (n < total ? `   faltam ${total - n}` : '   completo'));
}
for (const w of warns) console.log(`  aviso  linha ${w.line}: ${w.msg}`);
for (const e of errors) console.log(`  ERRO   linha ${e.line}: ${e.msg}`);
console.log(`\n${errors.length} erro(s), ${warns.length} aviso(s)`);
process.exit(errors.length ? 1 : 0);
