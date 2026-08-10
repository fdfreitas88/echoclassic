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
/* O infinitivo sozinho nao cobria o caso real. "Reproduzir agora" nao tem
   acento, e `reprodu[çc][ãa]o` so casa o substantivo; "itens adicionados" e o
   particIpio de um verbo que estava listado apenas no infinitivo. Os tres
   comandos da folha de acoes e o aviso da fila atravessaram o portao inteiros
   por causa dessas duas lacunas (I18N-01), entao os verbos entram com as
   formas que a interface realmente usa: infinitivo, gerundio e participio. */
const PT_VERBS =
  'reproduzir|reproduzindo|fixar|fixad[oa]s?|adicionar|adicionad[oa]s?' +
  '|selecionar|selecionad[oa]s?|remover|removid[oa]s?|renomear|renomead[oa]s?' +
  '|criar|criad[oa]s?|salvar|salvand?o|salvad[oa]s?|apagar|apagad[oa]s?' +
  '|atualizar|atualizad[oa]s?|conectad[oa]s?|desconectad[oa]s?' +
  '|carregando|carregad[oa]s?|tocar|tocando|editar|filtrar|limpar|mover' +
  '|escolher|tentar|abrir|fechar|voltar|enviar|desfazer|seguir';
const PT_WORDS = new RegExp(
  '\\b(n[ãa]o|voc[êe]|para|com|uma|dos|das|pela|pelo|est[áa]|s[ãa]o|foi|ser[áa]' +
  '|nenhum[a]?|todos|itens|agora|fila|busca|ajustes|idioma|reprodu[çc][ãa]o' +
  '|biblioteca|configura[çc][ãa]o|erro|aviso|nome|novamente|conte[úu]do' +
  '|arquivo|tela|telas|faixa|faixas|álbum|álbuns|m[úu]sica|estat[íi]stica' +
  '|pilha|grupo|grupos|lista|listas|' + PT_VERBS + ')\\b', 'i');
const PT_CHARS = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/;

function stripComments(src) {
  /* Substitui por espacos do mesmo tamanho para preservar numero de linha. */
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
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

/* Uma linha de cada vez, exposta a parte: e o que permite ao teste de
   regressao cobrar o portao pelos literais que ele deixou passar, sem
   reescrever a heuristica no teste -- uma copia divergiria em silencio. */
function flagsLine(line) {
  if (!PT_CHARS.test(line) && !PT_WORDS.test(line)) return false;
  /* Acento sozinho nao basta: nome proprio e dado da biblioteca passam por
     aqui. Exige indicio de palavra portuguesa, ou acento dentro de texto
     literal com mais de uma palavra. */
  const hasWord = PT_WORDS.test(line);
  const accentedPhrase = PT_CHARS.test(line) && /['"`>][^'"`<]*[ãõçáéíóúâêôà][^'"`<]*\s[^'"`<]*['"`<]/i.test(line);
  return hasWord || accentedPhrase;
}

function scan() {
  const out = [];
  for (const file of jsFiles(JS_DIR)) {
    const lines = stripComments(fs.readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (!flagsLine(line)) return;
      out.push({
        file: path.relative(ROOT, file),
        line: i + 1,
        text: line.trim().slice(0, 100)
      });
    });
  }
  return out;
}

module.exports = { PT_WORDS, PT_CHARS, stripComments, flagsLine, scan };

/* Importado por um teste, o arquivo so entrega as funcoes acima; rodado pela
   linha de comando, ele e o portao. */
if (require.main !== module) return;

const findings = scan();

if (!findings.length) {
  console.log('  ok    no Portuguese interface text outside strings.txt');
  process.exit(0);
}

console.log('  FALHA  Portuguese text found outside strings.txt (' + findings.length + '):');
for (const f of findings) {
  console.log('    ' + f.file + ':' + f.line + '  ' + f.text);
}
process.exit(1);
