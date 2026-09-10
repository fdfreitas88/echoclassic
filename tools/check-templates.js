/* Compila toda string `template:` dos componentes Vue. Um erro aqui e uma tela
   que renderiza em branco no navegador sem nada no console do servidor. */
const compiler = require('vue-template-compiler');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'EchoClassic/HTML/echoclassic/html/js');
let files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  }
})(root);
let total = 0, bad = 0;
for (const f of files.sort()) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /template:\s*`([\s\S]*?)`\s*,\n/g;
  let m;
  while ((m = re.exec(src))) {
    total++;
    const r = compiler.compile(m[1]);
    if (r.errors.length) { bad++; console.log('  FALHA', path.relative(root, f), '->', r.errors.join(' | ')); }
    for (const t of (r.tips || [])) console.log('  dica ', path.relative(root, f), '->', t);
  }
}
console.log(`  ${total} templates compilados, ${bad} com erro`);
process.exit(bad ? 1 : 0);
