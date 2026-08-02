
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

  global.LmsFmt = {
    count: count, duration: duration, longDuration: longDuration,
    rate: rate, depth: depth, format: format, year: year,
    isHiRes: isHiRes, coverUrl: coverUrl
  };
})(window);