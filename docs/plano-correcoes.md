# Echo Classic — plano de correções para publicação

**Base:** 3.0.0 (auditoria de 02/08/2026, 89 achados)
**Alvo:** 3.0.1 (correções mecânicas, já implementadas) → 3.1.0 (i18n) → 3.2.0 (navegação)
**Decisões tomadas:** o i18n **entra** na primeira versão publicada; as correções mecânicas ficam comigo, as que exigem decisão de produto ficam com você.

---

## Parte 1 — Backup

### Estado

O backup **ainda não foi criado**. A pasta `Squeezebox/EchoClassic Backups/` tem três entradas de hoje (`20260802-125233`, `20260802-141136`, `20260802-before-legacy-alias`), todas geradas pelo seu próprio `INSTALL.sh` em instalações anteriores — nenhuma delas é o ponto de rollback desta rodada de correções, porque nenhuma foi tirada com a árvore no estado exato que eu auditei.

O comando de backup está na conversa. Ele cria a cópia carimbada, o `.tgz` em Downloads e um `MANIFEST.sha256`. **Nada foi escrito na sua máquina até agora** — todo o trabalho abaixo foi feito numa cópia isolada aqui na sessão.

### O backup paralelo que já existe

Independente disso, esta sessão tem uma cópia da 3.0.0 **verificada byte a byte**: reconstruí os 26 arquivos a partir do bundle e comparei o tamanho de cada um contra o tamanho real no disco — 26 de 26 conferem exatamente. Essa cópia está commitada em git aqui, então o diff de tudo que mudou é exato, e dá para voltar qualquer arquivo individualmente.

O que essa cópia **não** tem: `html/lib/vue.min.js`, `html/lib/vue-virtual-scroller.min.js` e `html/lib/vue-virtual-scroller.css` (vieram excluídos do bundle por serem vendor). Por isso o pacote de correções é um **overlay**, não uma substituição — ele não toca em `html/lib/`.

### O que o backup precisa cobrir e muita gente esquece

O estado da skin **não vive só nos arquivos do plugin**. Ele está em três lugares:

O primeiro são os arquivos do plugin, que o comando cobre. O segundo são as preferências do lado do servidor, em `plugin/echoclassic.prefs` — eu vi que esse arquivo existe (143 bytes) e que há também um `mojoskin.prefs` remanescente do nome antigo. O comando de backup copia o `server.prefs`, mas **não** o `echoclassic.prefs`; vale acrescentar. O terceiro é o `localStorage` do navegador, que guarda tema, esquema de cores, fontes, pins e pilha de navegação, e que nenhum backup de arquivo alcança — por isso o pedido de clicar em `Ajustes › Preferências da skin › Exportar`.

---

## Parte 2 — O que já está implementado (3.0.1)

Tudo abaixo está feito, numa cópia isolada, e passou por quatro verificações independentes: `node --check` nos 20 arquivos JS, compilação dos 18 templates Vue com `vue-template-compiler` 2.7.16 (0 erros, 0 avisos), checagem cruzada de referências entre módulos (nenhuma chamada `LmsStore.*` / `LmsUi.*` / `LmsNav.*` / `LmsApi.*` / `LmsFmt.*` órfã), e recálculo do contraste direto do CSS final.

**1.008 linhas inseridas, 292 removidas, 22 arquivos.**

### Bloqueadores

**B1 — "mojo" registrado como segunda skin.** Removido `HTML/mojo/skinconfig.yml`. O `HTML/mojo/index.html` fica como redirecionador, e o alias `/mojo` continua funcionando pelo `$LEGACY_URL_RE` do `Plugin.pm`. Depois de instalar, o seletor `pref_skin` deve listar sete skins, não oito.

**B2 — página de ajustes em branco.** Criado `HTML/EN/plugins/EchoClassic/settings/basic.html`. Não inventei a estrutura: fui ler os templates reais do servidor em `Lyrion Music Server.app/Contents/MacOS/.../server/HTML/EN/settings/` (confirmando que `header.html` e `footer.html` existem) e inspecionei a página de settings do plugin CDplayer rodando ao vivo para copiar as classes que o LMS 9.1.1 de fato usa: `settingSection`, `settingGroup`, `prefHead`, `prefDesc`, `prefs`, e campos nomeados `pref_<nome>`. As três preferências de `Settings.pm` ganharam rótulo e descrição em `strings.txt`, em EN e PT.

**B3 — barra inferior morta com o player parado.** `activePlayback` deixou de governar três decisões de uma vez. Abrir o player, mostrar capa/título/badges e mostrar o transporte agora dependem de `hasTrack`; o botão central vira "tocar" em `stop` e `pause`; "Nada tocando" só aparece quando não há faixa corrente. O botão ganhou `aria-label` (antes era um `button` sem nome acessível). E `.mini .np:disabled` deixou de ser pixel a pixel idêntico ao habilitado.

**B4b — "Empty" nos Favoritos.** `opmlview` passou a tratar uma lista composta **apenas** de itens `text` como lista vazia, caindo no estado vazio próprio do skin — a mensagem pt-BR centralizada que já existia no código e nunca era exibida. Listas que misturam texto e itens acionáveis continuam renderizando o texto.

**B5 — zoom desabilitado.** `maximum-scale=1,user-scalable=no` saiu do viewport, substituído por `viewport-fit=cover`. A migração da tipografia para `rem` fica para a 3.1 (ver Parte 3).

**B6 — timeout do RPC não cobria o parse.** `rpc()` virou um `try/finally` único com o `clearTimeout` depois do `res.json()`, então o mesmo `AbortController` cobre fetch e leitura do corpo; um `AbortError` no parse vira `kind:'timeout'`. E o polling deixou de morrer: `tick()` reagenda também no caminho de erro, com três variáveis (`timer`, `ticking`, `polling`) que impedem tanto o travamento quanto dois timers concorrentes. Testado com um `fetch` falso que devolve cabeçalhos e estanca o corpo: rejeita em 802 ms, onde antes ficava pendente para sempre.

**B7 — "Tentar novamente" da busca preso.** `run()` zera `this.error` logo depois de incrementar o token de requisição.

**B8 — "Recentes" em ordem alfabética.** Chave de ordenação `recent` = ordem nativa do servidor, agora padrão dessa raiz e primeira opção do menu ("Adicionados recentemente"). O `rows.sort()` é pulado quando ela está ativa. Dois cuidados que valem registro: há uma migração única para quem já tem `sortByView.recentes === 'name'` gravado (sem ela a correção seria invisível para você), com flag para não sobrescrever uma escolha explícita posterior; e o trilho alfabético fica escondido nessa ordenação, porque saltar para uma letra numa lista não-alfabética não leva a lugar nenhum.

**B9 — importar preferências podia inutilizar a skin.** Duas camadas: validação de **forma** de cada chave na importação (`Array.isArray` de objetos para `pins`/`history`, objeto plano para `ui`/`session`, pilhas de `nav` como arrays de objetos com `label`), rejeitando o arquivo inteiro com mensagem que nomeia o problema; e leitura defensiva em `ui.js` e `nav.js`, para que um `localStorage` **já** corrompido caia no padrão em vez de estourar a cada recarga. Antes de gravar, o estado atual vai para `echoclassic.import-backup.v1`.

### Altos

Corrigidos: resposta de `refresh`/`loadQueue`/`playContainer`/`jumpTo` amarrada ao player que a pediu (A11); `queueUndo` amarrado ao player de origem e limpo em `selectPlayer`/`handoffTo`/`playContainer` (A12); `volumeDragging` liberado em `pointerup`, `lostpointercapture` e `beforeDestroy` (A13); `@pointercancel` no seek (A14); guarda de nulo em `ensureRecentSelection` (A16); `friendlyError` cobrindo `http`/`lms`/`parse` e exportado, com a string técnica em `console.debug` (A8); `input[type=file]` limpo em todos os caminhos de erro (A22); texto da confirmação de importação alinhado ao que o código faz, com os grupos afetados nomeados (A21); "Restaurar" → "Importar" (X5); erro de validação de campo OPML separado do erro fatal, renderizado sob o campo com `role="alert"` e sem destruir a lista nem o texto digitado (A6 parcial); busca OPML sem resultado com mensagem própria citando o termo, em vez de mandar ativar um serviço de rádio (A6); item OPML sem ação deixou de receber `role="button"`, `tabindex` e chevron (A4); Escape fecha a busca e devolve o foco à lupa, com handler global em `ui.js` que fecha a camada mais alta (A23).

### Contraste, foco e alvos de toque

Os treze pares que reprovavam agora passam — **verifiquei de novo por conta própria, lendo os tokens do CSS final**, não confiando no relatório de quem editou:

| par | claro | escuro | mínimo |
|---|---|---|---|
| aba ativa / título da navbar | 4,56 | 8,66 | 4,5 |
| estrelas de avaliação | 4,55 | 4,60 | 4,5 |
| chevron / marcador de seleção | 4,55 | 4,60 | 3,0 |
| índice A–Z inativo | 4,56 | 4,60 | 4,5 |
| inicial sem capa | 4,55 | 4,56 | 4,5 |
| switch desligado | 3,26 | 3,10 | 3,0 |
| switch ligado | 3,12 | 10,33 | 3,0 |
| divisor de lista | 3,57 | 3,59 | 3,0 |
| borda do gauge | 3,12 | 3,12 | 3,0 |
| placeholder da busca | 5,16 | 7,26 | 4,5 |
| subtítulo em linha selecionada | 4,64 | 6,64 | 4,5 |
| cabeçalho de grupo dos Ajustes | 4,62 | 6,79 | 4,5 |
| ação destrutiva | 5,38 | 5,58 | 4,5 |

Um detalhe contraintuitivo que vale saber: o trilho do gauge no tema claro foi **clareado**, não escurecido. O preenchimento é o acento escuro sobre trilho claro, então escurecer o trilho pioraria a razão.

Foco: regra base `:where(button,a,input,select,textarea,[tabindex]):focus-visible` cobrindo todo elemento interativo, com `outline-offset:-2px` nos containers que recortam; os `outline:0` que anulavam o foco no campo de busca, no nome de playlist, no botão "…" e no divisor foram removidos; o anel do segmentado de gauge virou `box-shadow` duplo interno, porque `box-shadow` externo seria recortado pelo `overflow:hidden`.

Alvos de toque: índice A–Z de 22×12,8 para 28px com spans de 24px; divisor arrastável de 14 para 24px com faixa visual de 14px via `::before`; `.reorder-command` para 44px; alça de remover da fila no celular de 36 para 44px.

E um bloco `@media (prefers-reduced-motion:reduce)` no fim do arquivo — o único lugar do CSS com `!important`.

### Fila, player e formatação

Fila: botão de fechar (`queue-dismiss`, 44×44, com `aria-label`) — antes as únicas saídas eram Esc e um captador de cliques invisível, que agora ganhou escurecimento; "Limpar tudo" em dois passos, com a cor destrutiva, separado de "Limpar próximas"; ✕ deixou de usar a cor do chevron (parecia desabilitado) e passou a usar a cor destrutiva; faixa atual com marcador não-cromático e `aria-current`, e **só** quando há faixa corrente de fato — antes `num(undefined) → 0` marcava a primeira linha com o player parado; ↑ e ↓ com `:disabled` nos extremos e foco devolvido depois do reorder; o `.stop` no Esc só para a propagação quando o componente realmente vai fechar, então o Esc volta a fechar o player cheio.

Formatação: `duration()` mostra horas (`1:15:00` em vez de `75:00`); `longDuration()` não produz mais "60 min", "1 h 60 min" nem "0 min", e abaixo de 60s diz "menos de 1 min"; `depth()` diz "24 bits"; `coverUrl()` gera miniatura para qualquer tamanho — antes só `50` era otimizado e o carrossel baixava doze capas em resolução cheia — e aplica `encodeURIComponent`; badge hi-res calculado por etiqueta, então um CD rip 44,1/24 não acende mais "44,1 kHz"; "1 reprodução" no singular; fallback nos rótulos de shuffle/repeat, que antes podiam renderizar botões vazios.

Tempo restante da fila: desconta o que já tocou e fatia por `t.index`, não por posição no array — numa fila de 800 com a atual em 600 o resultado antes era vazio, e o cabeçalho dizia "ao vivo".

### Higiene

`layers.js` removido (era código morto que se anunciava como "the one place stacking order is decided", enquanto a ordem real está no CSS) e tirado da lista de carga. `var(--bg)` inexistente trocado por `var(--content)`. `gap:5px` morto removido. `songCache` virou LRU de 200 entradas. "Echo Classic by Felipe" virou "Echo Classic"; "LMS Server" virou "Servidor LMS"; a barra de status ganhou `aria-hidden="true"` — ela é pastiche de iOS 9 e era a primeira coisa que um leitor de tela lia em toda navegação; o relógio passou a usar `toLocaleTimeString` (respeitando 12h/24h do sistema, com zero à esquerda) e atualiza a cada 15s em vez de 10.

Os valores que o Perl injeta em literais JavaScript passaram a ser escapados por uma sub `js_literal`. Uma aspa ou quebra de linha em `$hint` — que vem de um nome de player, valor que o dono do dispositivo controla — fecharia o literal e o resto da linha viraria código executável. [Não verificado] Não consegui provar que um nome de player consegue carregar aspas até o `getPlayerHint`; o escape é defesa em profundidade, não correção de exploração demonstrada.

### O que mudou de comportamento e você deve conferir

Estes são os pontos onde a correção muda o que você já está acostumado a ver:

A raiz de Minha Música agora é restaurada entre sessões (antes voltava sempre em "Recentes", mesmo com o painel da direita reabrindo o item antigo — o descompasso que produzia o "‹ Recentes / Recentes ⌄"). "Recentes" volta em ordem de inclusão, e o trilho A–Z some nessa ordenação. A barra inferior fica alta mesmo com o player parado, desde que haja faixa corrente. Os radiogroups dos Ajustes passaram de 14 paradas de Tab para 5, com as setas funcionando. E `coverUrl` agora pede redimensionamento ao LMS em todos os tamanhos — se o servidor não gerar algum, a capa cai no placeholder, e o ponto único de ajuste é essa função.

---

## Parte 3 — O que falta

### Fase A — instalar e validar a 3.0.1 (você, ~30 min)

Nada disso vale sem passar pelo LMS de verdade. A ordem importa:

Backup primeiro. Depois aplique o overlay preservando `html/lib/`. Reinicie o servidor pelo ícone da barra de menus — o `getAssetRevision` usa o mtime mais novo da árvore, então a revisão dos assets muda sozinha e o navegador não fica com o código velho. Aí percorra a lista de aceite da Parte 4.

O ponto de maior risco é o `basic.html`: as classes e o par header/footer eu confirmei contra o LMS 9.1.1 instalado, mas **não** rodei o template. Se a página abrir quebrada em vez de em branco, é ali.

### Fase B — i18n (3.1.0, com você)

Esta é a fase que decide se o resultado é "a skin do Felipe" ou "uma skin oficial do LMS", e é a que você escolheu manter no escopo da primeira publicação. É também a maior: centenas de strings espalhadas por 22 arquivos, hoje embutidas em português no JavaScript, com `index.html` fixando `lang="pt-BR"`.

O caminho que eu recomendo tem quatro passos e evita a armadilha óbvia.

Primeiro, **centralizar antes de traduzir**. Criar um `html/js/strings.js` com um objeto `LmsStr` de chaves para texto, e substituir os literais dos templates por `{{ t('QUEUE_UPCOMING') }}`. Isso é mecânico, revisável em diff, e não depende de nenhuma decisão do LMS. Só depois disso é que a origem do texto vira uma escolha.

Segundo, **alimentar essas chaves do `strings.txt` do LMS**, injetando o dicionário no `index.html` via `[% PERL %]` com `Slim::Utils::Strings::string()` no idioma da sessão. É assim que o LMS espera que um plugin se localize, e é o que permite que um tradutor contribua sem tocar em JavaScript.

Terceiro, **trocar `lang="pt-BR"` pelo idioma real do servidor** e revisar tudo que assume português: a ordenação usa `localeCompare(..., 'pt-BR')` em `browse.js`, o `rate()` de `format.js` troca ponto por vírgula decimal, e `count()` usa ponto como separador de milhar. Nada disso deve ficar fixo.

Quarto, e é o passo que quase sempre falta: **decidir o que fazer com o texto que vem do servidor**. As categorias do TuneIn ("My Presets", "Local Radio") chegam em inglês porque o próprio LMS as devolve assim; o "Empty" dos Favoritos era do servidor. Traduzir isso no skin seria errado — o certo é passar o idioma da sessão nas chamadas OPML e aceitar o que voltar. Vale documentar essa fronteira, porque ela vai reaparecer como "bug de tradução" para sempre.

Estimativa honesta: o passo um é o volume (algumas horas de trabalho mecânico); os passos dois a quatro são meia dúzia de decisões e pouco código. O risco concentra-se no passo um, e é o tipo de trabalho onde um diff grande revisado de uma vez é mais seguro do que muitos pequenos.

Junto disso vale fazer a migração da tipografia de `px` para `rem` (135 declarações), que é o par natural do B5: sem ela, remover o `user-scalable=no` resolve o pinch-zoom mas o skin continua ignorando a preferência de tamanho de fonte do sistema. E vale estabelecer um piso de 12px para qualquer rótulo funcional — hoje as cinco abas estão em 10,5px, o nome do artista tocando em 10px e os badges em 8,5px.

### Fase C — navegação (3.2.0, com você)

É a refatoração mais profunda e a que mais melhora a sensação de solidez. São três defeitos entrelaçados que não dá para corrigir isoladamente:

O botão Voltar do navegador leva **para dentro** da navegação, não para fora, porque `push` empilha entradas de histórico e `back` só sobrescreve a corrente com `replaceState`. A pilha é zerada em toda entrada (`LmsNav.reset` antes de cada `push` em quatro lugares), o que faz a profundidade real do app ser 2 e destrói o caminho de volta quando você entra num artista relacionado — e ainda troca a raiz da esquerda sem avisar. E em profundidade 1 o rótulo do botão Voltar é idêntico ao título da tela.

Os três têm a mesma raiz: a pilha do skin e a pilha do navegador são duas fontes de verdade mantidas à mão. A correção é fazer uma seguir a outra — `back()` delegando para `history.back()` e deixando o `popstate` fazer o pop — e parar de resetar a pilha nas entradas laterais. Isso muda o comportamento de navegação de forma visível, por isso não entrou na 3.0.1: não é uma correção que se aplica sem testar a mão.

Junto entram os itens de estrutura semântica que o leitor de tela precisa: nenhum `<h1>`–`<h6>` no documento inteiro (`querySelectorAll('h1,...,h6').length` retorna zero), listas sem `role="list"`/`listitem`, e linhas com `role="button"` contendo botões dentro — que ARIA proíbe e que faz o NVDA achatar os controles.

### Fase D — o resto

Sobram os itens de perda silenciosa de dados (tetos de paginação de 250/500/1.000/2.000/10.000 sem indicador, e álbuns sem artista sumindo do agrupamento por artista), a folha de informações sem token de requisição, o `lms-detail` sem token, e os itens de polimento. Nenhum deles impede publicar; todos eles aparecem quando a biblioteca cresce.

---

## Parte 4 — Aceite da 3.0.1

Cada linha abaixo testa um bloqueador. Se alguma falhar, o `.tgz` não está pronto.

**B1** — `Ajustes do servidor › Interface`: o seletor de skin lista **sete** opções e "mojo" não está entre elas. Abrir `http://<servidor>:9000/mojo/` ainda redireciona para `/echoclassic/`.

**B2** — `Ajustes do servidor › Echo Classic` abre uma página com três caixas de seleção rotuladas, não uma página em branco. Marcar uma, salvar, recarregar: o estado persiste.

**B3** — Carregue um álbum na fila e aperte Parar. A barra inferior mostra o título da faixa, o botão do meio é ▶, e clicar na barra abre o player cheio.

**B4b** — Com os Favoritos vazios, a tela mostra a mensagem em português centralizada, com a ação sugerida. Não aparece "Empty".

**B5** — No celular, o pinch-zoom funciona.

**B6** — Difícil de reproduzir sem derrubar o servidor no meio de uma resposta. O teste possível: pare o LMS, espere o banner de conexão, suba de novo, e confirme que o tempo decorrido volta a andar **sem** recarregar a página. Antes, o polling não voltava.

**B7** — Busque algo, derrube a rede, deixe a busca falhar, restaure a rede e clique "Tentar novamente". Os resultados aparecem.

**B8** — `Minha Música › Recentes` vem em ordem de inclusão, com "Adicionados recentemente" selecionado no menu. Escolher "Álbum" e recarregar mantém "Álbum".

**B9** — Exporte as preferências, edite o JSON trocando o valor de `echoclassic.pins.v1` por `{"a":1}`, e tente importar. O arquivo é rejeitado com mensagem, e a skin continua funcionando.

E três de regressão, porque são os pontos que mais mudaram: Escape fecha a folha de ações, a fila, o player e a busca — cada um fechando só a sua camada, e a busca devolvendo o foco à lupa; arrastar o volume no player e soltar fora da trilha, depois conferir que o volume volta a sincronizar; e tabular a tela de Ajustes inteira, conferindo que cada radiogroup é alcançável e que as setas circulam dentro dele.

---

## Parte 5 — Instalar e voltar atrás

O pacote é um **overlay**. Não use `ditto` de árvore inteira nem apague a pasta antes: `html/lib/` (Vue e vue-virtual-scroller) não está no pacote e seria perdido.

```
M="<home do servidor>/Library/Application Support/Squeezebox"
tar -xzf ~/Downloads/echoclassic-3.0.1-correcoes.tgz -C /tmp
rsync -a /tmp/EchoClassic/ "$M/Plugins/EchoClassic/"
rm -f "$M/Plugins/EchoClassic/HTML/mojo/skinconfig.yml"
rm -f "$M/Plugins/EchoClassic/HTML/echoclassic/html/js/layers.js"
```

As duas remoções são necessárias porque `rsync` sem `--delete` copia, mas não apaga — e `skinconfig.yml` e `layers.js` precisam **sumir**, não serem sobrescritos. Depois disso, reinicie o servidor pelo ícone da barra de menus.

Para voltar: `ditto` da pasta carimbada de volta para `Plugins/EchoClassic` e reiniciar. Se o problema for de um arquivo só, o diff de 2.510 linhas permite reverter individualmente.

Um aviso sobre o `INSTALL.sh`: ele move a versão anterior para `EchoClassic Backups/` e recusa rodar se houver `EchoClassic.backup-*` dentro de `Plugins/`. Como o overlay não passa por ele, essa proteção não atua — o backup manual é o que te cobre nesta rodada.
