const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

/* AUDIT-09: tres modos de capa na fila, escolhidos em Ajustes. 'album' e o
   padrao pedido pelo dono. O agrupamento so pode depender do albumId estavel
   de 2a -- nunca do nome do album (duas obras homonimas colidiriam) nem do
   coverid (que e por faixa, nao por album). */

function withTracks(tracks, artMode) {
  const q = helpers.queueInstance();
  q.self.store.queue = tracks;
  if (artMode) q.self.ui.queueArtMode = artMode;
  return q.self;
}

test('modo every mostra capa em toda linha, mesmo dentro do mesmo album', function () {
  const self = withTracks([
    { index: 0, id: 1, albumId: 7 },
    { index: 1, id: 2, albumId: 7 },
    { index: 2, id: 3, albumId: 7 }
  ], 'every');
  assert.equal(self.showCover(self.tracks[0], 0), true);
  assert.equal(self.showCover(self.tracks[1], 1), true);
  assert.equal(self.showCover(self.tracks[2], 2), true);
});

test('modo album: linhas consecutivas do mesmo albumId colapsam para uma capa', function () {
  const self = withTracks([
    { index: 0, id: 1, albumId: 7 },
    { index: 1, id: 2, albumId: 7 },
    { index: 2, id: 3, albumId: 7 }
  ], 'album');
  assert.equal(self.showCover(self.tracks[0], 0), true, 'a primeira da sequencia sempre mostra');
  assert.equal(self.showCover(self.tracks[1], 1), false);
  assert.equal(self.showCover(self.tracks[2], 2), false);
});

test('a sequencia termina quando o albumId muda', function () {
  const self = withTracks([
    { index: 0, id: 1, albumId: 7 },
    { index: 1, id: 2, albumId: 7 },
    { index: 2, id: 3, albumId: 9 },
    { index: 3, id: 4, albumId: 9 }
  ], 'album');
  assert.equal(self.showCover(self.tracks[0], 0), true);
  assert.equal(self.showCover(self.tracks[1], 1), false);
  assert.equal(self.showCover(self.tracks[2], 2), true, 'novo albumId reabre a sequencia');
  assert.equal(self.showCover(self.tracks[3], 3), false);
});

test('dois albuns com o MESMO NOME mas ids diferentes nao se fundem', function () {
  const self = withTracks([
    { index: 0, id: 1, album: 'Greatest Hits', albumId: 101 },
    { index: 1, id: 2, album: 'Greatest Hits', albumId: 202 }
  ], 'album');
  assert.equal(self.showCover(self.tracks[0], 0), true);
  assert.equal(self.showCover(self.tracks[1], 1), true, 'nome igual, id diferente: nao agrupa');
});

test('uma linha sem albumId nunca agrupa com a vizinha, nem com outra tambem sem albumId', function () {
  const self = withTracks([
    { index: 0, id: 1, albumId: 7 },
    { index: 1, id: 2, albumId: null },
    { index: 2, id: 3, albumId: null },
    { index: 3, id: 4, albumId: 7 }
  ], 'album');
  assert.equal(self.showCover(self.tracks[0], 0), true);
  assert.equal(self.showCover(self.tracks[1], 1), true, 'sem albumId, mostra a propria capa');
  assert.equal(self.showCover(self.tracks[2], 2), true, 'duas faixas sem albumId nao se agrupam entre si');
  assert.equal(self.showCover(self.tracks[3], 3), true, 'o albumId 7 reaparece, mas depois de uma quebra: nao herda a sequencia antiga');
});

test('modo headings: legenda so no inicio de cada sequencia, e so quando ha nome de album', function () {
  const self = withTracks([
    { index: 0, id: 1, album: 'Album A', albumId: 7 },
    { index: 1, id: 2, album: 'Album A', albumId: 7 },
    { index: 2, id: 3, album: 'Album B', albumId: 9 },
    { index: 3, id: 4, albumId: null }
  ], 'headings');
  assert.equal(self.showCaption(self.tracks[0], 0), true);
  assert.equal(self.showCaption(self.tracks[1], 1), false, 'meio da sequencia nao repete a legenda');
  assert.equal(self.showCaption(self.tracks[2], 2), true, 'novo album, nova legenda');
  assert.equal(self.showCaption(self.tracks[3], 3), false, 'sem nome de album nao ha o que legendar');
});

test('legenda nunca aparece fora do modo headings', function () {
  const self = withTracks([{ index: 0, id: 1, album: 'Album A', albumId: 7 }], 'album');
  assert.equal(self.showCaption(self.tracks[0], 0), false);
});

/* RESP-01: .qcaption e flex, entao .ell no proprio container nunca alcanca o
   item flex anonimo que guarda o texto -- o titulo do album trunca sem
   reticencias. O padrao ja usado em queue.js:55 e nowplaying.js:54 poe o
   .ell numa folha dentro do container flex. */
test('RESP-01: a legenda do album poe .ell numa folha, nao no proprio .qcaption', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/queue.js');
  assert.doesNotMatch(src, /class="qcaption ell"/,
    '.ell direto no container flex nunca alcanca o item anonimo');
  assert.match(src, /class="qcaption"><span class="ell">\{\{ t\.album \}\}<\/span><\/div>/);
});

/* RESP-03: o slot de capa e sempre emitido; sem colapso, uma sequencia de
   varias faixas do mesmo album mostra uma coluna de blocos vazios (sem
   background-color, por decisao do dono -- ver RESP-03 no plano aprovado).
   A colapsa fica a cargo de uma classe .collapse ligada a !showCover(t, i). */
test('RESP-03: o slot de capa colapsa quando showCover() e falso', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/queue.js');
  assert.match(src, /class="cover" :class="\{collapse: !showCover\(t, i\)\}"/);

  const self = withTracks([
    { index: 0, id: 1, albumId: 7 },
    { index: 1, id: 2, albumId: 7 }
  ], 'album');
  assert.equal(self.showCover(self.tracks[0], 0), true, 'a primeira faixa mostra a capa, nao colapsa');
  assert.equal(self.showCover(self.tracks[1], 1), false, 'a segunda faixa colapsa o slot vazio');
});

/* RESP-02 e RESP-12 (metade da fila): leitura direta da folha de estilo --
   nenhum dos dois arreios acima renderiza CSS. [code], nao reproduzido: o
   mecanismo de overlap foi inferido da fonte, nunca observado falhando. */
test('RESP-02: .qcaption e .qrow tem altura MINIMA, nao travada, para nao pintar por cima da linha de baixo', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const qcaption = css.match(/\.qcaption\{([^}]*)\}/)[1];
  const qrow = css.match(/\.qrow\{([^}]*)\}/)[1];
  assert.match(qcaption, /min-height:22px/);
  assert.doesNotMatch(qcaption, /(?<!min-)height:22px/);
  assert.match(qrow, /min-height:52px/);
  assert.doesNotMatch(qrow, /(?<!min-)height:52px/);
});

test('RESP-04: a linha divisoria tambem aparece depois de uma legenda de grupo', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  assert.match(css, /\.qcaption\+\.qrow::before\{/);
});

test('RESP-12 (metade da fila): a duracao encosta a direita, nao gruda no titulo', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const dur = css.match(/\.qrow \.dur\{([^}]*)\}/)[1];
  assert.match(dur, /margin-left:auto/);
});

/* Defeito introduzido pelo proprio colapso do RESP-03: sem os 34px de arte, o
   gap:11px ainda se aplica ao redor do item de largura zero, entao o
   conteudo da linha comeca em 25px (14 padding + 11 gap), nao em 59px
   (14 + 34 + 11). O tracejado (::before) pertence a linha que o desenha --
   a linha SEGUINTE de um par -- entao e a geometria dela que decide o
   offset, nao a da linha anterior. [code], nao reproduzido. */
test('RESP-03 (correcao do revisor): o tracejado segue o offset da propria linha quando a capa colapsa', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/queue.js');
  assert.match(src, /:class="\{now: isNow\(t\), nocover: !showCover\(t, i\)\}"/,
    '.qrow precisa saber a propria geometria, nao so o <span class="cover">');

  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const qrow = css.match(/\.qrow\{([^}]*)\}/)[1];
  assert.match(qrow, /--qhair-left:59px/, 'padrao: padding 14 + arte 34 + gap 11');
  const nocover = css.match(/\.qrow\.nocover\{([^}]*)\}/)[1];
  assert.match(nocover, /--qhair-left:25px/, 'colapsada: padding 14 + gap 11, sem os 34px de arte');
  assert.match(css, /::before\{content:'';position:absolute;top:0;left:var\(--qhair-left\)/,
    'o tracejado tem que ler a variavel, nao um 59px fixo');
});

test('RESP-03: o slot de capa colapsado nao ocupa largura', function () {
  const css = helpers.read('EchoClassic/HTML/echoclassic/html/css/ios9.css');
  const collapsed = css.match(/\.qrow \.cover\.collapse\{([^}]*)\}/)[1];
  assert.match(collapsed, /flex-basis:0/);
  assert.match(collapsed, /width:0/);
  assert.doesNotMatch(collapsed, /background-color/,
    'RESP-03 foi decidido como colapso, nao cor -- nenhum token novo neste commit');
});
