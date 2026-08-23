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

/* RESP-05, RESP-06, RESP-07, RESP-08: formataçao de duracao, contador e prefixo
   de reproducao montados em JavaScript viram texto inglês puro, sem espaçamento,
   e nunca batem com uma chave de dicionario. A correçao passa por tr() e espaços.

   Os testes verificam o resultado RENDERIZADO, nao apenas o padrão no código,
   porque padrões fracos deixam bugs passarem: a traducao de placeholders estava
   quebrada mas os testes antigos passavam. Garante-se aqui que nenhuma string
   visível ao usuário contém {{ em nenhuma linguagem. */

test('RESP-08: playStartsLabel() em inglês tem EXATAMENTE UM dois-pontos', function () {
  const q = helpers.queueInstance({
    LmsStr: {
      t: function (key) { return key; }
    }
  });
  q.self.store.queueIndex = 0;
  q.self.store.queue = [{ index: 0, title: 'Enter Sandman' }];
  q.self.store.mode = 'stop';
  const rendered = q.self.playStartsLabel;
  assert.equal((rendered.match(/:/g) || []).length, 1,
    'renderizado em inglês: ' + rendered);
  assert.equal(rendered, 'Play will start: Enter Sandman');
});

test('RESP-08: playStartsLabel() em português tem EXATAMENTE UM dois-pontos (nenhum duplicado)', function () {
  const q = helpers.queueInstance({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: { 'Play will start:': 'Play iniciará:' }
    },
    LmsStr: {
      t: function (key) {
        const dict = { 'Play will start:': 'Play iniciará:' };
        return dict[key] || key;
      }
    }
  });
  q.self.store.queueIndex = 0;
  q.self.store.queue = [{ index: 0, title: 'Enter Sandman' }];
  q.self.store.mode = 'stop';
  const rendered = q.self.playStartsLabel;
  assert.equal((rendered.match(/:/g) || []).length, 1,
    'renderizado em português: ' + rendered);
  assert.equal(rendered, 'Play iniciará: Enter Sandman');
});

test('RESP-06: countLabel() com cargas parciais renderiza sem {{ em inglês', function () {
  const q = helpers.queueInstance({
    LmsStr: {
      t: function (key) { return key; }
    }
  });
  q.self.store.queueTotal = 100;
  q.self.store.queue = new Array(10);
  const rendered = q.self.countLabel;
  assert.doesNotMatch(rendered, /{{/,
    'nenhum placeholder fica no resultado em inglês: ' + rendered);
  assert.match(rendered, /10 of 100/);
});

test('RESP-06: countLabel() com cargas parciais renderiza sem {{ em português', function () {
  const q = helpers.queueInstance({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: {
        'track': 'faixa',
        'tracks': 'faixas',
        '{{loaded}} of {{total}} loaded': '{{loaded}} de {{total}} carregadas'
      }
    },
    LmsStr: {
      t: function (key) {
        const dict = {
          'track': 'faixa',
          'tracks': 'faixas',
          '{{loaded}} of {{total}} loaded': '{{loaded}} de {{total}} carregadas'
        };
        return dict[key] || key;
      }
    }
  });
  q.self.store.queueTotal = 100;
  q.self.store.queue = new Array(10);
  const rendered = q.self.countLabel;
  assert.doesNotMatch(rendered, /{{/,
    'nenhum placeholder fica no resultado em português: ' + rendered);
  assert.match(rendered, /10 de 100 faixas carregadas/);
});

test('RESP-07: longDuration() sem tr() fornecido renderiza em inglês e sem {{', function () {
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/format.js');
  const fmt = ctx.LmsFmt;

  const under1 = fmt.longDuration(30);
  assert.doesNotMatch(under1, /{{/, 'menos de 1 min: ' + under1);
  assert.equal(under1, 'less than 1 minute');

  const mins = fmt.longDuration(5 * 60);
  assert.doesNotMatch(mins, /{{/, '5 minutos: ' + mins);
  assert.equal(mins, '5 min');

  const hourMins = fmt.longDuration(1 * 3600 + 31 * 60);
  assert.doesNotMatch(hourMins, /{{/, '1h31m: ' + hourMins);
  assert.equal(hourMins, '1 h 31 min');

  const hour = fmt.longDuration(2 * 3600);
  assert.doesNotMatch(hour, /{{/, '2 horas: ' + hour);
  assert.equal(hour, '2 h');
});

test('playback intelligence controls are capability-gated and show active server state', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/queue.js');
  assert.match(src, /v-if="store\.capabilities\.randomplay"/);
  assert.match(src, /v-if="store\.capabilities\.dontstopthemusicsetting"/);
  const q = helpers.queueInstance({ LmsStr: { t: function (key) { return key; } }, LmsStore: {
    state: {
      queue: [], queueIndex: 0, queueTotal: 0, mode: 'stop', shuffle: 0, repeat: 0,
      queueUndo: [], np: { id: null }, capabilities: { randomplay: true, dontstopthemusicsetting: true },
      randomPlay: { active: 'album', busy: false },
      dontStopMusic: { provider: 'similar', providers: [{ id: 'similar', name: 'Similar tracks' }], busy: false }
    },
    queueRemaining: function () { return 0; }
  } });
  assert.equal(q.self.playbackModeLabel, 'Random mix: Albums');
  q.self.store.randomPlay.active = '';
  assert.equal(q.self.playbackModeLabel, 'Continues with: Similar tracks');
});

test('RandomPlay asks before replacing unplayed tracks but starts immediately on an empty queue', function () {
  const calls = [];
  const state = {
    queue: [{ index: 0 }, { index: 1 }], queueIndex: 0, queueTotal: 2, mode: 'play',
    shuffle: 0, repeat: 0, queueUndo: [], np: { id: 1 }, capabilities: { randomplay: true },
    randomPlay: { active: '', busy: false }, dontStopMusic: { provider: '0', providers: [], busy: false }
  };
  const q = helpers.queueInstance({ LmsStore: {
    state: state, queueRemaining: function () { return 0; },
    setRandomPlay: function (mode) { calls.push(mode); }
  } });
  q.self.chooseRandom('album');
  assert.equal(q.self.pendingMix, 'album');
  assert.deepEqual(calls, []);
  q.self.confirmRandom();
  assert.deepEqual(calls, ['album']);
  state.queue = [];
  q.self.chooseRandom('track');
  assert.deepEqual(calls, ['album', 'track']);
});

test('RESP-07: longDuration() com dicionário português renderiza em português e sem {{', function () {
  const ctx = helpers.runBrowserFile('EchoClassic/HTML/echoclassic/html/js/format.js', {
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: {
        'less than 1 minute': 'menos de 1 minuto',
        '{{minutes}} min': '{{minutes}} min',
        '{{hours}} h {{minutes}} min': '{{hours}} h {{minutes}} min',
        '{{hours}} h': '{{hours}} h'
      }
    },
    LmsStr: {
      t: function (key) {
        const dict = {
          'less than 1 minute': 'menos de 1 minuto',
          '{{minutes}} min': '{{minutes}} min',
          '{{hours}} h {{minutes}} min': '{{hours}} h {{minutes}} min',
          '{{hours}} h': '{{hours}} h'
        };
        return dict[key] || key;
      }
    }
  });
  const fmt = ctx.LmsFmt;

  const under1 = fmt.longDuration(30);
  assert.doesNotMatch(under1, /{{/, 'menos de 1 minuto: ' + under1);
  assert.equal(under1, 'menos de 1 minuto');

  const mins = fmt.longDuration(5 * 60);
  assert.doesNotMatch(mins, /{{/, '5 minutos: ' + mins);
  assert.equal(mins, '5 min');

  const hourMins = fmt.longDuration(1 * 3600 + 31 * 60);
  assert.doesNotMatch(hourMins, /{{/, '1h31m: ' + hourMins);
  assert.equal(hourMins, '1 h 31 min');

  const hour = fmt.longDuration(2 * 3600);
  assert.doesNotMatch(hour, /{{/, '2 horas: ' + hour);
  assert.equal(hour, '2 h');
});

/* Testes do defeito original D2: as strings que o usuário fotografou.
   7440 segundos = 2 h 4 min. Cada caso falha se um espaço for removido. */

test('D2 screenshot: remaining() renderiza "2 h 4 min remaining" em inglês', function () {
  const q = helpers.queueInstance({
    LmsStr: {
      t: function (key) { return key; }
    },
    LmsStore: {
      state: {
        queue: [{ index: 0, id: 1 }], queueIndex: 0, queueTotal: 21,
        mode: 'play', shuffle: 0, repeat: 0, queueUndo: [], np: { id: 1 }
      },
      queueRemaining: function () { return 7440; }
    }
  });
  const rendered = q.self.remaining;
  assert.equal(rendered, '2 h 4 min remaining',
    'renderizado exatamente (falha se espaço for removido)');
});

test('D2 screenshot: remaining() renderiza "2 h 4 min restantes" em português', function () {
  const q = helpers.queueInstance({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: {
        'remaining': 'restantes',
        '{{hours}} h {{minutes}} min': '{{hours}} h {{minutes}} min'
      }
    },
    LmsStr: {
      t: function (key) {
        const dict = {
          'remaining': 'restantes',
          '{{hours}} h {{minutes}} min': '{{hours}} h {{minutes}} min'
        };
        return dict[key] || key;
      }
    },
    LmsStore: {
      state: {
        queue: [{ index: 0, id: 1 }], queueIndex: 0, queueTotal: 21,
        mode: 'play', shuffle: 0, repeat: 0, queueUndo: [], np: { id: 1 }
      },
      queueRemaining: function () { return 7440; }
    }
  });
  const rendered = q.self.remaining;
  assert.equal(rendered, '2 h 4 min restantes',
    'renderizado exatamente (falha se espaço for removido)');
});

test('D2 screenshot: countLabel() renderiza "21 tracks" em inglês (caminho simples)', function () {
  const q = helpers.queueInstance({
    LmsStr: {
      t: function (key) { return key; }
    }
  });
  q.self.store.queueTotal = 21;
  q.self.store.queue = new Array(21);
  const rendered = q.self.countLabel;
  assert.equal(rendered, '21 tracks',
    'renderizado exatamente (falha se espaço for removido: "21tracks")');
});

test('D2 screenshot: countLabel() renderiza "21 faixas" em português (caminho simples)', function () {
  const q = helpers.queueInstance({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: {
        'tracks': 'faixas'
      }
    },
    LmsStr: {
      t: function (key) {
        const dict = { 'tracks': 'faixas' };
        return dict[key] || key;
      }
    }
  });
  q.self.store.queueTotal = 21;
  q.self.store.queue = new Array(21);
  const rendered = q.self.countLabel;
  assert.equal(rendered, '21 faixas',
    'renderizado exatamente (falha se espaço for removido)');
});

test('remaining() renderiza "live" quando sem duração em inglês', function () {
  const q = helpers.queueInstance({
    LmsStr: {
      t: function (key) { return key; }
    },
    LmsStore: {
      state: {
        queue: [], queueIndex: 0, queueTotal: 0,
        mode: 'play', shuffle: 0, repeat: 0, queueUndo: [], np: { id: null }
      },
      queueRemaining: function () { return 0; }
    }
  });
  const rendered = q.self.remaining;
  assert.equal(rendered, 'live');
});

test('remaining() renderiza "ao vivo" quando sem duração em português', function () {
  const q = helpers.queueInstance({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: { 'live': 'ao vivo' }
    },
    LmsStr: {
      t: function (key) {
        const dict = { 'live': 'ao vivo' };
        return dict[key] || key;
      }
    },
    LmsStore: {
      state: {
        queue: [], queueIndex: 0, queueTotal: 0,
        mode: 'play', shuffle: 0, repeat: 0, queueUndo: [], np: { id: null }
      },
      queueRemaining: function () { return 0; }
    }
  });
  const rendered = q.self.remaining;
  assert.equal(rendered, 'ao vivo');
});

test('countLabel() renderiza "1 track" no singular em inglês', function () {
  const q = helpers.queueInstance({
    LmsStr: {
      t: function (key) { return key; }
    }
  });
  q.self.store.queueTotal = 1;
  q.self.store.queue = [{ index: 0, id: 1 }];
  const rendered = q.self.countLabel;
  assert.equal(rendered, '1 track');
});

test('countLabel() renderiza "1 faixa" no singular em português', function () {
  const q = helpers.queueInstance({
    LMS_LANG: 'PT',
    LMS_STRINGS_BY_LANG: {
      PT: { 'track': 'faixa' }
    },
    LmsStr: {
      t: function (key) {
        const dict = { 'track': 'faixa' };
        return dict[key] || key;
      }
    }
  });
  q.self.store.queueTotal = 1;
  q.self.store.queue = [{ index: 0, id: 1 }];
  const rendered = q.self.countLabel;
  assert.equal(rendered, '1 faixa');
});
