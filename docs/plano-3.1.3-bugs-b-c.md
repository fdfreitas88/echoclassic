# Echo Classic 3.1.3 — correção dos bugs B e C

> **Para quem for executar:** use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam
> caixas (`- [ ]`) para marcação.

**Objetivo:** fazer o filtro de mídia parar de esvaziar a tela em silêncio (bug B)
e fazer o menu de exibição parar de prometer agrupamento que a view não entrega
(bug C).

**Arquitetura:** as duas falhas são o mesmo defeito de contrato de interface. O
`sortKey` mistura três operações — agrupar, ordenar e filtrar — é gravado *por
view* em `echoclassic.ui.v2`, e a única evidência de que um filtro está ativo é
`mediaDescriptor()` colado no subtítulo de cada linha. Quando o filtro zera a
lista, essa evidência some junto. A correção não muda nenhuma consulta ao
servidor: torna o filtro visível fora das linhas, nomeia o filtro no estado
vazio, e para de deixar o menu oferecer opções que a view corrente não honra.

**Stack:** Vue 2 sem build, `node --test`, `tools/validate.sh` (4 portões).

## Diagnóstico que fundamenta este plano

Medido contra a biblioteca real do `musicplayer` (LMS 9.1.1, 1548 artistas,
1398 álbuns, 14210 faixas), reexecutando o código do próprio `api.js`:

- **O índice de artistas está saudável.** 1388 de 1398 álbuns são atribuídos. Os
  10 restantes são `P.F.M.` (5), `Various Artists` (4) e `V.S.O.P.` (1) — o
  comportamento documentado de `abbreviatedArtist`. **Os 31 álbuns dos Beatles
  acertam o índice**, nos dois contribuidores (673 e 674). O bug C **não** é
  falha de índice.
- **9 das 16 chaves de filtro esvaziam Recentes.** `stream:qobuz` e
  `origin:remote` rendem **425 álbuns em Álbuns e 0 em Recentes**, porque os 100
  álbuns mais novos são todos locais.
- **O filtro persiste por view.** Verificado executando `ui.js`: escolher
  `stream:qobuz` em Recentes, sair para Artistas e voltar devolve
  `sortKey: stream:qobuz`.
- `limitWarning` (`browse.js:146`) vive dentro do `<template v-else>`, então
  **nem o aviso aparece** quando a lista está vazia.

**Fora de escopo, com justificativa:** o fallback álbum→artista que o brief pedia
para o bug C atingiria apenas aqueles 10 álbuns, que já aparecem como linha de
álbum *com* aviso em `limitWarning`. Não é o que o usuário está encontrando.
Fica para a camada de polimento. O bug A (busca no Qobuz) é funcionalidade nova
sobre superfície de API nova — 3.2, não 3.1.3.

## Restrições globais

- Nenhuma dependência nova. Vue 2, sem etapa de build.
- ES5 no código da skin (`var`, `function`), igual ao resto dos módulos.
- Literais de interface em português; a tradução é o próprio texto PT como chave
  (`Plugin.pm::getStringMap` monta `{ frase_PT => frase_traduzida }`).
- **Não introduzir token de cor novo em `ios9.css`** — o portão 4 recalcula pares
  fixos de contraste e um token novo passaria despercebido.
- Não duplicar enums de `ui.js` dentro de `browse.js`: a auditoria já registra
  essa dívida em `settings.js`.
- Versão sobe em quatro lugares: `EchoClassic/install.xml`,
  `EchoClassic/Plugin.pm`, `CHANGELOG.md`, `repo.xml`.
- `<enforce>` nunca volta ao `install.xml`; `<category>skin</category>` fica.

## Estrutura de arquivos

| Arquivo | Responsabilidade nesta mudança |
|---|---|
| `EchoClassic/HTML/echoclassic/html/js/ui.js` | passa a expor `allowsMediaFilter(view)`, fonte única da regra |
| `EchoClassic/HTML/echoclassic/html/js/browse.js` | consome a regra; menu honesto, chip de filtro, estado vazio nomeado |
| `EchoClassic/HTML/echoclassic/html/css/ios9.css` | `.filter-chip`, só com tokens existentes |
| `EchoClassic/strings.txt` | entradas EN/PT dos literais novos |
| `tests/helpers.js` | `uiContext()` e `browseComponent()` — arreios novos |
| `tests/browse.test.js` | **novo** — primeiro teste que cobre `browse.js` |

---

### Task 1: expor `allowsMediaFilter` em `ui.js` e criar os arreios de teste

Hoje a regra "só Álbuns e Recentes filtram" está escrita três vezes: dentro de
`validSortForView` (`ui.js:124`), no `hasMediaFilter` (`browse.js:237`) e na
guarda do `setSort` (`browse.js:465`). Esta tarefa cria a fonte única.

**Arquivos:**
- Modificar: `EchoClassic/HTML/echoclassic/html/js/ui.js:124-133`, e o objeto exportado
- Modificar: `tests/helpers.js` (acrescentar `uiContext` e `browseComponent`)
- Criar: `tests/browse.test.js`

**Interfaces:**
- Produz: `LmsUi.allowsMediaFilter(view) -> boolean`, verdadeiro para `'albuns'`
  e `'recentes'`. Consumido pela Task 2.
- Produz: `helpers.uiContext()` → contexto vm com `LmsUi` carregado;
  `helpers.browseComponent()` → `{ def, ctx }` com a definição do componente
  `lms-browse`. Consumidos pelas Tasks 2 a 5.

- [ ] **Passo 1: acrescentar os arreios em `tests/helpers.js`**

Antes do `module.exports`, acrescente:

```js
/* ui.js e browse.js sao arquivos de navegador: registram efeitos no documento e
   no Vue no momento em que carregam. Estes dois arreios dao o minimo de DOM que
   cada um toca, para que possam ser exercitados sem navegador. */
function uiContext(extra) {
  const store = {};
  const ctx = browserContext(Object.assign({
    localStorage: {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    document: {
      addEventListener: function () {},
      removeEventListener: function () {},
      documentElement: { style: { setProperty: function () {} },
                         classList: { add: function () {}, remove: function () {}, toggle: function () {} } },
      body: { setAttribute: function () {}, removeAttribute: function () {},
              classList: { add: function () {}, remove: function () {}, toggle: function () {} } }
    },
    matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
    navigator: { language: 'pt-BR' },
    Vue: {
      observable: function (o) { return o; },
      component: function () {},
      nextTick: function (f) { if (f) f(); }
    },
    LmsStore: { state: {} },
    LmsApi: {},
    LmsNav: { reset: function () {}, top: function () { return null; } }
  }, extra || {}));
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/ui.js');
  return ctx;
}

function browseComponent() {
  let def = null;
  const ctx = uiContext({
    Vue: {
      observable: function (o) { return o; },
      component: function (name, definition) { def = definition; },
      nextTick: function (f) { if (f) f(); }
    }
  });
  runInContext(ctx, 'EchoClassic/HTML/echoclassic/html/js/browse.js');
  return { def: def, ctx: ctx };
}
```

E acrescente `uiContext` e `browseComponent` ao `module.exports`.

- [ ] **Passo 2: escrever o teste que falha**

Crie `tests/browse.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('./helpers');

test('allowsMediaFilter e a fonte unica da regra de filtro por view', function () {
  const ctx = helpers.uiContext();
  assert.equal(typeof ctx.LmsUi.allowsMediaFilter, 'function');
  assert.equal(ctx.LmsUi.allowsMediaFilter('albuns'), true);
  assert.equal(ctx.LmsUi.allowsMediaFilter('recentes'), true);
  assert.equal(ctx.LmsUi.allowsMediaFilter('artistas'), false);
  assert.equal(ctx.LmsUi.allowsMediaFilter('generos'), false);
  assert.equal(ctx.LmsUi.allowsMediaFilter('anos'), false);
});

test('o filtro de midia continua gravado por view — este e o bug B', function () {
  const ctx = helpers.uiContext();
  ctx.LmsUi.setMusicView('recentes');
  ctx.LmsUi.setSort('stream:qobuz', false);
  assert.equal(ctx.LmsUi.state.sortKey, 'stream:qobuz');

  ctx.LmsUi.setMusicView('artistas');
  assert.equal(ctx.LmsUi.state.sortKey, 'name', 'artistas nao aceita chave de midia');
  ctx.LmsUi.setSort('quality:hires', false);
  assert.equal(ctx.LmsUi.state.sortKey, 'name', 'ui.js ja rejeita filtro fora de albuns/recentes');

  ctx.LmsUi.setMusicView('recentes');
  assert.equal(ctx.LmsUi.state.sortKey, 'stream:qobuz', 'volta com o filtro que esvaziou a tela');
});
```

- [ ] **Passo 3: rodar e ver falhar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: o primeiro teste falha com `typeof ctx.LmsUi.allowsMediaFilter` sendo
`'undefined'`. O segundo **deve passar já** — ele documenta o comportamento atual
que a correção precisa preservar.

- [ ] **Passo 4: implementar em `ui.js`**

Substitua `validSortForView` (linhas 124-133) por:

```js
  /* Só Álbuns e Recentes sabem aplicar filtro de mídia: são as duas views cujo
     carregamento passa por loadMediaIndex. Exportado porque o menu em browse.js
     precisa da mesma resposta para não oferecer o que a view não honra. */
  function allowsMediaFilter(view) {
    return view === 'albuns' || view === 'recentes';
  }

  function validSortForView(view, key) {
    if (allowsMediaFilter(view) && /^(format|quality|origin|stream):[^:]+$/.test(key || '')) {
      return true;
    }
    if (view === 'albuns') return /^(name|artist|relatedArtist|year)$/.test(key || '');
    if (view === 'recentes') return /^(recent|name|artist|year)$/.test(key || '');
    if (view === 'anos') return key === 'name' || key === 'year';
    return key === 'name';
  }
```

No objeto exportado de `ui.js`, acrescente `allowsMediaFilter: allowsMediaFilter,`
junto dos demais membros.

- [ ] **Passo 5: rodar e ver passar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: `# pass 2`, `# fail 0`.

- [ ] **Passo 6: rodar a suíte inteira, para garantir que nada regrediu**

```bash
npm test
```

Esperado: `# fail 0`.

- [ ] **Passo 7: commit**

```bash
git add EchoClassic/HTML/echoclassic/html/js/ui.js tests/helpers.js tests/browse.test.js
git commit -m "refactor(ui): allowsMediaFilter vira a fonte unica da regra de filtro"
```

---

### Task 2: o menu para de oferecer o que a view não honra (bug C, metade 1)

`browse.js:464-471` troca `musicView` para `'albuns'` por baixo do usuário quando
uma opção de mídia é escolhida em Artistas. Como a Task 1 confirmou, `ui.js` já
rejeita essa chave sozinho — o desvio é o único responsável pelo salto de tela.

**Arquivos:**
- Modificar: `EchoClassic/HTML/echoclassic/html/js/browse.js:35-58` (template),
  `:237-240` (`hasMediaFilter`), `:464-471` (`setSort`)
- Modificar: `tests/browse.test.js`

**Interfaces:**
- Consome: `LmsUi.allowsMediaFilter(view)` da Task 1.
- Produz: computed `allowsMediaFilter` no componente, consumido pelas Tasks 3 e 4.

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `tests/browse.test.js`:

```js
function computedsFor(view, sortKey) {
  const captured = helpers.browseComponent();
  const def = captured.def;
  const data = def.data();
  const self = { view: view, ui: { sortKey: sortKey }, MEDIA_FORMATS: data.MEDIA_FORMATS, rows: [] };
  self.mediaDescriptor = def.methods.mediaDescriptor.bind(self);
  self.groupsAlbumsByArtist = def.computed.groupsAlbumsByArtist.call(self);
  self.groupsMainArtists = def.computed.groupsMainArtists.call(self);
  self.allowsMediaFilter = def.computed.allowsMediaFilter.call(self);
  self.hasMediaFilter = def.computed.hasMediaFilter.call(self);
  return { self: self, def: def };
}

test('o menu so libera filtro de midia onde a view sabe aplicar', function () {
  assert.equal(computedsFor('albuns', 'name').self.allowsMediaFilter, true);
  assert.equal(computedsFor('recentes', 'recent').self.allowsMediaFilter, true);
  assert.equal(computedsFor('artistas', 'name').self.allowsMediaFilter, false);
  assert.equal(computedsFor('generos', 'name').self.allowsMediaFilter, false);
});

test('setSort nao troca de view pelas costas do usuario', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  const body = src.split('setSort: function (key)')[1].split('},')[0];
  assert.doesNotMatch(body, /setMusicView/,
    'escolher um formato em Artistas nao pode saltar para Albuns');
});

test('os grupos de midia ficam desabilitados fora de Albuns e Recentes', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  ['Formato', 'Resolução', 'Local', 'Serviços de streaming'].forEach(function (label) {
    const re = new RegExp('<optgroup label="' + label + '"[^>]*:disabled="!allowsMediaFilter"');
    assert.match(src, re, label + ' precisa desabilitar fora de Albuns/Recentes');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: três falhas — `allowsMediaFilter` não é computed, `setSort` ainda cita
`setMusicView`, e os `optgroup` não têm `:disabled`.

- [ ] **Passo 3: acrescentar o computed**

Em `browse.js`, dentro de `computed`, logo antes de `hasMediaFilter` (linha 237):

```js
    allowsMediaFilter: function () { return LmsUi.allowsMediaFilter(this.view); },
```

E troque `hasMediaFilter` (linhas 237-240) por:

```js
    hasMediaFilter: function () {
      return this.allowsMediaFilter &&
        /^(format|quality|origin|stream):/.test(this.ui.sortKey);
    },
```

- [ ] **Passo 4: desabilitar os grupos no template**

Nas linhas 43-57, acrescente `:disabled="!allowsMediaFilter"` às quatro aberturas
de `optgroup`:

```html
        <optgroup label="Formato" :disabled="!allowsMediaFilter">
          <option v-for="f in MEDIA_FORMATS" :key="f.key" :value="'format:' + f.key">{{ f.label }}</option>
        </optgroup>
        <optgroup label="Resolução" :disabled="!allowsMediaFilter">
          <option value="quality:hires">Hi-Res</option>
          <option value="quality:standard">Resolução padrão</option>
        </optgroup>
        <optgroup label="Local" :disabled="!allowsMediaFilter">
          <option value="origin:local">Biblioteca local</option>
          <option value="origin:remote">Remoto / streaming</option>
        </optgroup>
        <optgroup label="Serviços de streaming" :disabled="!allowsMediaFilter">
          <option value="stream:qobuz">Qobuz</option>
          <option value="stream:youtube">YouTube</option>
        </optgroup>
```

- [ ] **Passo 5: remover o desvio de view**

Substitua `setSort` (linhas 464-471) por:

```js
    /* Nao ha guarda aqui de proposito: LmsUi.setSort ja recusa chave invalida
       para a view corrente, e o menu desabilita o que nao se aplica. Uma
       terceira copia da regra so criaria mais um lugar para divergir. */
    setSort: function (key) {
      LmsUi.setSort(key, this.ui.sortDesc);
    },
```

- [ ] **Passo 6: rodar e ver passar**

```bash
node --test --test-concurrency=1 tests/browse.test.js && npm run validate
```

Esperado: `# fail 0` e `TUDO PASSA`.

- [ ] **Passo 7: commit**

```bash
git add EchoClassic/HTML/echoclassic/html/js/browse.js tests/browse.test.js
git commit -m "fix(browse): o menu para de trocar de view pelas costas do usuario"
```

---

### Task 3: o filtro ativo fica visível fora das linhas (bug B, metade 1)

**Arquivos:**
- Modificar: `EchoClassic/HTML/echoclassic/html/js/browse.js` (template, antes de
  `<div class="scroller">` na linha 107; `methods`)
- Modificar: `EchoClassic/HTML/echoclassic/html/css/ios9.css` (após a linha 1088)
- Modificar: `tests/browse.test.js`

**Interfaces:**
- Consome: computed `allowsMediaFilter` e `hasMediaFilter` da Task 2.
- Produz: método `clearMediaFilter()`, consumido pela Task 4.

- [ ] **Passo 1: escrever o teste que falha**

```js
test('o chip nomeia o filtro ativo e some quando nao ha filtro', function () {
  const src = helpers.read('EchoClassic/HTML/echoclassic/html/js/browse.js');
  assert.match(src, /v-if="hasMediaFilter" class="filter-chip"/);
  assert.match(src, /Filtro ativo: \{\{ mediaDescriptor\(\) \}\}/);
  assert.match(src, /@click="clearMediaFilter"/);
});

test('clearMediaFilter devolve a ordenacao propria de cada view', function () {
  const calls = [];
  const captured = helpers.browseComponent();
  const self = { view: 'recentes', ui: { sortKey: 'stream:qobuz', sortDesc: false } };
  captured.ctx.LmsUi.setSort = function (key, desc) { calls.push([key, desc]); };
  captured.def.methods.clearMediaFilter.call(self);
  assert.deepEqual(calls, [['recent', false]], 'Recentes volta para a ordem do servidor');

  calls.length = 0;
  captured.def.methods.clearMediaFilter.call({ view: 'albuns', ui: { sortKey: 'stream:qobuz', sortDesc: false } });
  assert.deepEqual(calls, [['name', false]], 'Albuns volta para o nome');
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: falha em `filter-chip` não encontrado e
`captured.def.methods.clearMediaFilter is not a function`.

- [ ] **Passo 3: acrescentar o método**

Em `browse.js`, dentro de `methods`, logo após `setSort`:

```js
    /* Recentes tem ordem propria ('recent' = a ordem em que o servidor devolveu);
       devolver 'name' aqui reordenaria em ordem alfabetica e apagaria o criterio
       que da nome a pagina. */
    clearMediaFilter: function () {
      LmsUi.setSort(this.view === 'recentes' ? 'recent' : 'name', this.ui.sortDesc);
    },
```

- [ ] **Passo 4: acrescentar o chip ao template**

Imediatamente antes de `<div class="scroller" ref="scroller" @scroll="onScroll">`
(linha 107):

```html
    <div v-if="hasMediaFilter" class="filter-chip" role="status">
      <span class="filter-chip-text ell">Filtro ativo: {{ mediaDescriptor() }}</span>
      <button type="button" class="filter-chip-clear" @click="clearMediaFilter">Limpar filtro</button>
    </div>
```

- [ ] **Passo 5: acrescentar o estilo, sem token novo**

Em `ios9.css`, logo após a linha 1088 (`.loading-more.warning`):

```css
.filter-chip{display:flex;align-items:center;gap:8px;padding:6px 16px;
  background:var(--field);border-bottom:.5px solid var(--hair);font-size:12px;color:var(--text2)}
.filter-chip-text{flex:1;min-width:0}
.filter-chip-clear{flex:0 0 auto;background:none;border:0;padding:0;
  font-size:12px;color:var(--accent);cursor:pointer}
```

- [ ] **Passo 6: rodar os testes e os quatro portões**

```bash
node --test --test-concurrency=1 tests/browse.test.js && npm run validate
```

Esperado: `# fail 0` e `TUDO PASSA`. O portão 4 confere uma lista fixa de pares e
nenhum token novo foi criado, então ele não deve mudar de resultado. **Se o
portão 4 reprovar**, troque `background:var(--field)` por
`background:var(--content)` no `.filter-chip` e rode de novo.

- [ ] **Passo 7: commit**

```bash
git add EchoClassic/HTML/echoclassic/html/js/browse.js EchoClassic/HTML/echoclassic/html/css/ios9.css tests/browse.test.js
git commit -m "fix(browse): o filtro de midia ativo aparece acima da lista"
```

---

### Task 4: o estado vazio nomeia o filtro (bug B, metade 2)

**Arquivos:**
- Modificar: `EchoClassic/HTML/echoclassic/html/js/browse.js:114-117` (template),
  `computed`
- Modificar: `tests/browse.test.js`

**Interfaces:**
- Consome: `hasMediaFilter` (Task 2), `clearMediaFilter` (Task 3), e a função
  `computedsFor(view, sortKey)` definida no corpo de `tests/browse.test.js` na
  Task 2 — ela devolve `{ self, def }` com os computeds já resolvidos na ordem
  de dependência.
- Produz: computed `emptyMessage`.

- [ ] **Passo 1: escrever o teste que falha**

```js
test('a tela vazia diz qual filtro esta escondendo tudo', function () {
  const filtered = computedsFor('recentes', 'stream:qobuz');
  const message = filtered.def.computed.emptyMessage.call(filtered.self);
  assert.match(message, /Qobuz/, 'o nome do filtro precisa aparecer');
  assert.doesNotMatch(message, /^Nenhum item encontrado nesta categoria\.$/);

  const plain = computedsFor('recentes', 'recent');
  assert.equal(plain.def.computed.emptyMessage.call(plain.self),
    'Nenhum item encontrado nesta categoria.');
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: `Cannot read properties of undefined (reading 'call')` — `emptyMessage`
ainda não existe.

- [ ] **Passo 3: acrescentar o computed**

Em `browse.js`, dentro de `computed`, logo após `hasMediaFilter`:

```js
    /* A mensagem generica era literalmente falsa: dizia que a categoria nao tem
       itens quando o que houve foi um filtro escondendo todos eles. Recentes com
       'stream:qobuz' e o caso real — 425 albuns Qobuz na biblioteca, zero entre
       os 100 mais novos. */
    emptyMessage: function () {
      if (this.hasMediaFilter) {
        return 'Nenhum item corresponde ao filtro ' + this.mediaDescriptor() +
               ' nesta categoria.';
      }
      return 'Nenhum item encontrado nesta categoria.';
    },
```

- [ ] **Passo 4: usar no template**

Substitua as linhas 114-117 por:

```html
      <div v-else-if="!rows.length" class="empty">
        <div class="h">{{ viewLabel }}</div>
        <div class="p">{{ emptyMessage }}</div>
        <button v-if="hasMediaFilter" class="retry-command" @click="clearMediaFilter">Limpar filtro</button>
      </div>
```

- [ ] **Passo 5: rodar e ver passar**

```bash
node --test --test-concurrency=1 tests/browse.test.js && npm run validate
```

Esperado: `# fail 0` e `TUDO PASSA`.

- [ ] **Passo 6: commit**

```bash
git add EchoClassic/HTML/echoclassic/html/js/browse.js tests/browse.test.js
git commit -m "fix(browse): a tela vazia nomeia o filtro em vez de culpar a categoria"
```

---

### Task 5: o rótulo do grupo para de prometer agrupamento (bug C, metade 2)

Em Álbuns, "Artista" **agrupa** — produz linhas de artista. Em Recentes, a mesma
opção só **ordena** álbuns por artista, porque Recentes nunca chama
`loadPagedRoot`. Mesmo rótulo, semânticas diferentes: é a armadilha que faz
"procurei Beatles e vieram álbuns". A ordenação em si é legítima e fica.

**Arquivos:**
- Modificar: `EchoClassic/HTML/echoclassic/html/js/browse.js:35-42` (template), `computed`
- Modificar: `tests/browse.test.js`

**Interfaces:**
- Consome: `computedsFor(view, sortKey)`, definida em `tests/browse.test.js` na
  Task 2.
- Produz: computeds `displayGroupLabel` e `sortSelectLabel`.

- [ ] **Passo 1: escrever o teste que falha**

```js
test('o grupo do menu diz agrupar so onde agrupa de verdade', function () {
  const albuns = computedsFor('albuns', 'name');
  assert.equal(albuns.def.computed.displayGroupLabel.call(albuns.self), 'Agrupar ou ordenar');

  const recentes = computedsFor('recentes', 'recent');
  assert.equal(recentes.def.computed.displayGroupLabel.call(recentes.self), 'Ordenar por');

  const artistas = computedsFor('artistas', 'name');
  assert.equal(artistas.def.computed.displayGroupLabel.call(artistas.self), 'Ordenar por');
  assert.equal(artistas.def.computed.sortSelectLabel.call(artistas.self), 'Ordenar');
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: `Cannot read properties of undefined (reading 'call')`.

- [ ] **Passo 3: acrescentar os computeds**

Em `browse.js`, dentro de `computed`, logo após `primaryOptionValue` (linha 213):

```js
    /* Em Albuns 'Artista' produz linhas de artista; em Recentes a mesma opcao so
       reordena albuns, porque Recentes nao passa por loadPagedRoot. O rotulo
       precisa dizer qual das duas coisas esta acontecendo. */
    displayGroupLabel: function () {
      return this.view === 'albuns' ? 'Agrupar ou ordenar' : 'Ordenar por';
    },
    sortSelectLabel: function () {
      if (this.view === 'albuns') return 'Agrupar, ordenar ou filtrar';
      if (this.view === 'recentes') return 'Ordenar ou filtrar';
      return 'Ordenar';
    },
```

- [ ] **Passo 4: usar no template**

Substitua as linhas 35-36 por:

```html
      <select :value="ui.sortKey" :aria-label="sortSelectLabel" @change="setSort($event.target.value)">
        <optgroup :label="displayGroupLabel">
```

- [ ] **Passo 5: rodar e ver passar**

```bash
node --test --test-concurrency=1 tests/browse.test.js && npm run validate && npm test
```

Esperado: `# fail 0` nas duas suítes e `TUDO PASSA`.

- [ ] **Passo 6: commit**

```bash
git add EchoClassic/HTML/echoclassic/html/js/browse.js tests/browse.test.js
git commit -m "fix(browse): Recentes deixa de prometer agrupamento que nao entrega"
```

---

### Task 6: traduzir os literais novos

Sem estas entradas a skin em inglês mostra as frases novas em português. O
dicionário usa a frase PT como chave (`Plugin.pm:152`).

**Arquivos:**
- Modificar: `EchoClassic/strings.txt`

- [ ] **Passo 1: escrever o teste que falha**

Acrescente a `tests/browse.test.js`:

```js
test('todo literal novo da interface tem entrada em strings.txt', function () {
  const strings = helpers.read('EchoClassic/strings.txt');
  ['Filtro ativo:', 'Limpar filtro', 'Agrupar ou ordenar', 'Ordenar por',
   'Nenhum item corresponde ao filtro'].forEach(function (phrase) {
    assert.ok(strings.indexOf(phrase) >= 0, 'falta traduzir: ' + phrase);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --test --test-concurrency=1 tests/browse.test.js
```

Esperado: `falta traduzir: Filtro ativo:`.

- [ ] **Passo 3: acrescentar as entradas**

Em `EchoClassic/strings.txt`, mantendo a ordem alfabética por chave e a
indentação por TAB (`<TAB>EN<TAB>texto`):

```
ECHOCLASSIC_UI_ACTIVE_FILTER
	EN	Active filter:
	PT	Filtro ativo:

ECHOCLASSIC_UI_CLEAR_FILTER
	EN	Clear filter
	PT	Limpar filtro

ECHOCLASSIC_UI_GROUP_OR_SORT
	EN	Group or sort
	PT	Agrupar ou ordenar

ECHOCLASSIC_UI_SORT_BY
	EN	Sort by
	PT	Ordenar por

ECHOCLASSIC_UI_NO_MATCH_FOR_FILTER
	EN	No item matches the filter
	PT	Nenhum item corresponde ao filtro
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npm test && npm run validate
```

Esperado: `# fail 0` e `TUDO PASSA`.

- [ ] **Passo 5: commit**

```bash
git add EchoClassic/strings.txt tests/browse.test.js
git commit -m "i18n: traduz os textos do filtro ativo e do estado vazio"
```

---

### Task 7: publicar a 3.1.3

**Arquivos:**
- Modificar: `EchoClassic/install.xml:6`, `EchoClassic/Plugin.pm:47`,
  `CHANGELOG.md`, `repo.xml`

- [ ] **Passo 1: subir a versão nos três arquivos que o validador confere**

`EchoClassic/install.xml` linha 6: `<version>3.1.3</version>`
`EchoClassic/Plugin.pm` linha 47: `sub getSkinVersion { return '3.1.3' }`
`repo.xml`: `<plugin name="EchoClassic" version="3.1.3" ...>` e a `<url>` para
`releases/download/v3.1.3/EchoClassic-3.1.3.zip`.

- [ ] **Passo 2: conferir a consistência**

```bash
node tools/check-version.js
```

Esperado: `versao 3.1.3 consistente em install.xml, Plugin.pm e repo.xml`.

- [ ] **Passo 3: escrever o CHANGELOG**

Acrescente acima de `## [3.1.2]`:

```markdown
## [3.1.3] — 2026-08-03

### Corrigido

- **Recentes aparecia vazia com "Nenhum item encontrado nesta categoria".**
  O filtro de mídia é gravado por view e sobrevive a sair e voltar; a única
  evidência de que ele estava ativo era o descritor colado no subtítulo de cada
  linha, que desaparecia junto com as linhas. Agora um aviso permanente nomeia o
  filtro acima da lista, e o estado vazio diz qual filtro está escondendo tudo,
  com um botão para limpá-lo. **[código]** — reproduzido fora da tela contra a
  biblioteca real: das 16 chaves de filtro, 9 esvaziam Recentes; `stream:qobuz`
  rende 425 álbuns em Álbuns e 0 em Recentes.
- **O menu de exibição trocava de view por conta própria.** Escolher um formato
  ou resolução em Artistas saltava para Álbuns sem avisar, e a tela passava a
  mostrar álbuns onde se esperava artistas. Os grupos de mídia agora ficam
  desabilitados nas views que não sabem filtrar. **[código]**
- **"Artista" em Recentes prometia um agrupamento que não existe.** Recentes
  sempre desenha álbuns; a opção apenas reordenava. O grupo do menu agora se
  chama "Ordenar por" fora de Álbuns. **[código]**

### Verificado, sem alteração

- O índice de artistas **não** está falhando: 1388 de 1398 álbuns são atribuídos
  contra a biblioteca real, e os 31 álbuns dos Beatles acertam o índice nos dois
  contribuidores. Os 10 restantes são `P.F.M.`, `V.S.O.P.` e `Various Artists`,
  o comportamento documentado de `abbreviatedArtist`. **[código]**
```

- [ ] **Passo 4: rodar tudo antes de empacotar**

```bash
npm test && npm run validate && node tools/check-version.js
```

Esperado: `# fail 0`, `TUDO PASSA`, versão consistente.

- [ ] **Passo 5: empacotar — `EchoClassic/` na raiz do zip, menos `INSTALL.sh`**

```bash
cd /Users/felipefreitas/Desktop/Claude/LMS/EchoClassic && rm -f dist/EchoClassic-3.1.3.zip && zip -r dist/EchoClassic-3.1.3.zip EchoClassic -x 'EchoClassic/INSTALL.sh' -x '*.DS_Store' && unzip -l dist/EchoClassic-3.1.3.zip | tail -3
```

Esperado: 30 arquivos. **Se não forem 30, pare** — o pacote diverge do 3.1.2 e a
diferença precisa ser explicada antes de publicar.

- [ ] **Passo 6: gravar o SHA-1 no `repo.xml`**

```bash
shasum -a 1 dist/EchoClassic-3.1.3.zip
```

Copie o hash para `<sha>` em `repo.xml`. Um `<sha>` que não bate com o arquivo
publicado é a causa usual de o LMS baixar e recusar o plugin.

- [ ] **Passo 7: commit**

```bash
git add EchoClassic/install.xml EchoClassic/Plugin.pm CHANGELOG.md repo.xml
git commit -m "release: 3.1.3 — filtro visivel e menu honesto em Minha Musica"
```

---

## Riscos

1. **`browse.js` é o arquivo dos dois bugs** e as Tasks 2 a 5 mexem nele em
   sequência. Rodar `npm run validate` ao fim de cada tarefa é o que impede que
   um template quebrado chegue à próxima.
2. **`<optgroup disabled>` desabilita todas as opções filhas** — comportamento
   padrão de HTML, mas quem não conhece pode achar que precisa marcar cada
   `<option>`. Não precisa.
3. **A Task 1 reescreve `validSortForView`.** A regex antiga aceitava
   `format:` com qualquer coisa depois; a nova mantém `[^:]+`, igual à original.
   O segundo teste da Task 1 existe para travar esse comportamento.
4. **Nada aqui foi exercitado na tela.** Os arreios rodam `ui.js` e `browse.js`
   fora do navegador e a lógica foi reexecutada contra a biblioteca real, mas
   nenhum teste de aceitação rodou no `musicplayer`. Depois de instalar, force um
   *hard reload* — o `getAssetRevision` só invalida os assets quando a versão
   muda, e por isso a versão sobe antes de testar.
5. **Instalar em `10.73.254.20`, não localmente.** `tools/install-local.sh` mira
   o LMS da própria MacBook, que tem outra biblioteca.
6. **O chip entra como irmão do `.scroller` dentro de `.pane-left`**, então
   ocupa altura que antes era da lista. `.empty` usa `height:100%`, medido contra
   o scroller e não contra o painel, então o estado vazio continua centralizado —
   mas confira a tela em largura menor que 700px, onde o CSS colapsa o split em
   uma coluna só.

## Verificação final na tela, depois de instalar

1. Minha Música → Recentes → menu → **Qobuz**. Esperado: aviso "Filtro ativo:
   Qobuz" acima da lista e o texto "Nenhum item corresponde ao filtro Qobuz nesta
   categoria.", com o botão Limpar filtro. **Antes desta correção esta tela ficava
   vazia dizendo que a categoria não tem itens.**
2. Clicar em **Limpar filtro**. Esperado: os 100 álbuns mais novos voltam, na
   ordem do servidor.
3. Ir para **Artistas** e abrir o menu. Esperado: Formato, Resolução, Local e
   Serviços de streaming aparecem esmaecidos e não selecionáveis; a tela não
   salta para Álbuns.
4. Voltar a **Recentes** e abrir o menu. Esperado: o grupo se chama "Ordenar por".
5. **Artistas → filtrar "beatles"**. Esperado: duas linhas de artista, "Beatles" e
   "The Beatles" — os dois contribuidores que a biblioteca tem de fato. Se
   aparecerem linhas de álbum, o diagnóstico estava errado e o índice precisa ser
   reaberto.
