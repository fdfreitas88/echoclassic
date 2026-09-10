/* Cada modulo publica um objeto em window (LmsStore, LmsUi, ...). Uma chamada a
   um metodo que o dono nao exporta so aparece em runtime, no clique do usuario.
   Este portao a transforma em erro de validacao. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'EchoClassic/HTML/echoclassic/html/js');
let files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  }
})(root);
const src = {};
for (const f of files) src[f] = fs.readFileSync(f, 'utf8');
const owner = {
  LmsStore: 'store.js', LmsUi: 'ui.js', LmsNav: 'nav.js',
  LmsApi: 'api.js', LmsFmt: 'format.js'
};
const exported = {};
for (const [ns, base] of Object.entries(owner)) {
  const file = files.find(f => path.basename(f) === base);
  const s = file ? src[file] : '';
  const set = new Set();
  const g = s.match(new RegExp('global\\.' + ns + '\\s*=\\s*\\{[\\s\\S]*?\\n\\s*\\};', 'm'));
  if (g) for (const m of g[0].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) set.add(m[1]);
  for (const m of s.matchAll(new RegExp(ns + '\\.([A-Za-z_$][\\w$]*)\\s*=[^=]', 'g'))) set.add(m[1]);
  exported[ns] = set;
}
let missing = 0;
for (const f of files.sort()) {
  for (const [ns, base] of Object.entries(owner)) {
    if (path.basename(f) === base) continue;
    for (const m of src[f].matchAll(new RegExp(ns + '\\.([A-Za-z_$][\\w$]*)', 'g'))) {
      if (!exported[ns].has(m[1])) {
        console.log(`  FALHA ${path.relative(root, f)}: ${ns}.${m[1]} nao e exportado por ${base}`);
        missing++;
      }
    }
  }
}
console.log(missing ? `  ${missing} referencias orfas` : '  nenhuma referencia orfa');
process.exit(missing ? 1 : 0);
