#!/usr/bin/env node
/* Gera as imagens do README a partir do servidor real, em tamanhos exatos.
 *
 * Por que existe um proxy no meio: a skin guarda o estado no localStorage e o
 * Chrome em modo headless nao aceita injecao de JavaScript pela linha de
 * comando. O proxy serve exatamente os bytes do servidor e acrescenta um unico
 * <script> ao documento HTML, que aplica o preset pedido depois que o app sobe.
 * Nada do produto muda: as chamadas de dados continuam saindo para o LMS de
 * verdade, atraves do mesmo proxy, e por isso continuam sendo mesma origem.
 *
 * Uso:
 *   node tools/screenshots.js                  todas as imagens
 *   node tools/screenshots.js filters mobile   so as citadas
 *   ECHO_HTTP_HOST=servidor.local:9000 node tools/screenshots.js
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const TARGET = process.env.ECHO_HTTP_HOST || 'lms.local:9000';
const [TARGET_HOST, TARGET_PORT] = TARGET.split(':');
const PORT = Number(process.env.ECHO_SHOT_PORT || 8899);
const OUT = path.join(__dirname, '..', 'docs', 'img');
const CHROME = process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Cada preset diz o tamanho da janela e o que fazer com a interface. O corpo da
   funcao vai inteiro para dentro da pagina — nao feche sobre nada daqui. */
const SHOTS = {
  /* Recentes e a raiz padrao e a unica que preenche o painel direito sozinha:
     ensureRecentSelection escolhe o primeiro album em tela larga. E o estado de
     primeira abertura, sem nada forcado por fora. */
  library: {
    width: 1440, height: 900, wait: 45000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      await api.rows();
      await api.until(() => !document.querySelector('.pane-right .empty'));
      await api.sleep(1200);
    }
  },
  filters: {
    width: 1440, height: 900, wait: 45000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      await api.rows();
      api.browse().openFilters();
      await api.sleep(1500);
    }
  },
  /* A metade de baixo do mesmo painel. O painel e mais alto que os 80% de
     viewport que ele aceita ocupar, entao numa janela de 900px a foto de cima
     corta justamente Ordenar, Agrupar, Preferencia e Vistas salvas -- que sao
     as quatro coisas que distinguem este painel de um filtro comum. Aqui a
     janela e mais alta e o corpo do painel comeca rolado ate o fim. */
  preferences: {
    width: 1440, height: 1150, wait: 45000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      await api.rows();
      api.browse().openFilters();
      await api.sleep(1500);
      const body = document.querySelector('.filter-body');
      if (body) body.scrollTop = body.scrollHeight;
      await api.sleep(800);
    }
  },
  sections: {
    width: 1440, height: 900, wait: 50000,
    setup: async function (api) {
      window.__paneWidth = 640;
      await api.ready();
      api.reset();
      window.LmsUi.setFilters(['quality:hires', 'format:flac']);
      window.LmsUi.setSections(['format']);
      window.LmsUi.setPrefer('local');
      await api.rows();
      /* rows() so espera a lista; a capa grande do painel direito e uma imagem
         que ainda esta a caminho quando ela resolve, e a foto saia com o
         retangulo cinza de espera no maior espaco da tela. */
      await api.until(() => {
        const art = document.querySelector('.pane-right img');
        return art && art.complete && art.naturalWidth > 0;
      });
      await api.sleep(800);
    }
  },
  /* A aba Playlists, onde vive a gestao: criar, renomear, reordenar, remover
     faixas e filtrar uma lista longa pelo nome. Mesma sequencia dos Ajustes --
     o reset acontece enquanto Minha Musica ainda esta na tela, porque e de la
     que api.browse() encontra o .split-body. */
  playlists: {
    width: 1440, height: 900, wait: 40000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      await api.rows();
      window.LmsUi.setTab('playlists');
      await api.sleep(3000);
    }
  },
  /* Sem nada tocando, o player cheio mostra "Nothing playing" e nao serve de
     vitrine -- e comecar reproducao no servidor de alguem para tirar foto seria
     efeito colateral que ninguem pediu. Os Ajustes mostram o que uma skin
     precisa mostrar: temas, acentos e tipografia. */
  settings: {
    width: 1440, height: 900, wait: 30000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      window.LmsUi.setTab('settings');
      await api.sleep(2500);
    }
  },
  /* A metade de baixo dos Ajustes. A pagina e mais alta que a janela, e a foto
     de cima para justamente no primeiro esquema de cor -- ou seja, corta os
     cinco esquemas, as tres tipografias e a posicao do player, que sao os itens
     que a apresentacao promete. */
  /* Igual ao appearance, so que a janela termina antes da secao das barras de
     progresso. Nao e capricho de enquadramento: aquela secao ainda tem rotulo
     em portugues numa sessao em ingles (montado por interpolacao, entao o
     dicionario nao alcanca), e esta e a foto que vai para um forum
     internacional. Volta a ser uma foto so quando as strings forem corrigidas. */
  themes: {
    width: 1440, height: 600, wait: 35000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      window.LmsUi.setTab('settings');
      await api.sleep(2500);
      const head = Array.prototype.find.call(
        document.querySelectorAll('.settings-scroller *'),
        (el) => el.children.length === 0 && /colou?r scheme|esquema de cor/i.test(el.textContent || ''));
      if (head) head.scrollIntoView(true);
      await api.sleep(900);
    }
  },
  appearance: {
    width: 1440, height: 1250, wait: 35000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      window.LmsUi.setTab('settings');
      await api.sleep(2500);
      const box = document.querySelector('.settings-scroller') ||
        document.querySelector('.tab-body .scroller') || document.querySelector('.scroller');
      /* Ancorar no cabecalho da secao em vez de num scrollTop fixo: a altura das
         secoes acima muda com o player conectado e com o idioma da sessao. */
      const head = Array.prototype.find.call(
        document.querySelectorAll('.settings-scroller *'),
        (el) => el.children.length === 0 && /colou?r scheme|esquema de cor/i.test(el.textContent || ''));
      if (head) head.scrollIntoView(true);
      else if (box) box.scrollTop = Math.round(box.scrollHeight * 0.45);
      await api.sleep(900);
    }
  },
  /* O tema Legacy chegou na 3.2.8 e nunca teve foto: o README anunciava dois
     temas porque as imagens mostravam dois. Mesma tela do preset `library`,
     para a diferenca de pintura ficar comparavel lado a lado. */
  legacy: {
    width: 1440, height: 900, wait: 45000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      window.LmsUi.setTheme('legacy');
      await api.sleep(600);
      await api.rows();
      await api.until(() => !document.querySelector('.pane-right .empty'));
      await api.sleep(1200);
    }
  },
  /* A tela reconstruida na 3.2.9. Aberta pelo proprio caminho do usuario -- o
     clique na linha -- e nao escrevendo em ui.appearanceScreen: o componente
     reconcilia esse campo com o topo da pilha de navegacao, entao um estado
     escrito por fora pode ser desfeito antes do disparo da foto. */
  playerlayout: {
    width: 1440, height: 900, wait: 35000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      window.LmsUi.setTab('settings');
      await api.sleep(2500);
      const row = Array.prototype.find.call(
        document.querySelectorAll('.settings-scroller button'),
        (el) => /player layout|layout do player/i.test(el.textContent || ''));
      if (!row) throw new Error('Player layout row not found -- is the server serving this build?');
      row.click();
      await api.until(() => /player layout/i.test(document.querySelector('.navbar') ? document.querySelector('.navbar').textContent : ''));
      await api.sleep(1200);
    }
  },
  dark: {
    width: 1440, height: 900, wait: 45000,
    setup: async function (api) {
      await api.ready();
      api.reset();
      if (!window.LmsUi.state.dark) window.LmsUi.toggleTheme();
      await api.rows();
      await api.openAlbum(/rubber soul/i);
      await api.sleep(1200);
    }
  },
  /* Janela de 390x844 de verdade, e nao um iframe recortado depois.
     O truque do iframe existia porque, com --force-device-scale-factor=2, o
     `width=device-width` resolve para 780 numa janela de 390 e a folha saia
     cortada na direita. A causa era a escala, entao a correcao e a escala: aqui
     ela e 1, device-width volta a valer 390, e o layout de celular renderiza no
     tamanho em que ele foi desenhado. Sem crop, sem iframe -- as duas coisas que
     falhavam em silencio (o app do pai aparecia em volta da moldura, e o sips
     nao chegava a recortar). */
  mobile: {
    width: 390, height: 844, scale: 1, wait: 50000,
    setup: async function (api) {
      await api.ready();
      await api.rows();
      api.browse().openFilters();
      await api.sleep(1500);
    }
  }
};

/* O ajudante que vive dentro da pagina. Fica aqui como texto porque precisa ser
   serializado junto do preset. */
const HELPERS = `
  const api = {
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    until: async (cond, limit = 40000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < limit) {
        if (cond()) return true;
        await api.sleep(250);
      }
      return false;
    },
    ready: () => api.until(() => window.LmsUi && document.querySelector('.split-body')),
    browse: () => document.querySelector('.split-body').__vue__,
    rows: () => api.until(() => {
      const vm = api.browse();
      return vm && vm.rows.length > 0 && !vm.loading && !vm.loadingMore;
    }),
    /* O perfil do Chrome e novo a cada foto, entao o estado ja nasce no
       padrao: nao ha o que limpar. Chamar resetView aqui disparava os
       observadores de filtro e grupo, e o recarregamento seguinte apagava a
       navegacao logo depois de o album ser aberto -- o painel direito saia
       vazio na foto. */
    reset: () => {
      const vm = api.browse();
      if (vm && vm.setPaneWidth) vm.setPaneWidth(window.__paneWidth || 560);
      window.LmsUi.dismissNotice();
    },
    openAlbum: async (re) => {
      const vm = api.browse();
      const row = vm.displayRows.find(r => re.test(r.label)) || vm.displayRows.find(r => r.art);
      if (!row) return false;
      /* selectWithoutDrill e o mesmo caminho que Recentes usa sozinho para
         mostrar o primeiro album no painel direito: escreve rootSelection, sem
         empilhar navegacao. O push de navegacao nao sobrevive aqui -- um
         recarregamento posterior o desfaz --, e a foto saia com o painel
         direito vazio. */
      vm.selectWithoutDrill(row);
      /* Esperar o detalhe chegar, e nao um tempo fixo: o tempo virtual do
         Chrome corre mais rapido que a rede. */
      return api.until(() => !document.querySelector('.pane-right .empty'));
    }
  };
`;

function injection(name) {
  const shot = SHOTS[name];
  return `<script>window.addEventListener('load', function () { setTimeout(async function () {
${HELPERS}
  var diag = 'ok';
  try { await (${shot.setup.toString()})(api); }
  catch (e) { diag = 'ERRO ' + (e && e.message ? e.message : e); }
  try {
    var vm = api.browse();
    diag += ' | linhas=' + (vm ? vm.rows.length : '?') +
      ' | vazio=' + !!document.querySelector('.pane-right .empty') +
      ' | frame=' + JSON.stringify(vm && vm.frame ? vm.frame.label : null);
  } catch (e2) { diag += ' | diag falhou'; }
  document.title = diag;
}, 800); });</script>`;
}

function proxy(name) {
  return http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const upstream = http.request({
        host: TARGET_HOST, port: TARGET_PORT, path: req.url,
        method: req.method, headers: Object.assign({}, req.headers, { host: TARGET })
      }, (up) => {
        const type = String(up.headers['content-type'] || '');
        if (!type.includes('text/html')) {
          res.writeHead(up.statusCode, up.headers);
          up.pipe(res);
          return;
        }
        const parts = [];
        up.on('data', (c) => parts.push(c));
        up.on('end', () => {
          let html = Buffer.concat(parts).toString('utf8');
          html = html.replace('</body>', injection(name) + '</body>');
          const headers = Object.assign({}, up.headers);
          delete headers['content-length'];
          delete headers['content-encoding'];
          res.writeHead(up.statusCode, headers);
          res.end(html);
        });
      });
      upstream.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
      upstream.end(body);
    });
  });
}

function capture(name) {
  const shot = SHOTS[name];
  const out = path.join(OUT, name + '.png');
  const profile = path.join(require('node:os').tmpdir(), 'echoclassic-shot-' + name);
  fs.rmSync(profile, { recursive: true, force: true });
  return new Promise((resolve, reject) => {
    const server = proxy(name).listen(PORT, '127.0.0.1', () => {
      const child = spawn(CHROME, [
        '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
        /* Escala 2x so nas fotos largas. Em 390px o --force-device-scale-factor
           faz o meta viewport resolver device-width em pixels de dispositivo, e
           a folha sai cortada na direita -- por isso o preset de celular pede 1. */
        '--force-device-scale-factor=' + (shot.scale || 2),
        '--window-size=' + shot.width + ',' + shot.height,
        '--virtual-time-budget=' + shot.wait,
        '--user-data-dir=' + profile,
        '--screenshot=' + out,
        'http://127.0.0.1:' + PORT + '/echoclassic/'
      ], { stdio: 'ignore' });
      /* O Chrome headless as vezes nao encerra sozinho depois de gravar. */
      const killer = setTimeout(() => child.kill('SIGKILL'), shot.wait + 25000);
      child.on('exit', () => {
        clearTimeout(killer);
        server.close(() => {
          fs.rmSync(profile, { recursive: true, force: true });
          if (!fs.existsSync(out)) return reject(new Error('sem imagem: ' + name));
          if (!shot.crop) return resolve(out);
          /* O recorte sai em pixels de dispositivo: a captura e 2x. */
          const crop = spawn('sips', ['-c', String(shot.crop.h * 2), String(shot.crop.w * 2), out],
            { stdio: 'ignore' });
          crop.on('exit', () => resolve(out));
        });
      });
    });
  });
}

(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  const wanted = process.argv.slice(2).filter((a) => SHOTS[a]);
  const names = wanted.length ? wanted : Object.keys(SHOTS);
  for (const name of names) {
    process.stdout.write('  ' + name + ' … ');
    try {
      const file = await capture(name);
      const size = fs.statSync(file).size;
      console.log(path.relative(path.join(__dirname, '..'), file) + '  ' +
        Math.round(size / 1024) + ' KB');
    } catch (e) {
      console.log('FALHOU — ' + e.message);
    }
  }
})();
