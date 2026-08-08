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
