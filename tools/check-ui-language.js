/* Only what a user can actually read: template text nodes, human-readable
   attributes, and string literals handed to notify/error/label paths.
   Comments and identifiers are excluded -- they never reach the screen. */
const fs=require('node:fs'), path=require('node:path');
const JS='/Users/felipefreitas/Desktop/Claude/LMS/EchoClassic/EchoClassic/HTML/echoclassic/html/js';
/* Any text that exactly matches a Portuguese translation in strings.txt is
   Portuguese, whatever it looks like. That catches phrases with no accents and
   no obvious marker words -- "Estilo no mini player (tema claro)" sat on screen
   for weeks because a word-list heuristic never flagged it. */
const PT_VALUES = (() => {
  const txt = fs.readFileSync('/Users/felipefreitas/Desktop/Claude/LMS/EchoClassic/EchoClassic/strings.txt','utf8');
  const out = new Set(); const en = new Map(); let key = null;
  for (const line of txt.split('\n')) {
    if (/^\S/.test(line) && line.trim()) { key = line.trim(); continue; }
    if (!key || !key.startsWith('ECHOCLASSIC_UI_')) continue;
    const e = line.match(/^\s+EN\s+(.*)$/); if (e) { en.set(key, e[1].trim()); continue; }
    const m = line.match(/^\s+PT\s+(.*)$/);
    /* Words spelled the same in both languages -- Volume, Apps, Playlists,
       Player -- are not evidence of anything. */
    if (m && m[1].trim() && m[1].trim() !== en.get(key)) out.add(m[1].trim());
  }
  return out;
})();
const PT=/[ãõçáéíóúâêôà]|\b(n[ãa]o|voc[êe]|uma|dos|das|pela|pelo|est[áa]|s[ãa]o|nenhum|todos|tocar|fila|busca|ajustes|reprodu[çc][ãa]o|biblioteca|erro|aviso|carregando|salvar|apagar|renomear|nome|editar|criar|filtrar|limpar|adicionar|remover|mover|escolher|faixas?|[áa]lbuns?|m[úu]sica|lista|arquivo|tela|pilha|grupo)\b/i;
function strip(s){return s.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/(^|[^:'"\\])\/\/[^\n]*/g,(m,p)=>p+m.slice(p.length).replace(/./g,' '));}
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):(e.name.endsWith('.js')?[path.join(d,e.name)]:[]));}
const out=[];
for(const f of walk(JS)){
  if(/i18n\.js$/.test(f))continue;
  const src=strip(fs.readFileSync(f,'utf8'));
  src.split('\n').forEach((line,i)=>{
    const hits=[];
    // template text nodes
    // text nodes; a node mixing fixed text with {{ }} is split, because each
    // literal fragment is looked up on its own at runtime ("Original year: ")
    (line.match(/>[^<>]*[A-Za-zÀ-ÿ][^<>]*</g)||[]).forEach(m=>{
      m.slice(1,-1).split(/\{\{[\s\S]*?\}\}/).forEach(frag=>{
        const t=frag.trim(); if(t&&(PT.test(t)||PT_VALUES.has(t)))hits.push('text: '+t);
      });
    });
    // human-readable attributes
    (line.match(/\s(?:title|placeholder|aria-label|aria-valuetext|aria-description)="([^"]*)"/g)||[]).forEach(m=>{const t=m.split('="')[1].slice(0,-1); if(PT.test(t)||PT_VALUES.has(t))hits.push('attr: '+t);});
    // string literals that carry prose (2+ words, or accented)
    (line.match(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)||[]).forEach(m=>{const t=m.slice(1,-1); if(t.length>3&&(PT_VALUES.has(t)||(PT.test(t)&&/\s|[ãõçáéíóúâêô]/.test(t))))hits.push('literal: '+t);});
    hits.forEach(h=>out.push(path.basename(f)+':'+(i+1)+'  '+h.slice(0,110)));
  });
}
console.log(out.length?out.join('\n'):'  none — no Portuguese can reach the screen');
console.log('\ntotal user-visible Portuguese: '+out.length);
