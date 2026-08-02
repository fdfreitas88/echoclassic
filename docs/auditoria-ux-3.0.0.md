# Auditoria de UX — Echo Classic v3.0.0 (skin do LMS)

**Objeto:** `Plugins/EchoClassic` — Lyrion Music Server 9.1.1
**Data:** 02/08/2026
**Objetivo declarado:** deixar a interface pronta para virar skin oficial publicável

---

## Como esta auditoria foi feita, e o que ela não cobre

Duas fontes foram cruzadas. A primeira é o código-fonte completo: 6.400 linhas em 26 arquivos (22 JS, 1 CSS de 1.116 linhas, index.html, skinconfig.yml, mais `Plugin.pm`, `Settings.pm`, `install.xml`, `strings.txt` e `INSTALL.sh`). A segunda é a interface rodando de verdade em `http://<servidor>:9000/echoclassic/`, navegada tela a tela pelo Chrome, com leitura da árvore de acessibilidade e das páginas nativas de configuração do servidor.

Cada achado abaixo traz a marca da sua evidência. **[Verificado ao vivo]** significa que eu vi acontecer na interface. **[Verificado no código]** significa que li a linha citada e o encadeamento é literal, mas não reproduzi o estado na tela. **[Inferência]** e **[Não verificado]** marcam o que é dedução ou o que depende de informação que eu não tenho — e nesses casos digo o que faltaria para confirmar.

Os números de contraste não são estimativa: extraí os pares texto/fundo do CSS e calculei a razão WCAG com script próprio. O anexo traz a tabela completa.

O que **não** foi coberto: nenhum teste com leitor de tela real (VoiceOver/NVDA), nenhum teste em dispositivo móvel físico (o redimensionamento de janela pelo Chrome não surtiu efeito nesta sessão), nenhum teste com biblioteca grande o suficiente para atingir os tetos de paginação, e nenhuma reprodução de áudio foi iniciada — o player estava parado durante toda a inspeção, o que aliás foi decisivo para encontrar o achado B3.

### Placar

| Severidade | Quantidade |
|---|---|
| Bloqueador | 9 |
| Alto | 23 |
| Médio | 31 |
| Baixo | 14 |
| Polimento | 12 |

---

## BLOQUEADORES

Nenhum destes pode ir para publicação. Os quatro primeiros eu vi acontecendo com meus próprios olhos na instalação atual.

### B1 — O LMS oferece "mojo" como uma segunda skin instalável

**[Verificado ao vivo]** Em `Ajustes do servidor › Interface`, o seletor `pref_skin` lista: `Echo Classic, Logic Teal, Light, Default, mojo, Ultralight, Material Skin, Classic`. O item **"mojo"** está lá, em caixa baixa, entre skins de terceiros.

A causa é `HTML/mojo/skinconfig.yml`, que contém `skinparents: [EchoClassic]`. A presença desse arquivo faz o LMS registrar o diretório como uma skin autônoma. O `HTML/mojo/index.html` é só um redirecionador (`location.replace('/echoclassic/' + suffix)`).

O usuário que escolher "mojo" nessa lista está escolhendo uma skin cujo nome não existe em lugar nenhum da documentação, cujo único conteúdo é um redirect com caminho absoluto — que quebra se a skin for servida sob outro prefixo. Publicar assim significa entregar duas skins onde deveria haver uma, e a segunda tem o nome antigo do projeto.

**Correção:** apagar `HTML/mojo/skinconfig.yml`. Se o alias `/mojo` precisa continuar existindo para bookmarks antigos, ele já é atendido pelo `$LEGACY_URL_RE` de `Plugin.pm:20,34` — o diretório de skin é redundante.

### B2 — A página de ajustes do plugin abre em branco

**[Verificado ao vivo]** `Settings.pm:23` declara `page { return 'plugins/EchoClassic/settings/basic.html' }`. Esse arquivo **não existe** na árvore do plugin — não há `HTML/EN/`, não há diretório `settings/`. Abri `http://<servidor>:9000/settings/plugins/EchoClassic/settings/basic.html` e recebi uma página completamente em branco, HTTP 200, sem mensagem de erro.

O plugin aparece na lista de configurações do servidor com o nome "Echo Classic" (confirmado na navegação lateral da página de Server Settings). Quem clicar ali cai numa tela vazia. Pior: as três preferências que `Settings.pm:15-19` declara (`showSpecBadges`, `markHiRes`, `darkTheme`) ficam inalcançáveis — ver M-A11 sobre elas nunca serem lidas pelo skin de qualquer forma.

**Correção:** criar `HTML/EN/plugins/EchoClassic/settings/basic.html` com o template padrão de settings do LMS, ou remover `Settings.pm` e a chamada em `Plugin.pm:41-42` se a intenção é que os ajustes vivam só dentro do skin.

### B3 — A barra inferior morre quando há fila carregada e o player está parado

**[Verificado ao vivo]** Com 12 faixas na fila e "1 h 3 min restantes" no popover, a barra inferior escrevia **"Nada tocando"**, não tinha nenhum controle de transporte, e clicar nela não fazia absolutamente nada.

A causa é `chrome/miniplayer.js:60-61`:

```js
activePlayback: function () {
  return this.hasTrack && this.store.mode !== 'stop';
}
```

Esse único booleano governa três coisas: o texto da barra (`:31`), a existência do transporte (`:8` — `v-if="!ui.full && activePlayback"`) e a possibilidade de abrir o player (`:24-25` `:disabled="!activePlayback"`, reforçado por `:95` `open: function () { if (this.activePlayback) this.$emit('full'); }`). E `app.js:42` (`@full="LmsUi.openPlayer"`) é o **único** chamador de `LmsUi.openPlayer` em todo o skin.

Quando o LMS devolve `mode: 'stop'` mas continua devolvendo a faixa corrente, o skin conclui "nada tocando" e fecha a única porta para o player. O agravante está em `ios9.css:588` — `.mini .np:disabled{opacity:1;cursor:default}` — o botão desabilitado é pixel a pixel idêntico ao habilitado. Nada comunica que ele está morto.

E `nowplaying.js:149-151` usa critério diferente (`hasTrack`, sem olhar `mode`): **o player cheio funcionaria perfeitamente nesse estado — ele é apenas inalcançável.** Os dois componentes discordam sobre o que significa "estar tocando".

**Correção:** separar as três decisões. O botão deve abrir o player sempre que `hasTrack`; o transporte deve aparecer sempre que houver fila (com play em vez de pause); só o texto "Nada tocando" depende de fila vazia.

### B4 — A skin é monolíngue pt-BR e ainda vaza inglês do servidor

**[Verificado ao vivo]** Na aba Favoritos vazia, a tela mostra literalmente a palavra **"Empty"**, em inglês, minúscula, alinhada no canto superior esquerdo, sem ícone e sem ação sugerida. Na aba Rádio, as nove categorias aparecem em inglês (`My Presets`, `Local Radio`, `Music`, `Sports`, `News`, `Talk`, `By Location`, `By Language`, `Podcasts`), e o rodapé tem um campo com placeholder **"Search TuneIn"** ao lado de um botão **"Buscar"** — dois idiomas a oito pixels de distância.

São dois problemas distintos que se somam.

O primeiro é estrutural: **não existe nenhuma camada de i18n**. `strings.txt` cobre apenas três chaves (nome do plugin, descrição e nome da página de settings). Toda a interface — as centenas de strings de `settings.js`, `browse.js`, `playlists.js`, `search.js`, `opmlview.js`, `nav.js`, `ui.js` — está embutida em português no JavaScript, e `index.html:2` fixa `lang="pt-BR"`. Um usuário alemão que instalar esta skin oficial vê uma interface inteiramente em português. Não há ponto único onde um tradutor possa contribuir.

O segundo é de renderização. O "Empty" não é do skin: `opmlview.js:19` renderiza `{{ it.title }}` cru para itens do tipo `text`, e `api.js:537,577` classificam e repassam o texto do servidor sem tradução. **Como o servidor devolve um item de placeholder, `items.length === 1`, e o ramo `v-else` de `opmlview.js:46-49` — que tem a mensagem pt-BR correta, centralizada, com a ação sugerida ("Use 'Adicionar aos Favoritos'…") — nunca executa.** Essa mensagem bem escrita é código morto. O CSS explica exatamente o que eu vi: `.optext` (`ios9.css:305`) é 12,5px cinza no canto superior esquerdo; `.empty` (`ios9.css:489`) é centralizado com título.

**Correção:** (a) extrair as strings para `strings.txt` do LMS e consumir via `[% ... | string %]` ou um mapa injetado no `index.html`; (b) em `opmlview`, tratar uma lista que contém só itens `text` como lista vazia e cair no ramo `v-else`.

### B5 — Zoom desabilitado e tipografia 100% em pixels

**[Verificado no código]** `index.html:5`:

```html
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
```

`user-scalable=no` + `maximum-scale=1` é falha direta de WCAG 1.4.4 (Resize Text). O agravante: o CSS tem **135 declarações `font-size` em px e nenhuma em `rem`/`em`**. Nada no skin responde à preferência de tamanho de fonte do sistema.

O impacto se concentra exatamente onde dói mais: os cinco rótulos da barra de abas estão em 10,5px (`ios9.css:642`, e 10px em telas pequenas na linha 1071), o nome do artista tocando está em 10px (`:597`), o tempo decorrido em 9px (`:599`), os badges técnicos em 8,5px (`:614`) e 8px no mobile (`:1068`). Quem tem baixa visão não consegue nem pinçar para ampliar, nem aumentar a fonte do sistema.

**Correção:** remover `maximum-scale=1,user-scalable=no`. Migrar ao menos a tipografia funcional para `rem`, com piso de 12px para qualquer rótulo que o usuário precise ler.

### B6 — O timeout do RPC não cobre a leitura do corpo, e o polling morre para sempre

**[Verificado no código]** `api.js:20-43`. O `AbortController` é cancelado no `finally` do `fetch` (linha 38), ou seja, **antes** de `await res.json()` (linha 42):

```js
23    var timer = setTimeout(function () { ctl.abort(); }, timeout);
...
37    } finally {
38      clearTimeout(timer);
39    }
40    if (!res.ok) throw new LmsError(cmd, 'http', 'HTTP ' + res.status);
41    var body;
42    try { body = await res.json(); }
```

Se o servidor manda os cabeçalhos e depois estanca o corpo — LMS morto no meio da resposta, proxy segurando a conexão, Wi-Fi caindo depois do header — o `fetch` resolve, o timer já foi limpo, e `res.json()` **nunca assenta**. A promise fica pendente para sempre, sem timeout e sem abort.

O efeito em cascata é o que torna isto bloqueador. `store.js:329-336`, `tick()` faz `refresh().then(...)` sem `.catch`; o `.then` nunca roda, então nenhum novo `setTimeout` é agendado, e `timer` continua não-nulo. `store.js:338-341`, `startPolling()` tem `if (timer !== null || document.hidden) return;` — ele **se recusa a religar**. O polling fica morto pelo resto da sessão, inclusive depois de clicar em "Tentar novamente", porque `reconnect()` também termina em `startPolling()`.

Do lado da tela: `browse.js:105-110` deixa `loading` em `true` eternamente, e o botão "Tentar novamente" está no ramo `v-else-if="error"`, inalcançável enquanto `loading` for verdadeiro. Mesmo padrão em `actions.js:215` e `opmlview.js:12`. O gauge trava, o tempo decorrido para, os badges congelam — tudo ao mesmo tempo, sem banner de erro, porque `store.connected` também deixa de ser atualizado.

**Correção:** um único `try/finally` envolvendo fetch **e** parse, com `clearTimeout` depois do `res.json()`; tratar `AbortError` no parse como `kind:'timeout'`; e dar `.catch()` ao `tick()` para que o reagendamento nunca dependa do caminho feliz.

### B7 — "Tentar novamente" da busca nunca sai da tela de erro

**[Verificado no código]** `search.js:14` — `<button class="retry-command" @click="run">Tentar novamente</button>`. Mas `run()` (`search.js:128-137`) escreve `this.results` e `this.error`, e **nunca zera `this.error`**. O único ponto que faz `this.error = ''` é `schedule()`, na linha 117.

O template testa `v-else-if="error"` (linha 11) **antes** de `!total` (16) e antes dos resultados (20).

Cenário: o Wi-Fi cai por dois segundos durante a busca por "miles". Aparece "Não deu para buscar". O usuário toca "Tentar novamente"; a requisição agora funciona e `results` é preenchido — mas `error` continua truthy, então a tela de erro permanece para sempre. A única saída é digitar ou apagar um caractere, o que dispara `schedule` e zera o erro. É um botão de retry que não retorna.

**Correção:** `this.error = '';` como primeira linha de `run()`.

### B8 — "Recentes" não mostra o que é recente

**[Verificado ao vivo]** A raiz "Recentes" mostrava, nesta ordem: Bach (Aapo Hakkinen), Fasch (Accademia Daniel), Acqua Fragile, Mass-Media Stars (Acqua Fragile), Alas (Alas). É ordem alfabética **por artista** — Aapo, Accademia, Acqua, Acqua, Alas — não ordem de inclusão.

`browse.js:694` pede ao servidor `LmsApi.albums(pid, 0, 250, { sort: 'new' })`, ou seja, o servidor devolve por data de inclusão. Mas `displayRows` (`browse.js:232-248`) aplica `rows.sort()` **sempre**, sobre qualquer chave, sem nenhum caso especial para "ordem nativa do servidor". E o menu de exibição em Recentes (`browse.js:36-39`) só oferece Álbum, Artista e Ano — **não existe opção "mais recentes"**. O padrão de `ui.js:95` é `recentes: 'name'`.

O resultado é que a raiz cujo nome é "Recentes" nunca, em nenhuma configuração, mostra os itens em ordem de recência. Os 250 álbuns mais novos são embaralhados alfabeticamente e misturados. O usuário não tem como ver o que entrou na biblioteca por último — que é a única razão de essa raiz existir.

**Correção:** adicionar a chave `recent` como padrão de `recentes` e pular o `rows.sort()` quando ela estiver ativa (`if (key !== 'recent') rows.sort(...)`), oferecendo-a como primeira opção do menu.

### B9 — Importar preferências grava qualquer coisa e pode inutilizar a skin permanentemente

**[Verificado no código]** `settings.js:328-338`. Só o envelope é validado (`data.version !== 1` na linha 317); o conteúdo de cada chave é gravado cru no `localStorage`:

```js
331   var match = key.match(/^(?:echoclassic|mojo)\.(ui|pins|nav|session|history)\.(.+)$/);
333   localStorage.setItem('echoclassic.' + match[1] + '.' + match[2],
334     String(this.pendingImport.values[key]));
337   location.reload();
```

Do outro lado, os leitores validam sintaxe mas não forma. `ui.js:91-92` faz `savedPins = JSON.parse(...) || []` e `ui.js:163` atribui direto a `state.pins`, que depois recebe `.some(...)` em `ui.js:418` e `.concat(...)` em `ui.js:427`. `nav.js:11-12` faz `musica: saved.musica || []`, que depois recebe `.push(frame)` em `nav.js:39`.

Cenário: o arquivo exportado se corrompe de forma ainda sintaticamente válida e `echoclassic.pins.v1` vira `{"a":1}`. A importação aceita, recarrega, `state.pins` vira um objeto, e o primeiro "Fixar" dispara `TypeError: state.pins.some is not a function`. Com `echoclassic.nav.v1` = `{"musica":"x"}`, o primeiro clique num artista dispara `stacks.musica.push is not a function`. **O erro persiste a cada recarga.** A única saída é o DevTools — o usuário comum fica com a skin inutilizada e sem caminho de recuperação dentro da própria interface.

**Correção:** validar forma na importação (`Array.isArray` para pins, arrays de objetos com `label` para nav, objeto plano para ui) e, defensivamente, validar de novo na leitura.

---

## ALTO

### Navegação e dead ends

**A1 — O botão Voltar do navegador leva para dentro, não para fora.** `nav.js:41` empilha uma entrada de histórico a cada drill (`history.pushState`), mas `nav.js:77-80` desempilha com `replaceState` — as entradas antigas continuam existindo com os frames antigos. **[Verificado no código]** Cenário: Artistas → Radiohead → OK Computer, depois dois toques no ‹ Voltar da navbar (a tela volta à raiz). Agora o Voltar do navegador carrega a entrada antiga, `nav.js:96-99` restaura `frames:[Radiohead]` e o app **entra de novo no artista**. São mais dois toques para sair da página.

**A2 — A pilha de navegação é zerada em toda entrada; a profundidade real do app é 2.** `browse.js:405-406`, `detail.js:112-113`, `albumblock.js:210-211` e `albumblock.js:216-226` fazem `LmsNav.reset(...)` antes de cada `push`. **[Verificado no código]** Cenário: em Artistas → Miles Davis → Kind of Blue, clicar no artista relacionado "Bill Evans" apaga a trilha inteira, troca a raiz da esquerda de Artistas para Álbuns **sem avisar**, muda a ordenação para "Artista relacionado", e deixa a pilha com profundidade 1. Não existe mais nenhum caminho de volta a Kind of Blue nem a Miles Davis, e a raiz que o usuário escolheu foi trocada por baixo dele.

**A3 — Em profundidade 1, o botão Voltar tem o mesmo rótulo do título da tela.** **[Verificado ao vivo]** Vi exatamente isto: navbar com "‹ Recentes" à esquerda e "Recentes ⌄" no centro. `app.js:84-85` usa `LmsUi.viewLabel()` como título e `app.js:89-91` usa `LmsNav.parentLabel(...)`, que em profundidade 1 devolve o mesmo `rootLabel` (`nav.js:87`). No desktop a lista de origem continua visível ao lado, o que torna o botão duplamente confuso: ele aponta para onde o usuário parece já estar.

**A4 — Item OPML sem ação renderiza como clicável e não faz nada.** `api.js:537-538` retorna `'menu'` como **default** para qualquer item que não seja audio/search/text, inclusive itens sem `actions.go`; `api.js:541-543` devolve `node: null`; `opmlview.js:85-91` sai em silêncio; e `opmlview.js:31-33,42` desenha `role="button"`, `tabindex="0"` e o chevron sem checar `it.node`. **[Verificado no código]** Um cabeçalho de seção devolvido por um plugin de rádio ganha seta, ganha foco de teclado, anuncia-se como botão — e clicar não produz nada: sem mensagem, sem spinner, sem erro.

**A5 — O mesmo item do carrossel de histórico às vezes navega e às vezes abre um menu.** `browse.js:456-470`: se `h.albumId != null`, navega; senão, abre a folha de ações. Os dois casos usam o mesmo botão visual (`browse.js:95-101`) e o mesmo `aria-label`. **[Verificado no código]**

### Erros e estados

**A6 — Erro numa operação secundária destrói a tela inteira.** O mesmo padrão aparece em quatro lugares, e em todos `this.error` é o ramo `v-else-if` que substitui tudo:
- `detail.js:161-163` — a chamada `artistOfAlbum` falha por timeout e o **bloco do álbum inteiro**, com as faixas já carregadas, some.
- `opmlview.js:103-106` — erro de **validação de campo** ("Informe um endereço completo, começando por http://") derruba a lista de rádios e o próprio campo; "Tentar novamente" chama `load()`, que **descarta o texto digitado**.
- `opmlview.js:92-99` — falha ao tocar **uma** estação apaga as 40 estações da lista.
- `playlists.js:142-144` — falha ao **reordenar** uma faixa substitui a playlist inteira por "Não deu para ler as playlists", mensagem que nem descreve o que falhou.

**[Verificado no código]**

**A7 — Resultado parcial é descartado: um erro na página 8 apaga as 7 já exibidas.** `browse.js:662-663` já põe `loading = false` na primeira página; qualquer falha posterior (`browse.js:717-720`) cai no ramo de erro, que troca a lista inteira. "Tentar novamente" chama `reload(true)`, que zera `this.rows` e recomeça do zero. **[Verificado no código]**

**A8 — Mensagens técnicas cruas do protocolo chegam ao usuário.** `api.js:12` monta `'[' + kind + '] ' + cmd.join(' ') + ': ' + detail`, e `browse.js:719`, `detail.js:11-12` e `albumblock.js:81` atribuem isso direto a `this.error`. `store.js:213-218` tem `friendlyError()` exatamente para isso, mas só cobre `timeout` e `network` — `http`, `lms` e `parse` caem no `message`. **[Verificado no código]** O usuário lê: **"Não deu para ler a biblioteca"** seguido de **`[network] albums 0 500 tags:jaSlytW2 sort:album: Failed to fetch`**.

**A9 — Perda silenciosa de dados na paginação.** Tetos fixos sem nenhum indicador: 10.000 itens no loop (`browse.js:503,630`), 250 em Recentes (`:694`), 2.000 em Gêneros (`:707`), 500 em Anos (`:712`), 1.000 em detalhe (`detail.js:190`), 500 faixas por álbum (`albumblock.js:266`), 200 em listas OPML (`opmlview.js:110,123`), 500 na fila (`store.js:360`). **[Verificado no código]** Numa biblioteca de 12.000 álbuns o loop para em 10.000, o `loadingMore` some como se tudo tivesse carregado, e os 2.000 restantes são invisíveis. Em "By Location › United States" no TuneIn, a lista termina abruptamente na estação 200, sem botão e sem contador.

**A10 — Álbuns sem artista no índice desaparecem da biblioteca.** `browse.js:645-651` faz `if (!artist) return null;` quando o agrupamento é por artista, e `api.js:182` já descartou contribuidores de nome vazio. **[Verificado no código]** Uma coletânea com campo de artista em branco existe em "Álbuns → Álbum" e **não existe** em "Álbuns → Artista". Nada sinaliza que a lista está incompleta.

### Estado e sincronia

**A11 — `refresh()` não amarra a resposta ao player que a pediu.** `store.js:164,172-186` escreve `np`, `mode`, `time`, `volume` e `connected` sem verificar `state.playerId` depois do `await`. Que o padrão correto é conhecido está provado três funções acima: `store.js:103` faz `if (state.playerId !== playerId) return false;`. **[Verificado no código]** Trocar de player durante uma requisição lenta faz a resposta do player A ser exibida rotulada como player B — e `saveSession()` grava esse estado misturado.

**A12 — `queueUndo` nunca é limpo ao trocar de player.** `store.js:466-476` (`selectPlayer`) não toca em `state.queueUndo`, e `queue.js:19` mantém o botão visível. **[Verificado no código]** Limpar a fila do player da sala, assumir o player do quarto e clicar "Desfazer" injeta as 40 faixas da sala na fila do quarto, por cima do que estiver tocando.

**A13 — `volumeDragging` fica preso e o volume nunca mais sincroniza.** `nowplaying.js:267` liga a flag no `pointerdown`; só `pointercancel` e `change` a desligam; `beforeDestroy` (`:302-307`) não a reseta. E `store.js:179` bloqueia toda sincronização enquanto ela estiver ligada. **[Verificado no código]** Encostar no slider e fechar o player sem soltar sobre o controle congela o volume exibido pelo resto da sessão.

**A14 — Seek fica preso para sempre se o arraste não terminar em `change`.** `nowplaying.js:57` declara só `@input` e `@change` — **sem `@pointercancel`**, enquanto o controle de volume dez linhas abaixo (`:92-93`) faz certo. **[Verificado no código]** Um `pointercancel` no toque (scroll interpretado, notificação do sistema, chamada) congela `dragTime`, e como `pct`, `elapsed` e `remaining` derivam dele, **o gauge trava e o tempo para de andar** mesmo com a música tocando, inclusive ao trocar de faixa.

**A15 — `lms-detail` não tem token de requisição.** `detail.js:70-72,140-204` — o componente é reutilizado entre frames sem `:key` (`browse.js:168`), e não há o `requestToken` que `browse.js:674` e `search.js:129` usam. **[Verificado no código]** Clicar em "Jazz" (lento) e logo em "Bossa Nova" (rápido) faz a grade mostrar Bossa Nova e, três segundos depois, ser sobrescrita pelos álbuns de Jazz — com o cabeçalho ainda dizendo Bossa Nova.

**A16 — `ensureRecentSelection` estoura com filtro ativo.** `browse.js:420-428`: a guarda testa `this.rows.length`, mas o índice é lido de `this.displayRows` (já filtrado). `selectWithoutDrill` acessa `r.kind` sem checar nulo. **[Verificado no código]** Em Recentes, janela > 700px, com um filtro que não casa com nada, redimensionar a janela dispara `Cannot read properties of undefined (reading 'kind')`.

### Ações destrutivas

**A17 — "Limpar próximas" e "Limpar tudo" colados, idênticos, sem confirmação.** **[Verificado ao vivo]** Vi os dois no cabeçalho do popover, lado a lado, ambos em azul, com rótulos que diferem em duas palavras. `queue.js:20-22` dá a ambos a classe `.clear`, e `ios9.css:901-903` dá a ambos `color:var(--accent)` e `.clear+.clear{margin-left:0}` — **sem separação**. `queue.js:112,114` disparam direto, sem diálogo. O "Desfazer" existe mas é lossy: `store.js:446-447` faz `if (entry.item.id == null) continue;`, ou seja, descarta streams de rádio em silêncio, e não restaura a posição de reprodução.

**A18 — Remover músicas da playlist não pede confirmação, enquanto apagar a playlist pede.** `playlists.js:208-218` (`removeSelected`) chama `editPlaylist(..., 'delete', ...)` num laço, sem confirmação e sem snapshot para desfazer. Compare com `playlists.js:93-102`, que tem um `confirm-stage` completo para apagar a playlist. **[Verificado no código]** O skin ensina que ação destrutiva pede confirmação, e então não pede na mais fácil de acionar por acidente — o botão "Remover 47" que aparece do nada ao lado de "Concluído".

**A19 — Seleção por índice não é invalidada ao reordenar: "Remover" apaga a faixa errada.** `playlists.js:175-177` usa a posição como chave (`var key = String(t.index);`), e `move()` (`:199-207`) nunca limpa `this.selected`. **[Verificado no código]** Marcar a faixa da posição 5, mover outra faixa para a posição 4, e clicar "Remover 1" apaga permanentemente uma faixa diferente da marcada — sem confirmação (A18).

**A20 — Trocar o modo de volume manda 100% para o DAC sem aviso.** `nowplaying.js:282` → `store.js:573` `if (requestedFixed) await api.setVolume(playerId, 100);`. O controle é um `role="switch"` de largura total (`ios9.css:712`) logo abaixo do slider de volume, e nem o rótulo ("Saída fixa (sem atenuação)") nem o detalhe ("Ajuste o volume no DAC") avisam que acioná-lo dispara volume 100 imediatamente. **[Verificado no código]** É a ação mais perigosa do skin e a que tem menos atrito.

**A21 — "Restaurar" não faz o que o diálogo promete, e não tem volta.** `settings.js:198-199` diz "A aparência e a navegação atuais serão substituídas", mas `confirmImport` (`:328-338`) itera **apenas** sobre as chaves presentes no arquivo: não remove chaves ausentes, não faz backup, e chama `location.reload()` imediatamente. **[Verificado no código]** Restaurar um arquivo antigo que só tinha pins traz os pins de volta e **deixa a aparência atual intacta** — o oposto do prometido. E o `pendingImportCount` conta chaves de localStorage (no máximo 5), não preferências.

**A22 — Arquivo inválido trava o `<input type="file">`.** `settings.js:310-327`: a limpeza `event.target.value = ''` está **depois** do `throw`, então no `catch` ela não acontece. **[Verificado no código]** Escolher um arquivo errado, corrigi-lo no disco com o mesmo nome e escolhê-lo de novo não dispara o evento `change`. Beco sem saída: só renomeando o arquivo ou recarregando a página.

### Acessibilidade

**A23 — Foco de teclado ausente ou inutilizável em pontos centrais.** **[Verificado no código, contraste calculado]**
- `ios9.css:176` — `.searchwrap input{...outline:0}` e nenhuma regra `:focus-visible` cobre esse seletor. O campo de busca principal não tem indicador de foco.
- `ios9.css:527` — `.playlist-name-input{...outline:0}`, idem.
- `ios9.css:233-234` — `.more-command:focus-visible{...outline:0}` tem a mesma especificidade que `.pointer:focus-visible` (`:136`) e vem **depois**, então o `outline:0` vence: o botão "…" de toda linha de lista fica sem anel. O substituto é `background:var(--field)`, que dá **1,27:1** sobre branco.
- `ios9.css:196-199` — o divisor arrastável tem o mesmo defeito, e 14px de largura (reprova WCAG 2.2 2.5.8, que pede 24px).
- **Escape não fecha a busca** — **[Verificado ao vivo]**: apertei Escape com a busca aberta e nada aconteceu. `navbar.js:19` não tem `@keyup.esc`, e uma varredura de `addEventListener` em todos os arquivos mostra **zero** handlers de `keydown`/`keyup` em `document`/`window`. A folha de ações faz certo (`actions.js:24`), o que prova que a omissão é inconsistente, não uma decisão.

---

## MÉDIO

### Contraste (todos calculados, não estimados)

**M1 — O esquema de cores padrão reprova na chrome.** `--accent:#007DB8` sobre `--chrome:#F6F6F6` = **4,20:1**, abaixo dos 4,5:1. Afeta o rótulo da aba ativa (10,5px, `ios9.css:644`), o título da navbar (17px, `:156`) e o botão Voltar (`:160`). Os outros quatro esquemas passam (teal 4,54; carmim 5,30; índigo 6,19; âmbar 5,29) — é justamente o padrão que reprova.

**M2 — Chevrons, alças e estrelas quase invisíveis.** `--chev` = **1,68:1** no claro (`#C7C7CC` sobre branco) e **2,84:1** no escuro. Afeta a seta de "entrar" na linha (`:227`), o marcador de seleção (`:236`), a alça de reordenar da fila (`:920`), a barra de rolagem custom (`:102`) e — pior — as **estrelas de avaliação não preenchidas** (`:1043`, 21px, exige 4,5:1).

**M3 — Placeholder de capa ilegível.** `--art-placeholder` = **1,59:1** no claro e **2,87:1** no escuro (`ios9.css:340,399,591`). Quando não há capa, a inicial do álbum some — o usuário perde a única pista de identidade do item.

**M4 — Interruptores de Ajustes praticamente invisíveis quando desligados.** `--sw-off` sobre `--group-bg` = **1,26:1** no claro. O `--sw-on` verde também reprova (**1,84:1**). Mínimo para componente de UI é 3:1 (WCAG 1.4.11).

**M5 — Divisores de lista somem no tema escuro.** `--hair:#303034` sobre `--content:#000000` = **1,60:1**. **[Verificado ao vivo]** No tema escuro a lista de playlists virou um bloco praticamente contínuo. No claro também reprova (1,68:1).

**M6 — Índice alfabético A–Z: alvo minúsculo e letras inativas invisíveis.** `ios9.css:326-331` — 22px de largura por ~12,8px de altura (reprova WCAG 2.2 2.5.8 e o padrão iOS de 44px), com `--raildim` a **1,98:1** no claro. **[Verificado ao vivo]** Na tela de Minha Música o índice aparece espremido entre a lista e o painel de detalhe, com as letras sem conteúdo praticamente invisíveis.

**M7 — Vermelho destrutivo reprova no tema escuro.** `#D70015` hard-coded (`ios9.css:520,1020`, fora do sistema de variáveis) dá **3,53:1** sobre `--group-bg` escuro. É a cor da ação irreversível.

**M8 — Gauge de progresso não se distingue do trilho.** Azul `#007DB8` contra o stop `#CBD1D6` do `--gauge-track` = **2,95:1**; no modo flat claro cai para **2,91:1**, com a borda do gauge a **1,61:1**. É o único indicador de progresso do mini player.

**M9 — Texto branco sobre o topo do gradiente de seleção.** O stop 0% reprova em cinco combinações tema×esquema: carmim claro **3,91:1**, índigo claro **3,90:1**, âmbar claro **3,42:1**, teal escuro **4,07:1**, âmbar escuro **4,01:1** (`ios9.css:212,361` e stops em `:56-74`). O subtítulo de 12px sofre mais.

**M10 — Outros pares abaixo do mínimo.** `--text2` sobre `--field` (placeholder da busca) = **4,05:1**; `--group-head` sobre `--group-page` (cabeçalho de grupo dos Ajustes) = **4,49:1** — reprovação marginal, mas reprovação.

### Formatação e números

**M11 — `longDuration` produz "60 min" e "1 h 60 min".** `format.js:29` faz `Math.round((s % 3600) / 60)` sem tratar o arredondamento para 60. Com 3.590s → **"60 min"**; com 7.170s → **"1 h 60 min"**; com 20s → **"0 min restantes"** com uma faixa ainda tocando. **[Verificado no código]**

**M12 — `duration` nunca mostra horas.** `format.js:20-22` não divide por 3600. Um audiolivro de 1h15 aparece como **`75:00`** no player, na fila e no mini player — este último numa caixa de 29px (`ios9.css:600`) que não comporta o texto. **[Verificado no código]**

**M13 — O tempo restante da fila é sistematicamente inflado.** `store.js:606-609` soma a duração **integral** da faixa corrente, ignorando o que já tocou. O próprio autor sabe disso: `store.js:518` compensa com `queueRemaining() - state.time` para o sleep timer, mas `queue.js:63-64` não compensa. **[Verificado no código]** Além disso, `slice(state.queueIndex)` fatia por posição no array, não por `t.index`, e `loadQueue` só busca 0..500 — numa fila de 800 com a atual em 600, o resultado é vazio e o cabeçalho diz "ao vivo".

**M14 — "ao vivo" como fallback de soma zero.** `queue.js:63-65` — uma fila só de podcasts sem duração conhecida vira **"ao vivo"** em caixa baixa, enquanto o mesmo conceito aparece como **"AO VIVO"** em `nowplaying.js:62` e `miniplayer.js:38`. E o rótulo é factualmente errado. **[Verificado no código]**

**M15 — Qualquer faixa com duração desconhecida vira "AO VIVO".** `api.js:414` — `live: duration === 0`. Um FLAC local cuja duração o LMS não varreu aparece como AO VIVO, com a barra de progresso desabilitada e o seek bloqueado (`store.js:543`), sem forma de contornar. **[Verificado no código]**

**M16 — "24 bit" e "1 reproduções".** `format.js:45` devolve `ss + ' bit'` — em pt-BR é "bits". `nowplaying.js:134` escreve `{{ ... }} reproduções` sem tratar o singular, enquanto a linha imediatamente acima (`:133`) faz a pluralização certa para estrelas. **[Verificado no código]**

**M17 — Badge hi-res destaca a etiqueta errada.** `nowplaying.js:192-197` e `miniplayer.js:82-87` calculam um único `hi` e aplicam a **ambos** os badges. Um CD rip de 44,1 kHz / 24 bits acende também a etiqueta "44,1 kHz", sugerindo taxa hi-res. **[Verificado no código]**

**M18 — Unidades inconsistentes na mesma tela.** **[Verificado ao vivo]** No detalhe do álbum, o cabeçalho diz "96 kHz • 24 bit" e as faixas logo abaixo dizem "96k". Duas grafias da mesma informação a poucos pixels de distância.

### Feedback e affordance

**M19 — Botões que não fazem nada e não dizem nada.** Playlist vazia com "Tocar" e "Aleatório" ativos (`playlists.js:23-24,219-224`); "Criar" com nome vazio (`playlists.js:78,150-152`); ↑ e ↓ inertes nos extremos da fila, azuis e sem `:disabled` (`queue.js:40-44,106-109`); `queueSelection` que retorna `false` sem notificar (`ui.js:399-414`, descartado por `browse.js:447`). **[Verificado no código]**

**M20 — O popover da fila não tem botão de fechar.** **[Verificado ao vivo]** Procurei e não achei. `queue.js:16-23` não tem nenhum. As duas saídas são o `.queueback` (`ios9.css:892`, `position:fixed;inset:0` **sem `background`** — um captador de cliques 100% invisível, sem escurecimento que sinalize "clique fora para fechar") e a tecla Esc, inútil no toque. `nowplaying.js:17-20` tem um `.dismiss` explícito — a inconsistência é dentro do próprio skin.

**M21 — A hierarquia visual da fila está invertida.** **[Verificado ao vivo]** Os botões ↑ e ↓ são azuis (`ios9.css:917`, `--accent`) e o ✕ — **a ação destrutiva** — é desenhado com `--chev` (`:920`), a variável do chevron de navegação, a **1,7:1**. Reordenar parece primário; remover parece desabilitado.

**M22 — A faixa atual da fila é marcada só por cor, e o índice cai em zero.** `queue.js:31` usa `:class="{now: ...}"`, e `ios9.css:914` aplica só `color:var(--accent)` — sem ícone, sem texto, sem `aria-current`. Pior: `api.js:49` faz `num(v)` devolver **0** para `undefined`, então com o player parado a primeira linha é marcada como atual mesmo quando não há faixa corrente. **[Verificado ao vivo]** — vi a primeira faixa em azul com o player parado.

**M23 — Ajustes mostra "Volume 100%" como texto morto.** **[Verificado ao vivo]** `settings.js:44-46` renderiza um `<span>`. `store.js:551,562` (`setVolume`, `setFixedVolume`) existem e são usados em `nowplaying.js` — `settings.js` nunca os chama. O usuário tenta arrastar e descobre sozinho que o controle está no player cheio. E o estado "não confirmado" é jargão que não diz o que fazer.

**M24 — Slider de crossfade sem feedback durante o arrasto.** `settings.js:60-64` usa `@change` (só dispara ao soltar) e o número ao lado lê `store.transitionDuration`, atualizado só depois do round-trip. Ajuste por tentativa e erro. **[Verificado no código]**

**M25 — Player desconectado é um beco sem saída.** `settings.js:33,36` — a linha diz "indisponível" e o `v-else-if="p.connected"` esconde os três botões. Nenhuma dica de por que está indisponível nem de como religar. **[Verificado no código]**

**M26 — A busca inteira pisca a cada tecla.** `search.js:10` põe o ramo `loading` **antes** dos resultados, e `schedule()` (`:124`) liga `loading` antes dos 250ms de debounce. **[Verificado ao vivo]** — digitando "bach" a tela alternou entre "Buscando…" e resultados. No "Mostrar mais" (`:138-142`) é pior: os 50 resultados já rolados somem, a tela vira "Buscando…", e ao voltar o usuário está no topo.

**M27 — Trocar de aba com a busca aberta apaga a consulta.** `ui.js:220` chama `closeSearch()`, que faz `state.query = ''` (`:346-350`). A tabbar continua visível durante a busca (`app.js:43`). **[Verificado no código]**

**M28 — Um único `<select>` mistura ordenação e cinco famílias de filtro, e escolher um filtro troca a raiz.** `browse.js:34-56,434-442` — filtro e ordenação compartilham `sortKey`, então são mutuamente exclusivos. **[Verificado ao vivo]** Vi o select com os grupos Exibição / Formato / Bit Rate / Local / Streaming. Escolher "FLAC" estando em Gêneros pula a lista para Álbuns e zera a pilha; depois, escolher "Ano" descarta o filtro FLAC em silêncio.

**M29 — Uma seleção, duas interfaces divergentes, três nomes para a mesma ação.** `browse.js:62-73` mostra um "3" solto e um botão "Concluído"; `actions.js:313-316` mostra simultaneamente "3 selecionados" e "Cancelar". As duas chamam `clearSelection`. A ação de enfileirar se chama "Adicionar à fila" ali, "Adicionar ao final da fila" na folha de ações (`actions.js:31`) e "N itens adicionados à fila de reprodução" na notificação (`ui.js:411-413`). **[Verificado no código]**

**M30 — Nome do artista às vezes é botão, às vezes texto morto, na mesma posição.** `albumblock.js:30-31` — a prop `artist` só chega **depois** do `await artistOfAlbum` (`detail.js:163`). **[Verificado no código]** Clicar no nome logo que o álbum abre não faz nada; um segundo depois o mesmo texto vira botão. Se `artistOfAlbum` devolver `null`, nunca vira.

**M31 — Dois grupos diferentes chamados "Player completo".** **[Verificado ao vivo]** `settings.js:149` (dentro de "Gauges de reprodução", opções Flat/Clássico) e `settings.js:166` (grupo próprio, opções Adaptável/Tela cheia). Dois controles distintos com rótulo idêntico na mesma tela. Some-se a isto que o estilo de gauge é **por tema** (`ui.js:234-240,256-262`) sem que nada na interface diga isso: escolher "Clássico" no tema claro e depois trocar de tema faz o controle voltar sozinho para "Flat".

---

## BAIXO

**X1 — Marca pessoal embutida.** **[Verificado ao vivo]** `chrome/statusbar.js:7` — `<b class="brand">Echo Classic by Felipe</b>`, visível em todas as telas. Numa skin publicada, a autoria pertence ao `install.xml` e ao README, não à barra de status.

**X2 — "LMS Server" em inglês na barra de status.** `statusbar.js:9`. Quando `LMS_VERSION` falta, lê-se "LMS Server —" (`:16`).

**X3 — Optgroups em inglês no menu de exibição.** **[Verificado ao vivo]** `browse.js:44` `<optgroup label="Bit Rate">` (e o grupo contém "Hi-Res"/"Resolução padrão", que são *resolução*, não bit rate) e `browse.js:52` `<optgroup label="Streaming">`. Dois dos cinco grupos em inglês.

**X4 — "Flat" em inglês ao lado de "Clássico".** `ui.js:50-51` — duas opções do mesmo segmented control, uma em cada idioma. E `settings.js:129,134,149` usam "gauge", anglicismo que também vai para o leitor de tela via `aria-label`.

**X5 — "Restaurar" é rótulo errado para "Importar".** `settings.js:190-191`. O par simétrico de "Exportar" é "Importar"; "Restaurar" é o verbo consagrado para voltar aos padrões de fábrica. Quem quiser resetar vai clicar ali e receber um seletor de arquivos.

**X6 — "Conexão: sem player" mistura dois eixos.** `settings.js:43` — se o servidor caiu, a linha manda o usuário procurar um player.

**X7 — `stepRail` fica preso nos extremos.** `browse.js:389-396` — as condições `next > 0` e `next < length - 1` excluem 'A' e '#' da varredura, e `jump` não faz nada quando a letra não existe. Numa biblioteca sem artistas com 'A', apertar ↑ em 'B' não produz efeito nenhum e o `aria-valuetext` não muda.

**X8 — Inverter a ordem não reposiciona a rolagem.** `browse.js:266-282` tem watcher para `ui.filter` mas nenhum para `ui.sortDesc`. Rolar até "M" e clicar em ↓ salta para uma região aleatória do alfabeto, com o indicador do índice ainda marcando "M".

**X9 — `mediaIndex` cacheado para sempre.** `browse.js:559-561` — depois de um scan no LMS, os álbuns novos não aparecem no filtro por formato até trocar de aba.

**X10 — Cache de músicas sem limite.** `api.js:353,388` — `songCache` cresce uma entrada por faixa tocada, indefinidamente; `forgetSongInfo` só é chamado por `setRating`. O `playCount` exibido fica congelado no valor da primeira leitura.

**X11 — Miniaturas baixam a capa em resolução cheia.** `format.js:69-72` só tem caminho otimizado para `size === 50`. O carrossel pede 80 (`browse.js:475`) e o player cheio pede 600 (`nowplaying.js:189`) — todos recebem a original. Pior: `store.js:269-272` declara três `artwork` com `sizes` diferentes apontando para a **mesma** URL, dando metadados falsos ao Media Session do sistema.

**X12 — `detail.js` carrega discografia que descarta.** `detail.js:66-68,168-180` — no modo "Álbuns" (o padrão) busca até 200 álbuns por id canônico e joga fora com `slice(0, 1)`.

**X13 — Heurística frágil decide o comportamento do campo OPML.** `opmlview.js:71-73` testa `/\burl\b/i` no **título** do item. "Search by URL or keyword" passa a exigir `http://` e rejeita busca por palavra-chave; um servidor em português com "Sintonizar endereço" não casa e aceita qualquer texto.

**X14 — Alvos de toque entre 24 e 44px.** `ios9.css:528` `.reorder-command{width:32px}`; `:1096` reduz a alça de arrastar da fila para 36px **no celular**, justamente onde o toque é a única interação. Passam WCAG 2.2, reprovam o padrão iOS que a skin imita.

---

## POLIMENTO

**P1 — `layers.js` é código morto que se anuncia como fonte da verdade.** O comentário no topo afirma ser "the one place stacking order is decided", mas `grep -rn "LmsLayers"` só encontra a própria definição — a ordem real está em `ios9.css:27-30`. Um mantenedor futuro vai editar `layers.js`, recarregar e não ver efeito nenhum. Ou remover o arquivo, ou fazê-lo gerar as variáveis no boot.

**P2 — Zero cabeçalhos no documento.** **[Verificado ao vivo]** A árvore de acessibilidade não tem um único `<h1>`–`<h6>`; `document.querySelectorAll('h1,h2,h3,h4,h5,h6').length` retornou **0**. Tudo é `<div>` com classe (`browse.js:92,112,170`, `detail.js:26`, `albumblock.js:28`). Um usuário de leitor de tela que pedir a lista de cabeçalhos recebe uma lista vazia; não há como pular para "o nome do artista" ou "o título do álbum".

**P3 — Listas sem semântica de lista, e `role="button"` com botões dentro.** `browse.js:104,117-139`, `queue.js:31-47`, `search.js:51-60`, `playlists.js:33-48` — nenhum `role="list"`/`listitem`, então o leitor não anuncia "lista com N itens" nem a posição; e ARIA proíbe conteúdo interativo dentro de `role="button"`. Além disso `aria-selected` não é válido em `role="button"` (`browse.js:122`, `albumblock.js:88`).

**P4 — Rótulos acessíveis ausentes ou no elemento errado.** `nowplaying.js:111-114` põe `:title` no `<svg>`, não no `<button>` — um atributo `title` em elemento SVG não nomeia o pai, então o botão de favorito é anunciado só como "botão", sem `aria-pressed`. `playlists.js:44-45` usa `↑`/`↓` como conteúdo (que tem precedência sobre `title`), então o leitor anuncia "seta para cima, botão". Os radiogroups de "Esquema de cores", "Fontes" e "Player completo" têm itens sem nome acessível — **[Verificado ao vivo]** na árvore de acessibilidade eles aparecem como `radio [ref_41]` sem nome, enquanto `radio "Flat" [ref_62]` tem. E o `<input type="file">` aparece como `button [ref_98]` sem rótulo nenhum.

**P5 — Radiogroups sem navegação por setas.** `settings.js:104-180` — cinco radiogroups, nenhum com handler de teclado nem `tabindex` dinâmico. São 14 paradas de Tab onde radiogroups corretos teriam 4, e as setas que o leitor de tela anuncia como o modo de operar não fazem nada.

**P6 — O toast do skin nunca é anunciado.** `app.js:38-40` não tem `role="alert"` nem `aria-live`, enquanto o `.connection-banner` (`:31`) e o `.operation-banner` (`:37`) do mesmo arquivo têm. É o canal de praticamente todo o feedback de erro do skin, e ele some sozinho em 6,5s.

**P7 — A barra de status é lida integralmente pelo leitor de tela.** `statusbar.js:6-10` não tem `aria-hidden`, e é o primeiro conteúdo do documento. Toda navegação começa com "Echo Classic by Felipe, 14:32, LMS Server 9.1.1". O relógio é pastiche de iOS 9 e deveria ser `aria-hidden="true"`.

**P8 — Relógio com até 10s de atraso e formato fixo.** `statusbar.js:28` usa `setInterval(this.tick, 10000)` e `:23` monta a string à mão, sem zero à esquerda ("9:05") e sem `toLocaleTimeString` — quem prefere 12h vê 24h.

**P9 — Nenhum `@media (prefers-reduced-motion)`.** Zero ocorrências no CSS. As transições são curtas (0,15–0,18s) e não violam WCAG 2.2.2, mas a preferência do sistema não é honrada.

**P10 — Nenhum suporte a `safe-area-inset`, e `100vh` em elementos roláveis.** Zero ocorrências de `env(` no CSS; `ios9.css:945,975` usam `100vh` sem `dvh`. Hoje não há corte porque `viewport-fit` está em `auto`, mas instalar como PWA standalone coloca a tab bar sob o indicador de home, e no Safari móvel o botão Cancelar da action sheet cai abaixo da dobra.

**P11 — `var(--bg)` usado e nunca definido.** `ios9.css:502` — `.advanced-settings-frame{background:var(--bg)}`. A variável não existe em `:root` nem em `body.dark`, e não há fallback, então o `background` fica transparente e o iframe de Ajustes Avançados herda o que estiver atrás.

**P12 — Duplicações e lacunas de manutenção.** `--np-fill`, `--np-sub`, `--np-l1/l2`, `--np-s1/s2`, `--dismiss-bg`, `--dismiss-ink`, `--playbtn-bg` e `--z-content` são definidas nos dois temas e **nunca usadas**. `.navbar .center` tem `gap:5px` na linha 157 e `gap:12px` na 379 — a primeira é código morto. `ios9.css:551-555` repete literalmente os dez hexes de esquema já declarados em `:55-74`, criando duas fontes da verdade. `@media (max-width:700px)` aparece quatro vezes. Chaves de `localStorage` são mantidas à mão em três listas separadas (`index.html:19`, `browse.js:12`, `settings.js:296,331`), e `split.v1` já ficou de fora do exportar/importar por causa disso.

---

## Anexo: contraste calculado

Pares extraídos do `ios9.css` e calculados pela fórmula WCAG 2.1 (script próprio, não estimativa).

| Par | Razão | Texto AA (4,5) | UI (3,0) |
|---|---|---|---|
| accent azul (padrão) sobre chrome — aba ativa, título, voltar | 4,20 | reprova | ok |
| accent teal sobre chrome | 4,54 | ok | ok |
| accent carmim sobre chrome | 5,30 | ok | ok |
| accent índigo sobre chrome | 6,19 | ok | ok |
| accent âmbar sobre chrome | 5,29 | ok | ok |
| `#D70015` destrutivo sobre group-bg escuro | 3,53 | reprova | ok |
| `#D70015` destrutivo sobre branco | 5,38 | ok | ok |
| art-placeholder claro sobre field | 1,59 | reprova | reprova |
| art-placeholder escuro sobre field | 2,87 | reprova | reprova |
| sw-off claro sobre group-bg | 1,26 | reprova | reprova |
| sw-on claro sobre group-bg | 1,84 | reprova | reprova |
| chev claro sobre branco — chevron, ✕ da fila, estrelas | 1,68 | reprova | reprova |
| chev escuro sobre preto | 2,84 | reprova | reprova |
| raildim claro sobre branco — índice A–Z | 1,98 | reprova | reprova |
| raildim escuro sobre preto | 3,69 | reprova | ok |
| text2 claro sobre field — placeholder da busca | 4,05 | reprova | ok |
| group-head claro sobre group-page | 4,49 | reprova | ok |
| hair escuro sobre content — divisor de lista | 1,60 | reprova | reprova |
| hair claro sobre branco | 1,68 | reprova | reprova |
| gauge-border claro sobre chrome | 1,61 | reprova | reprova |
| branco sobre stop 0% carmim claro | 3,91 | reprova | ok |
| branco sobre stop 0% âmbar claro | 3,42 | reprova | ok |
| field sobre content — anel de foco do `.more-command` | 1,27 | reprova | reprova |

---

## Sequência sugerida

A ordem abaixo é por retorno sobre esforço, não por severidade pura.

Primeiro, o que é uma linha ou um arquivo e destrava publicação: apagar `HTML/mojo/skinconfig.yml` (B1), criar ou remover a página de settings (B2), tirar `maximum-scale=1,user-scalable=no` (B5), mover o `clearTimeout` para depois do `res.json()` e dar `.catch` ao `tick()` (B6), zerar `this.error` no início de `run()` (B7).

Depois, o que quebra a experiência central: separar as três decisões de `activePlayback` (B3), tratar a lista OPML só-texto como vazia (B4b), e dar a "Recentes" uma ordenação por recência (B8).

Em seguida, a camada que decide se isto é uma skin pessoal ou um produto publicável: extrair as strings para `strings.txt` (B4a). É o item mais caro da lista e o que mais separa "skin do Felipe" de "skin oficial do LMS".

Contraste e foco de teclado (A23, M1–M10) são mecânicos e podem ser feitos em bloco, com o script de verificação rodando como teste de regressão.

Por fim, os dead ends de navegação (A1, A2, A3) exigem repensar `nav.js` como um todo — é a refatoração mais profunda da lista e a que mais melhora a sensação de solidez.
