#!/usr/bin/env node
/* Portao: nenhum texto de interface em portugues fora do strings.txt.
 *
 * O idioma de origem da skin e o ingles. Portugues e uma traducao, e ele vive
 * inteiro no strings.txt. Uma frase em portugues deixada num template nao tem
 * como ser traduzida -- o dicionario e indexado pela frase em ingles -- entao
 * ela aparece em portugues para todo mundo, em qualquer idioma. Foi assim que a
 * secao das barras de progresso ficou em portugues numa sessao em ingles.
 *
 * Comentario nao conta: e texto para quem le o codigo, nao para quem usa a
 * skin. Por isso comentarios sao removidos antes da busca.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'EchoClassic', 'HTML', 'echoclassic', 'html', 'js');

/* Marcas de portugues que praticamente nao aparecem em ingles. Palavras curtas
   e ambiguas ("da", "do", "no") ficam de fora de proposito: elas existem em
   ingles e so gerariam ruido. */
const PT_WORDS = /\b(n[ãa]o|voc[êe]|para|com|uma|dos|das|pela|pelo|est[áa]|s[ãa]o|foi|ser[áa]|nenhum[a]?|todos|tocar|fila|busca|ajustes|idioma|reprodu[çc][ãa]o|biblioteca|configura[çc][ãa]o|erro|aviso|carregando|salvar|apagar|renomear)\b/i;
const PT_CHARS = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/;

function stripComments(src) {
  /* Substitui por espacos do mesmo tamanho para preservar numero de linha. */
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/./g, ' '));
}

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(full));
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of jsFiles(JS_DIR)) {
  const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (!PT_CHARS.test(line) && !PT_WORDS.test(line)) return;
    /* Acento sozinho nao basta: nome proprio e dado da biblioteca passam por
       aqui. Exige indicio de palavra portuguesa, ou acento dentro de texto
       literal com mais de uma palavra. */
    const hasWord = PT_WORDS.test(line);
    const accentedPhrase = PT_CHARS.test(line) && /['"`>][^'"`<]*[ãõçáéíóúâêôà][^'"`<]*\s[^'"`<]*['"`<]/i.test(line);
    if (!hasWord && !accentedPhrase) return;
    findings.push({
      file: path.relative(ROOT, file),
      line: i + 1,
      text: line.trim().slice(0, 100)
    });
  });
}

if (!findings.length) {
  console.log('  ok    no Portuguese interface text outside strings.txt');
  process.exit(0);
}

console.log('  FALHA  Portuguese text found outside strings.txt (' + findings.length + '):');
for (const f of findings) {
  console.log('    ' + f.file + ':' + f.line + '  ' + f.text);
}
process.exit(1);
