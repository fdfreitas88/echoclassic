
/* Presentation-only helpers. No DOM, no network, no state — which is what makes
   them the one place number and time formatting is allowed to live. */
(function (global) {
  'use strict';

  var DSD64 = 2822400;

  function finite(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function count(n) {
    return String(Math.round(finite(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function duration(seconds) {
    var s = Math.round(finite(seconds));
    if (s < 0) s = 0;
    var h = Math.floor(s / 3600);
    var m = Math.floor(s / 60) % 60;
    var rest = s % 60;
    /* Audiolivro e concerto passam de uma hora; sem isto 1h15 virava "75:00". */
    if (h) return h + ':' + pad(m) + ':' + pad(rest);
    return m + ':' + pad(rest);
  }

  function longDuration(seconds) {
    var s = Math.round(finite(seconds));
    if (s < 0) s = 0;
    /* Abaixo de um minuto nao ha o que arredondar: "0 min" nao diz nada. */
    if (s < 60) return 'menos de 1 min';
    /* Arredonda uma vez, em minutos, e so depois separa horas: arredondar hora e
       minuto em paralelo produzia "60 min" e "1 h 60 min". */
    var total = Math.round(s / 60);
    var h = Math.floor(total / 60);
    var m = total % 60;
    if (!h) return m + ' min';
    return m ? h + ' h ' + m + ' min' : h + ' h';
  }

  function rate(sampleRate) {
    var sr = finite(sampleRate);
    if (!sr) return '';
    if (sr >= DSD64) return 'DSD' + Math.round(sr / 44100);
    var khz = sr / 1000;
    var text = khz % 1 ? khz.toFixed(1) : String(khz);
    return text.replace('.', ',') + ' kHz';
  }

  function depth(sampleSize) {
    var ss = finite(sampleSize);
    return ss ? ss + ' bits' : '';   // em pt-BR a unidade vai no plural
  }

  function format(value) {
    var type = String(value || '').toUpperCase();
    if (type === 'FLC') return 'FLAC';
    if (/^(ALC|ALCX)$/.test(type)) return 'ALAC';
    if (type === 'WVP') return 'WavPack';
    if (/^(DSF|DFF)$/.test(type)) return 'DSD';
    return type;
  }

  function year(value) {
    var n = Math.round(finite(value));
    var max = new Date().getFullYear() + 1;
    return n >= 1000 && n <= max ? n : 0;
  }

  function isHiRes(sampleRate, sampleSize) {
    return finite(sampleRate) > 48000 || finite(sampleSize) > 16;
  }

  function coverUrl(coverId, size) {
    if (!coverId) return '';
    var id = encodeURIComponent(coverId);
    /* Qualquer tamanho pedido vira um redimensionamento no servidor; antes so o
       50 tinha atalho e todo o resto baixava a capa em resolucao cheia. */
    var px = Math.round(finite(size));
    if (px > 0) return '/music/' + id + '/cover_' + px + 'x' + px + '.jpg';
    return '/music/' + id + '/cover.jpg';
  }

  /* Comparacao de edicoes equivalentes.

     Tupla comparada da esquerda para a direita, nunca um numero somado: somar
     pesos e o que faz 192 kHz "ganhar" de um FLAC 16/44 bem masterizado por
     acidente aritmetico. Taxa alta nao e prova de masterizacao melhor, e esta
     funcao nao finge que e -- ela ordena o que da para verificar e para.

     Os eixos, em ordem:
       0 disponibilidade   tocavel agora vence indisponivel, sempre
       1 origem declarada  so quando o usuario declarou preferencia de fonte
       2 codec             lossless > lossy; DSD em classe propria
       3 resolucao tecnica so compara dentro de lossless
       4 desempate final   mantem a ordem total quando o resto empata */
  var LOSSLESS = { flac: 1, alac: 1, wav: 1, aiff: 1, ape: 1, wavpack: 1 };
  var UNCOMPARABLE = { dsd: 1 };   // DSD nao se compara tecnicamente com PCM

  function isLossless(formatKey) {
    return !!LOSSLESS[String(formatKey || '').toLowerCase()];
  }

  function codecClass(meta) {
    var formats = (meta && meta.formats) || {};
    var keys = Object.keys(formats);
    if (!keys.length) return 3;
    var best = 3;
    keys.forEach(function (key) {
      var rank = LOSSLESS[key] ? 0 : (UNCOMPARABLE[key] ? 1 : 2);
      if (rank < best) best = rank;
    });
    return best;
  }

  function resolutionClass(meta) {
    if (!meta) return 2;
    if (meta.hires) return 0;
    if (meta.standard) return 1;
    return 2;
  }

  function originClass(meta, wanted) {
    if (!meta) return 1;
    if (wanted === 'local') return meta.local ? 0 : 1;
    if (wanted === 'stream') return meta.remote ? 0 : 1;
    return 0;
  }

  /* Ausencia nunca exclui: metadado faltando ordena abaixo do conhecido do
     mesmo codec, e continua na lista. */
  function editionRank(meta, prefer) {
    var codec = codecClass(meta);
    var available = 0;
    if (prefer === 'local') return [available, originClass(meta, 'local'), codec, resolutionClass(meta), 0];
    if (prefer === 'stream') return [available, originClass(meta, 'stream'), codec, resolutionClass(meta), 0];
    if (prefer === 'quality') return [available, 0, codec, resolutionClass(meta), originClass(meta, 'local')];
    return [0, 0, 0, 0, 0];   // sem preferencia declarada nada e reordenado
  }

  function compareEditions(a, b, prefer) {
    var ra = editionRank(a, prefer);
    var rb = editionRank(b, prefer);
    for (var i = 0; i < ra.length; i++) {
      if (ra[i] !== rb[i]) return ra[i] - rb[i];
    }
    return 0;
  }

  global.LmsFmt = {
    count: count, duration: duration, longDuration: longDuration,
    rate: rate, depth: depth, format: format, year: year,
    isHiRes: isHiRes, coverUrl: coverUrl,
    editionRank: editionRank, compareEditions: compareEditions, isLossless: isLossless
  };
})(window);