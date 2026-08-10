# Echo Classic — remediação final para publicação 3.2.9

Leia o brief do projeto e execute este prompt. O objetivo terminal é deixar a skin
pronta para publicação oficial ainda hoje, sem publicar um artefato diferente
do que foi testado.

## Contexto já apurado — não refaça a auditoria inteira

- Produto: Echo Classic, skin visual + estrutura/fluxo para LMS 9.1.1.
- UI de origem: inglês; tradução disponível: português.
- Breakpoints de aceite: desktop 1512x805 (ou 1440x900), iPad 768x1024 e
  celular 390x844.
- Temas: Light, Dark e Legacy.
- HEAD inicial esperado: `9e8e873` em `main`, árvore limpa.
- O servidor de QA exibiu Echo Classic 3.2.8 e LMS 9.1.1.
- Gates no início desta auditoria: 280 testes passando; `npm run validate` 4/4;
  155/155 pares de contraste; versões 3.2.8 consistentes.
- Auditoria histórica: `docs/echo-classic-interface-audit.md`. Consulte apenas
  EC-005 e EC-007 se precisar da causa antiga; ambos ainda reproduzem.
- Estado resumido: `docs/prompts/state.md`.
- Não releia arquivos maiores que 300 linhas inteiros. Use `rg` e leia somente
  os trechos relevantes.

## Veredito atual

**NÃO PRONTO.** Há um bloqueador de release, dois S2 de acessibilidade e um
fluxo sem rota de retorno. A publicação só passa com zero S1, nenhum S2 de
acessibilidade e retorno em todos os fluxos.

## Evidência fechada da nova auditoria

### PUB-01 — S1 — pacote/descritor não publicável

- `repo.xml` declara literalmente `PRIVATE 3.2.8 QA CANDIDATE: ... Do not
  publish` e usa `private-candidate/EchoClassic-3.2.8.zip`.
- O SHA-1 registrado (`d3493a9a16a342ad625ac9b4eb5cc05126fb8512`) confere
  com `dist/EchoClassic-3.2.8.zip`, mas esse ZIP é anterior ao HEAD.
- Exemplos medidos:
  - CSS atual SHA-256 `885bcd392131974f7f128add3b35d007b60ac0d4ba97efee76e1297aab9b6b63`;
    no ZIP `6dc9b00c46750c5ec932cdb09c5f8f8e1fc6dbcfb5186e3a24da0686b3eaa76c`.
  - `actions.js` atual `fa8e5cd46462d20a619b1d0988e5ce928044869ef14d485bec175dface9a908d`;
    no ZIP `4c15d28bff95a96930da769336092499da779e1e7bbe1b17bac5b64c68e071c9`.
- `CHANGELOG.md` já possui alterações em `Unreleased` posteriores ao candidato.
- Não reutilize 3.2.8. A versão final deve ser **3.2.9**.

### UX-01 — S2 — banner de conexão bloqueia controles

- Em 390x844, `.connection-banner` ficou em `x=12, y=70, 366x47`.
- Os centros de `Filter artists`, `Filters`, `Sort` e `Select` ficaram todos
  atrás do banner; hit-test retornou o texto do alerta.
- Em Player layout, o switch `Show previews` também ficou sob `Try again`.
- O problema persiste após Retry e reload quando não há player.
- Ao abrir o seletor de raiz, o banner cobre a primeira opção, `Recent`.

Correção de aceite: o estado de conexão deve reservar espaço no fluxo da
coluna, ou o conteúdo deve ser deslocado enquanto ele existir. Não esconda o
estado de conexão. Em 390 e 768, nenhum controle pode ter o centro ou mais de
10% da área interceptados pelo banner.

### NAV-01 — S2 — busca perde consulta e não volta aos resultados

- Busca por `Beatles`: 2 artistas e 5 álbuns.
- Abrir `The Beatles` fecha a busca e apaga a consulta.
- `Back to Artists` retorna à raiz Artists; não restaura resultados nem termo.

Correção de aceite: busca precisa de frame de navegação próprio preservando
termo, resultados e scroll. Back contextual e Back do navegador devem retornar
ao resultado anterior sem nova consulta ou redigitação. Recarregar não precisa
preservar resultados de rede, mas não pode criar loop nem pilha cruzada.

### I18N-01 — S2 acessibilidade — comandos portugueses em UI inglesa

- Com English selecionado, `Actions for 10cc` mostrou:
  `Reproduzir agora`, `Reproduzir a seguir`, `Add to end of queue`,
  `Fixar no Echo Classic`.
- Literais estão em `actions.js:34`, `actions.js:35`, `actions.js:54`.
- `ui.js` ainda monta `item adicionado/itens adicionados` em português.
- `node tools/check-source-language.js` passa por falso negativo: a regex não
  reconhece `reproduzir`, `fixar` nem formas `adicionado(s)`.

Correção de aceite: fonte inteira em inglês; traduções em `strings.txt`; toda
expressão dinâmica traduzida explicitamente. O gate deve falhar para esses
exemplos e passar depois da correção. Exercite os comandos em EN e PT, inclusive
nomes acessíveis.

### A11Y-01 — S2 acessibilidade — seletor de raiz sem padrão de popup

- O gatilho não tem `aria-haspopup` nem `aria-expanded`.
- `.picker` não tem `role`; itens não têm `role`/seleção programática.
- Ao abrir, foco fica no gatilho. Tab vai para Search, não para as opções.

Correção de aceite: implemente listbox ou menu conforme ARIA APG. Gatilho com
`aria-haspopup` e `aria-expanded`; popup e opções com papéis/seleção; foco na
opção atual; setas, Home/End e Escape; fechar restaura foco ao gatilho. O popup
não pode obrigar o usuário a atravessar a lista da biblioteca.

### STATE-01 — S2 — estado contraditório ao perder o player

- Foi observado `No player was found on LMS` junto de faixa `Take on Me`,
  progresso e Previous/Play/Stop/Next habilitados.
- Retry não resolveu; reload limpou para `Nothing playing` desabilitado.
- O HEAD contém uma correção parcial em `app.js`, ainda sem aceitação live.

Correção de aceite: transição para zero players deve atualizar conexão, faixa e
ações atomicamente. Se mantiver cache, exiba `last known track`, não mostre
progresso ativo e desabilite comandos sem destino. Teste a transição sem reload.

### ERR-01 — S3 — erro técnico em Apps/Qobuz

- UI mostrou `[network] qobuz items 0 200 menu:qobuz: Failed to fetch`.
- Há Try again e Back to Apps, portanto não é dead end.

Correção de aceite: UI usa `friendlyError` e informa ação humana; comando RPC
fica somente em log. Exemplo aceitável: `Could not reach Qobuz. Check the
connection or service status and try again.`

## Forma de execução obrigatória

1. Faça um plano curto por finding e identifique os arquivos antes de editar.
2. Preserve trabalho alheio. Se a árvore não estiver limpa ou HEAD divergir,
   pare e reporte antes de tocar em arquivos sobrepostos.
3. ES5 apenas em código servido: `var`/`function`; sem arrow, `const`, `let` ou
   template literals fora dos templates Vue existentes.
4. Nunca edite `html/lib/vue.min.js`.
5. Use `apply_patch` para alterações manuais.
6. Cada commit deve ter no máximo três arquivos e resolver uma unidade
   verificável. Separe produção e testes em fatias que respeitem o limite.
7. Não rode todos os gates a cada commit. Rode testes focados durante cada
   correção e a suíte completa uma única vez no ciclo `verify`.
8. Todo commit pousado acrescenta uma linha a `docs/prompts/state.md`, em commit
   separado de documentação se necessário para respeitar o limite de arquivos.
9. Não faça deploy, rollback, push, tag, release ou `gh` sem apresentar o
   comando exato e obter autorização. Não use `127.0.0.1` para sondar o LMS.

## Sugestão de fatiamento

Adapte se o código exigir, mantendo cada commit em até três arquivos.

1. `fix(css): keep connection status out of interactive content`
   - CSS/layout do banner + teste responsivo/hit-test.
2. `fix(actions): keep English as the action source language`
   - `actions.js`, `strings.txt`, teste focado.
3. `fix(ui): translate queue mutation notices`
   - `ui.js`, `strings.txt`, teste focado.
4. `test(i18n): reject Portuguese UI literals`
   - endurecer `check-source-language.js` e criar regressões cobrindo os
     literais encontrados.
5. `fix(nav): make the music root picker keyboard complete`
   - `app.js`, `chrome/navbar.js`, teste estrutural/comportamental.
6. `fix(search): restore search results on back`
   - primeiro caracterize `search.js`, `ui.js`, `nav.js`; escolha uma unidade de
     no máximo três arquivos. Se testes exigirem quarto arquivo, separe refactor
     e teste em commits coerentes, sem deixar main quebrada.
7. `fix(store): reconcile zero-player state atomically`
   - localizar o dono real da transição em `store.js`; não duplicar regra no
     componente. Cobrir cold load e disconnect após faixa conhecida.
8. `fix(opml): present actionable service errors`
   - localizar o call site com `rg "Could not open|Failed to fetch|friendlyError"`.
9. `build(release): reject private or stale release artifacts`
   - adicionar ao release um gate de URL pública e comparação do ZIP com a
     árvore que o gerou. O script deve falhar para o estado atual.

## Verificação local final — uma vez

Execute e registre números exatos:

```sh
npm test
npm run validate
npm run check-version
node tools/check-source-language.js
```

Também rode testes focados que provem:

- banner não intercepta toolbar em 390 e 768;
- picker recebe foco, navega por setas, fecha com Escape e restaura foco;
- busca restaura termo/resultados/scroll por Back;
- EN não contém os literais portugueses encontrados e PT continua traduzido;
- disconnect não deixa transportes ativos sem player;
- erro Qobuz não contém `[network]`, verbos RPC ou paginação.

## Deploy e aceitação live

Somente após gates verdes e autorização para o comando exato:

1. Declare antes a recuperação de silent-death exigida pelo brief do projeto.
2. Execute `tools/deploy.sh -n` e revise o diff.
3. Com autorização separada, execute o deploy real; use `-r` somente se os
   arquivos alterados exigirem restart.
4. Confirme que Settings > About mostra o build pretendido e que o conteúdo
   servido corresponde ao commit/árvore.
5. Faça walkthrough em 1512x805, 768x1024 e 390x844:
   - Light, Dark e Legacy sem overflow horizontal;
   - banner sem obstruir controles;
   - root picker completo por ponteiro e teclado;
   - Search `Beatles` > abrir `The Beatles` > Back restaura resultados;
   - Action sheet inteiramente EN; trocar para PT e confirmar tradução;
   - retirar/reconectar player sem estado contraditório;
   - fila abre/fecha por Escape e devolve foco;
   - Advanced LMS settings e Player layout têm rota de retorno.
6. Com um player conectado, valide playback, fila e player completo nos três
   temas. Com dois players, valide transferência/undo se houver disponibilidade.
7. Não marque `[live]` sem observar.

## Release 3.2.9

Depois de todos os achados fechados e aceitação live:

1. Mova as notas pertinentes de `Unreleased` para `## [3.2.9] — 2026-08-10` e
   registre evidências `[live]`, `[code]` ou `[measured]` corretamente.
2. Garanta árvore limpa e ausência da tag `v3.2.9`.
3. Rode primeiro:

```sh
tools/release.sh 3.2.9 -n
```

4. Revise saída e, então, rode `tools/release.sh 3.2.9` para gerar o pacote.
5. Verifique antes de qualquer publicação:
   - ZIP contém `EchoClassic/` na raiz;
   - ZIP é idêntico à árvore incluída;
   - `repo.xml` usa URL pública
     `https://github.com/fdfreitas88/echoclassic/releases/download/v3.2.9/EchoClassic-3.2.9.zip`;
   - SHA-1 de `repo.xml` é o SHA do ZIP;
   - install.xml, Plugin.pm e repo.xml declaram 3.2.9;
   - não existe `private-candidate` nem `Do not publish` no descritor final.
6. Mostre diff e comandos exatos de commit/tag/push/`gh release create`; obtenha
   autorização antes de executar ações de rede.
7. Após publicar, faça download independente do asset, confira SHA e instale em
   LMS limpo pelo Extensions Manager. Só então dê o veredito `PRONTO`.

## Relatório final esperado

Entregue:

- commits e arquivos por finding;
- resultados medidos dos gates;
- matriz de aceitação live por viewport/tema;
- achados fechados e lacunas restantes com `[live]`, `[code]`, `[measured]` ou
  `[unverified]`;
- URL pública, SHA-1 e prova de instalação somente se a publicação realmente
  tiver sido concluída;
- veredito final `PRONTO`, `PRONTO COM RESSALVAS` ou `NÃO PRONTO`, aplicando:
  zero S1, nenhum S2 de acessibilidade e rota de retorno em todos os fluxos.
