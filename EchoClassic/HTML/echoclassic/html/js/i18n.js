/* The skin's language layer.

   The interface text is embedded in ENGLISH inside the templates. Rather than
   replace 357 call sites with keys -- each one a chance to break a template in
   production -- translation happens in a single place: every component's
   template is rewritten once, at registration, before Vue compiles it.

   The dictionary is keyed by the English phrase itself. That gives the property
   which matters here: if a phrase is missing from the dictionary, or the chosen
   language is English, the original text still stands. There is no state in
   which the screen renders empty or shows a raw key. Translating becomes adding
   lines to strings.txt, without touching any JavaScript.

   The dictionaries arrive ready-made from the server in LMS_STRINGS_BY_LANG --
   all of them, not just the LMS session's. This file does the choosing, because
   the choice lives in the skin's Settings and not on the server. */
(function (global) {
  'use strict';

  var SOURCE = 'EN';
  var STORE_KEY = 'echoclassic.lang.v1';

  var BY_LANG = (typeof LMS_STRINGS_BY_LANG === 'object' && LMS_STRINGS_BY_LANG)
    ? LMS_STRINGS_BY_LANG : {};
  var NAMES = (typeof LMS_LANG_NAMES === 'object' && LMS_LANG_NAMES)
    ? LMS_LANG_NAMES : {};
  /* The LMS session language is only the opening guess. A choice made in the
     skin's Settings outranks it: someone running the server in Portuguese who
     wants the interface in English had, until now, no way to say so. */
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

  /* Templates are rewritten exactly once, when the components register.
     Switching language in place would leave the already-compiled components on
     screen with the old text, so the switch stores the choice and reloads --
     which is what anyone expects from a language picker. */
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

  /* Template text almost never arrives identical to what is in strings.txt: a
     long phrase comes wrapped across several indented lines, and the prefix of
     a composed phrase comes glued to a colon ("Year of this edition: {{ y }}").
     An index with normalised whitespace handles both cases without forcing the
     translator to reproduce the code's indentation. */
  function norm(s) { return s.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }

  var NORM = {};
  for (var nk in MAP) {
    if (Object.prototype.hasOwnProperty.call(MAP, nk)) NORM[norm(nk)] = MAP[nk];
  }

  function lookup(raw) {
    if (MAP[raw]) return MAP[raw];
    var s = norm(raw);
    if (NORM[s]) return NORM[s];
    /* "Year of this edition:" finds "Year of this edition" and puts the colon
       back. */
    var m = s.match(/^(.+?)\s*:$/);
    if (m && NORM[m[1]]) return NORM[m[1]] + ':';
    return null;
  }

  /* Returns the original value -- not a stringified copy -- when there is
     nothing to translate. That matters because t() now wraps every template
     interpolation, and numbers, nulls and objects travel through there and must
     not be turned into strings on the way. */
  function t(text) {
    if (!ACTIVE || typeof text !== 'string' || !text) return text;
    var hit = lookup(text);
    if (!hit) return text;
    /* Leading and trailing space is common in concatenated fragments ("More
       actions for "). Translate the core and hand the spacing back intact. */
    var trimmed = text.replace(/^\s+|\s+$/g, '');
    if (trimmed !== text) return text.replace(trimmed, hit);
    return hit;
  }

  /* Attributes whose value is text a person reads. `title` and `placeholder`
     show on screen; `aria-label` goes to the screen reader. All three have to
     follow the language. */
  var ATTRS = /\s(aria-label|title|placeholder|aria-valuetext|aria-description)="([^"]*)"/g;

  function translateTemplate(tpl) {
    if (!ACTIVE || typeof tpl !== 'string') return tpl;

    /* Text between tags. One node often mixes fixed text and interpolation
       ("LMS Server {{ version }}"), so it is split on the double braces: the
       fixed pieces go through the dictionary and each expression is wrapped in
       $t(), which resolves at runtime what only exists in JavaScript -- tab
       labels, messages built by concatenation, computed labels. An expression
       carrying a Vue filter ({{ x | f }}) is left alone: wrapping it would
       change the order the filter applies in. */
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
            /* A Vue filter is a lone |. The previous test treated the second
               pipe of a || as a filter, so every expression shaped like
               `x || 'default text'` escaped translation -- exactly the pattern
               used by the fields that fall back to "not available". */
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

    /* Static attributes. The dynamic ones (:title, :aria-label) carry a
       JavaScript expression and are resolved at runtime by t(). */
    tpl = tpl.replace(ATTRS, function (all, attr, value) {
      var hit = lookup(value);
      return hit ? ' ' + attr + '="' + hit.replace(/"/g, '&quot;') + '"' : all;
    });

    return tpl;
  }

  /* The wrapper only exists when there is translating to do. In English the
     skin runs exactly as it did before this layer existed. */
  if (ACTIVE && global.Vue && typeof global.Vue.component === 'function') {
    /* $t has to exist before the first render: it is what the rewritten
       templates call on every interpolation. */
    global.Vue.prototype.$t = t;
    var original = global.Vue.component.bind(global.Vue);
    global.Vue.component = function (name, definition) {
      if (definition && typeof definition === 'object' && typeof definition.template === 'string') {
        definition.template = translateTemplate(definition.template);
      }
      return original(name, definition);
    };
  }

  /* Notifications do not go through a template: they are built in JavaScript
     and handed to LmsUi.notify. Wrapping that function once covers all of them
     without touching a single call site. The wrapper is only installed after
     ui.js has registered the function, hence the deferral. */
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
