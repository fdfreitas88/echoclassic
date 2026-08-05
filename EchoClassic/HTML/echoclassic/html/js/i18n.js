/* Camada de idioma da skin.

   O texto da interface esta embutido em INGLES dentro dos templates. Em vez de
   trocar 357 pontos de chamada por chaves -- cada um deles uma chance de
   quebrar um template em producao -- a traducao acontece num unico lugar: o
   template de cada componente e reescrito uma vez, no registro, antes de o Vue
   compila-lo.

   A chave do dicionario e a propria frase em ingles. Isso da a propriedade que
   importa aqui: se uma frase nao estiver no dicionario, ou se o idioma
   escolhido for o ingles, o texto original continua valendo. Nao existe estado
   em que a tela apareca vazia ou com uma chave crua. Traduzir passa a ser
   acrescentar linhas em strings.txt, sem tocar em JavaScript.

   Os dicionarios chegam prontos do servidor em LMS_STRINGS_BY_LANG -- todos
   eles, e nao so o do idioma da sessao do LMS. Quem escolhe e este arquivo,
   porque a escolha vive nos Ajustes da skin e nao no servidor. */
(function (global) {
  'use strict';

  var SOURCE = 'EN';
  var STORE_KEY = 'echoclassic.lang.v1';

  var BY_LANG = (typeof LMS_STRINGS_BY_LANG === 'object' && LMS_STRINGS_BY_LANG)
    ? LMS_STRINGS_BY_LANG : {};
  var NAMES = (typeof LMS_LANG_NAMES === 'object' && LMS_LANG_NAMES)
    ? LMS_LANG_NAMES : {};
  /* O idioma da sessao do LMS e so o palpite inicial. A escolha feita nos
     Ajustes da skin vale mais: quem roda o servidor em portugues e quer a
     interface em ingles nao tinha, ate aqui, nenhuma forma de dizer isso. */
  var SESSION = (typeof LMS_LANG === 'string' && LMS_LANG) ? LMS_LANG : SOURCE;

  function available(code) {
    return code === SOURCE || Object.prototype.hasOwnProperty.call(BY_LANG, code);
  }

  function stored() {
    try {
      var v = global.localStorage && global.localStorage.getItem(STORE_KEY);
      return v && available(v) ? v : null;
    } catch (e) { return null; }
  }

  var LANG = stored() || (available(SESSION) ? SESSION : SOURCE);
  var MAP = (LANG !== SOURCE && BY_LANG[LANG]) ? BY_LANG[LANG] : {};
  var ACTIVE = false;
  for (var k in MAP) { if (Object.prototype.hasOwnProperty.call(MAP, k)) { ACTIVE = true; break; } }

  /* Os templates sao reescritos uma unica vez, no registro dos componentes.
     Trocar de idioma no lugar deixaria em tela os componentes ja compilados com
     o texto antigo, entao a troca guarda a escolha e recarrega -- que e o que
     alguem espera de um seletor de idioma. */
  function setLanguage(code) {
    if (!available(code) || code === LANG) return false;
    try { global.localStorage.setItem(STORE_KEY, code); }
    catch (e) { return false; }
    global.location.reload();
    return true;
  }

  function languages() {
    var codes = [];
    for (var c in BY_LANG) {
      if (Object.prototype.hasOwnProperty.call(BY_LANG, c)) codes.push(c);
    }
    codes.sort();
    var out = [{ key: SOURCE, label: NAMES[SOURCE] || SOURCE }];
    for (var i = 0; i < codes.length; i++) {
      out.push({ key: codes[i], label: NAMES[codes[i]] || codes[i] });
    }
    return out;
  }

  /* O texto no template quase nunca chega igual ao que esta em strings.txt:
     frase longa vem quebrada em varias linhas com recuo, e prefixo de frase
     composta vem colado num dois-pontos ("Ano desta edicao: {{ ano }}"). Um
     indice com o espacamento normalizado resolve os dois casos sem obrigar o
     tradutor a reproduzir a indentacao do codigo. */
  function norm(s) { return s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  var NORM = {};
  for (var nk in MAP) {
    if (Object.prototype.hasOwnProperty.call(MAP, nk)) NORM[norm(nk)] = MAP[nk];
  }

  function lookup(raw) {
    if (MAP[raw]) return MAP[raw];
    var s = norm(raw);
    if (NORM[s]) return NORM[s];
    /* "Ano desta edicao:" acha "Ano desta edicao" e devolve o dois-pontos. */
    var m = s.match(/^(.+?)\s*:$/);
    if (m && NORM[m[1]]) return NORM[m[1]] + ':';
    return null;
  }

  /* Devolve o valor original -- nao uma copia em texto -- quando nao ha o que
     traduzir. Isso importa porque t() passa a envolver toda interpolacao dos
     templates, e por ali circulam numeros, nulos e objetos que nao podem virar
     string no caminho. */
  function t(text) {
    if (!ACTIVE || typeof text !== 'string' || !text) return text;
    var hit = lookup(text);
    if (!hit) return text;
    /* Espaco nas pontas e comum em fragmentos concatenados ("Acoes para ").
       Traduz o miolo e devolve o espacamento intacto. */
    var trimmed = text.replace(/^\s+|\s+$/g, '');
    if (trimmed !== text) return text.replace(trimmed, hit);
    return hit;
  }

  /* Atributos cujo valor e texto lido por pessoa. `title` e `placeholder`
     aparecem na tela; `aria-label` vai para o leitor de tela. Os tres precisam
     acompanhar o idioma. */
  var ATTRS = /\s(aria-label|title|placeholder|aria-valuetext|aria-description)="([^"]*)"/g;

  function translateTemplate(tpl) {
    if (!ACTIVE || typeof tpl !== 'string') return tpl;

    /* Texto entre tags. Um mesmo no costuma misturar texto fixo e interpolacao
       ("Servidor LMS {{ version }}"), entao ele e quebrado nas chaves duplas: os
       pedacos fixos passam pelo dicionario e cada expressao e envolvida em
       $t(), que resolve em tempo de execucao o que so existe no JavaScript --
       rotulos de aba, mensagens montadas por concatenacao, rotulos calculados.
       Expressao com filtro do Vue ({{ x | f }}) fica intacta: envolve-la
       mudaria a ordem de aplicacao do filtro. */
    tpl = tpl.replace(/>([^<>]+)</g, function (all, inner) {
      if (!/[A-Za-zÀ-ÿ]/.test(inner)) return all;

      if (inner.indexOf('{{') < 0) {
        var core = inner.replace(/^\s+|\s+$/g, '');
        if (!core) return all;
        var hit = lookup(core);
        return hit ? all.replace(core, hit) : all;
      }

      var out = inner.replace(/\{\{([\s\S]*?)\}\}|([^{]+|\{(?!\{))/g,
        function (piece, expr, literal) {
          if (expr !== undefined) {
            var e = expr.replace(/^\s+|\s+$/g, '');
            /* Filtro do Vue e um | isolado. O teste anterior tratava o
               segundo cano de um || como filtro, e por isso toda expressao do
               tipo `x || 'texto padrao'` escapava da traducao -- justamente o
               padrao usado nos campos que caem em "nao informado". */
            if (!e || /(^|[^|])\|([^|]|$)/.test(e) || e.indexOf('$t(') === 0) return piece;
            return '{{ $t(' + e + ') }}';
          }
          var lit = literal || '';
          var trimmed = lit.replace(/^\s+|\s+$/g, '');
          if (!trimmed) return lit;
          var h = lookup(trimmed);
          return h ? lit.replace(trimmed, h) : lit;
        });
      return '>' + out + '<';
    });

    /* Atributos estaticos. Os dinamicos (:title, :aria-label) carregam
       expressao JavaScript e sao resolvidos em tempo de execucao pelo t(). */
    tpl = tpl.replace(ATTRS, function (all, attr, value) {
      var hit = lookup(value);
      return hit ? ' ' + attr + '="' + hit.replace(/"/g, '&quot;') + '"' : all;
    });

    return tpl;
  }

  /* O envelope so existe se houver traducao a fazer. Em portugues a skin roda
     exatamente como rodava antes desta camada existir. */
  if (ACTIVE && global.Vue && typeof global.Vue.component === 'function') {
    /* $t precisa existir antes do primeiro render: e ele que os templates
       reescritos chamam em cada interpolacao. */
    global.Vue.prototype.$t = t;
    var original = global.Vue.component.bind(global.Vue);
    global.Vue.component = function (name, definition) {
      if (definition && typeof definition === 'object' && typeof definition.template === 'string') {
        definition.template = translateTemplate(definition.template);
      }
      return original(name, definition);
    };
  }

  /* As notificacoes nao passam por template: sao montadas em JavaScript e
     entregues ao LmsUi.notify. Envolver a funcao uma vez cobre todas elas sem
     tocar em nenhum ponto de chamada. O envelope so e instalado depois que
     ui.js registrou a funcao, por isso o adiamento. */
  function wrapNotify() {
    if (!ACTIVE || !global.LmsUi || typeof global.LmsUi.notify !== 'function') return;
    if (global.LmsUi.notify.__i18n) return;
    var inner = global.LmsUi.notify;
    var wrapper = function (message) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = t(message);
      return inner.apply(this, args);
    };
    wrapper.__i18n = true;
    global.LmsUi.notify = wrapper;
  }
  if (ACTIVE) {
    if (global.document && global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', wrapNotify);
    } else {
      setTimeout(wrapNotify, 0);
    }
  }

  global.LmsStr = {
    t: t,
    lang: LANG,
    source: SOURCE,
    active: ACTIVE,
    languages: languages,
    setLanguage: setLanguage,
    translateTemplate: translateTemplate
  };
}(window));
