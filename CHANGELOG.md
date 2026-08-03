# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico.

Cada item traz como o efeito foi comprovado. **[ao vivo]** significa que foi visto
acontecendo na interface rodando; **[código]** significa que a cadeia foi lida no
fonte mas o estado não foi reproduzido na tela. A distinção importa para quem for
decidir, daqui a seis meses, se pode confiar na correção.

## [3.1.1] — 2026-08-03

Corrige o que impedia a skin de ser gerenciada pelo próprio LMS depois de
instalada pelo repositório de extensões. Nenhuma mudança no formato de
preferências nem na versão mínima do servidor.

### Corrigido

- **`<enforce>1</enforce>` removido do `install.xml`.** Com essa marca, o
  `Slim/Utils/ExtensionsManager.pm` pula a skin ao montar a lista de plugins
  (`next if $entry->{'enforce'}`), então ela nunca aparecia em Active Plugins,
  nunca entrava no conjunto de "já instalados" e não podia ser desabilitada
  (`PluginManager.pm`: `Can't disable plugin: EchoClassic - 'enforce' set in
  install.xml`). Como consequência, o servidor a tratava como perpetuamente
  ausente e repetia o download a cada verificação, e a entrada era podada da
  seção do repositório, deixando o cabeçalho sem nenhum item para marcar.
  [código]
- A linha de metadados do álbum traduz a unidade antes de concatenar o número,
  então a interface em inglês mostra "12 songs" em vez de "12 músicas". Mesmo
  padrão já usado na fila de reprodução. [código]

### Alterado

- `repo.xml` passa a declarar `<category>skin</category>`. Sem isso a
  entrada ficava com categoria vazia e o filtro da página de plugins,
  que compara `s.category == id` no navegador, escondia o item sempre que
  qualquer categoria estivesse selecionada — inclusive "Skins", que é a
  escolha natural de quem procura uma skin. O cabeçalho do repositório
  continuava aparecendo, e por isso o sintoma era uma seção vazia. Não
  altera o pacote nem o SHA-1 da release. [código]
- `INSTALL.sh` deixa de acompanhar o pacote publicado. Ele é um utilitário de
  instalação manual específico do macOS; quem instala pelo gerenciador de
  extensões não tem uso para ele, e o script acabava dentro da pasta do plugin.
  Continua versionado no repositório, ao lado de `tools/install-local.sh`.
- Removidas do `INSTALL.sh` a migração da pasta com o nome antigo do projeto e
  a mensagem final que anunciava um alias de recuperação que não existe mais.

## [3.1.0] — 2026-08-02

Fecha a passada de publicação da skin sem alterar o formato de preferências ou a
versão mínima do servidor.

### Corrigido

- Resultados de álbum mostram artista e ano; resultados de faixa mostram artista,
  álbum, duração e origem traduzida. Dados ausentes na busca são enriquecidos por
  consultas pontuais ao servidor. [ao vivo]
- A navegação para artistas relacionados preserva a pilha da aba. O botão Voltar
  usa o rótulo da raiz quando o primeiro quadro repete o título da tela. [ao vivo]
- Favoritos vazio oferece a ação "Abrir Minha Música" e conduz à biblioteca.
  [ao vivo]
- Textos dinâmicos restantes usam o dicionário da sessão antes da concatenação;
  a interface em inglês não deixa a origem local em português. [ao vivo]

### Verificado

- Reprodução real: play, pause, seek, volume durante polling, anterior, próxima,
  avanço automático da fila, arquivo local e conteúdo Qobuz. Estado inicial do
  player restaurado após a sessão. [ao vivo]
- Cinco viewports sem overflow horizontal, controles interativos aninhados ou
  botões sem nome; player completo contido e cabeçalho da fila sem sobreposição
  em 390 px. [medido]
- Testes unitários cobrem formatação, tradução, importação de preferências,
  relevância e enriquecimento de busca; verificações estruturais cobrem os estados
  críticos de DOM. Troca de player, sincronização, transferência de reprodução e
  stream real sem duração conhecida continuam sem cobertura automatizada.
  [medido]
- Validação contínua executa testes, os quatro portões locais e a consistência de
  versão entre os três manifestos de release. [código]

## [3.0.1] — 2026-08-02

Fecha os defeitos bloqueadores encontrados na auditoria da 3.0.0. Sem mudança de
API, sem mudança de dados persistidos além de uma migração única de ordenação.

### Corrigido — bloqueadores

- **A barra inferior deixa de morrer com o player parado.** `activePlayback`
  governava três decisões ao mesmo tempo — texto, transporte e abertura do player —
  e `app.js` é o único caminho para `LmsUi.openPlayer`. Com fila carregada e
  `mode: 'stop'`, a barra dizia "Nada tocando" e o clique não fazia nada, embora
  `nowplaying.js` usasse critério diferente e o player completo funcionasse
  perfeitamente naquele estado. Agora abrir o player e mostrar o transporte
  dependem de haver faixa corrente; só o texto depende de fila vazia. [ao vivo]
- **Favoritos vazio deixa de mostrar "Empty".** O servidor devolve um item de
  placeholder do tipo `text`, então `items.length === 1` e o estado vazio em
  português — que já existia, centralizado e com a ação sugerida — nunca era
  alcançado. Uma lista composta apenas de itens `text` passa a contar como vazia. [ao vivo]
- **"Recentes" volta a mostrar o que é recente.** O servidor era consultado com
  `sort: 'new'` e o resultado reordenado alfabeticamente por cima, e o menu não
  oferecia nenhuma opção de recência. Nova chave `recent` = ordem nativa do
  servidor, padrão dessa raiz. Migração única para quem tinha `name` gravado,
  com flag que respeita escolha explícita posterior. [ao vivo]
- **O timeout do RPC passa a cobrir a leitura do corpo.** O `AbortController` era
  cancelado antes de `res.json()`: um servidor que mandava cabeçalhos e estancava o
  corpo deixava a promise pendente para sempre. Em cascata, `tick()` não
  reagendava e `startPolling()` se recusava a religar, então o polling morria pelo
  resto da sessão — inclusive depois de "Tentar novamente". [código]
- **"Tentar novamente" da busca volta a retornar.** `run()` nunca zerava
  `this.error`, e o template testa o erro antes dos resultados: depois de uma falha,
  a tela de erro ficava para sempre, mesmo com a busca já funcionando. [código]
- **Importar preferências deixa de poder inutilizar a skin.** Só o envelope era
  validado; um arquivo corrompido de forma ainda sintaticamente válida quebrava a
  skin a cada recarga, sem caminho de recuperação na interface. Validação de forma
  na importação, leitura defensiva em `ui.js` e `nav.js`, e backup do estado
  anterior em `echoclassic.import-backup.v1`. [código]
- **Página de ajustes do plugin deixa de abrir em branco.** `Settings.pm` apontava
  para `plugins/EchoClassic/settings/basic.html`, que não existia. O template foi
  escrito contra as classes que o LMS 9.1.1 realmente usa, conferidas na página de
  settings de outro plugin rodando. [pendente de reinício do servidor]
- **O alias `/mojo` deixa de ser registrado como uma segunda skin.**
  `HTML/mojo/skinconfig.yml` fazia o LMS listar "mojo" no seletor de skins, ao lado
  de "Echo Classic". O redirecionamento continua pelo `$LEGACY_URL_RE` do
  `Plugin.pm`. [ao vivo, após remoção do arquivo]
- **Zoom volta a funcionar.** `maximum-scale=1,user-scalable=no` saiu do viewport.
  A migração da tipografia de `px` para `rem` fica para a 3.1. [código]

### Corrigido — estado e sincronia

- Resposta de `refresh`, `loadQueue`, `playContainer` e `jumpTo` amarrada ao player
  que a pediu; trocar de player durante uma requisição lenta não mistura mais os
  dois estados nem grava a mistura na sessão. [código]
- `queueUndo` amarrado ao player de origem e limpo ao trocar de player. Antes,
  "Desfazer" depois de um handoff injetava a fila de uma sala na outra. [código]
- `volumeDragging` liberado em `pointerup`, `lostpointercapture` e `beforeDestroy`:
  encostar no slider e fechar o player congelava o volume exibido pelo resto da sessão. [código]
- `@pointercancel` no seek. Um scroll interpretado como arraste congelava o gauge e
  o tempo decorrido mesmo com a música tocando. [código]
- Tempo restante da fila desconta o que já tocou e fatia por `t.index`, não por
  posição no array. [código]

### Corrigido — interface

- Fila: botão de fechar próprio, fundo escurecido, "Limpar tudo" em dois passos e
  com cor destrutiva, ✕ da linha deixa de usar a cor do chevron (parecia
  desabilitado), ↑↓ desabilitados nos extremos, faixa atual com marcador não
  cromático e `aria-current`, e marcada só quando há faixa corrente de fato. [ao vivo]
- Escape fecha a camada mais alta aberta e devolve o foco ao gatilho. Antes não
  existia nenhum listener de teclado global no skin. [ao vivo]
- Volume em Ajustes virou controle real; era um `<span>` embora `setVolume`
  existisse e fosse usado pelo player. [ao vivo]
- "Parar ao terminar" desabilitado sem reprodução — com nada tocando o cálculo caía
  em `sleep 1` e desligava o player em um segundo. [ao vivo]
- Erro de validação de campo, erro ao tocar um item e erro fatal de carregamento
  deixam de compartilhar a mesma variável: um `http://` faltando não apaga mais a
  lista de rádios nem o texto digitado. [código]
- Item OPML sem ação deixa de receber `role="button"`, `tabindex` e chevron. [código]
- Busca OPML sem resultado deixa de mandar ativar um serviço de rádio. [código]
- Raiz de Minha Música restaurada entre sessões; era gravada e ignorada na leitura. [ao vivo]
- Radiogroups dos Ajustes com navegação por setas: 14 paradas de Tab viraram 5. [ao vivo]

### Corrigido — contraste, foco e alvos de toque

Treze pares abaixo do mínimo WCAG, recalculados nos dois temas e nos cinco esquemas
de acento. O esquema **padrão** era o que reprovava na aba ativa e no título da
navbar (4,20:1). Detalhe contraintuitivo: o trilho da barra de progresso no tema
claro foi clareado, não escurecido — o preenchimento é o acento escuro sobre trilho
claro, então escurecer pioraria. [calculado, com `tools/check-contrast.py`]

Foco visível em todo elemento interativo; os `outline:0` que anulavam o anel no
campo de busca, no nome de playlist, no botão "…" e no divisor foram removidos.
Índice A–Z de 22×12,8 para 28px com alvos de 24px; divisor arrastável de 14 para
24px; alça de remover da fila no celular de 36 para 44px. Bloco
`prefers-reduced-motion`, que não existia. [ao vivo]

### Corrigido — formatação

`duration()` mostra horas — um audiolivro de 1h15 aparecia como `75:00`.
`longDuration()` não produz mais "60 min", "1 h 60 min" nem "0 min".
`depth()` diz "24 bits". `coverUrl()` gera miniatura em qualquer tamanho: o
carrossel baixava doze capas em resolução original para exibir miniaturas de 104px.
Badge hi-res calculado por etiqueta — um CD rip 44,1/24 acendia "44,1 kHz".
"1 reprodução" no singular. [ao vivo]

### Segurança

Os valores que o Perl injeta em literais JavaScript passaram a ser escapados. Uma
aspa ou quebra de linha em `getPlayerHint` — que vem de um nome de player, valor
que o dono do dispositivo controla — fecharia o literal e o resto da linha viraria
código executável. **Não verificado:** não foi demonstrado que um nome de player
consegue carregar aspas até ali; é defesa em profundidade, não correção de
exploração comprovada.

### Removido

- `html/js/layers.js` — código morto que se anunciava como "the one place stacking
  order is decided", enquanto a ordem real estava nas variáveis do CSS. Um
  mantenedor futuro editaria o arquivo, recarregaria e não veria efeito nenhum.
- `HTML/mojo/skinconfig.yml` — ver acima.
- "by Felipe" da barra de status. Autoria pertence ao `install.xml` e ao README.

### Não versionado

`html/lib/vue-virtual-scroller.min.js` e `.css` existem na instalação mas não são
carregados por nenhuma página do skin, e não foi possível identificar de qual
release do pacote vieram (25.438 bytes não bate com nenhuma versão publicada no
npm). Ficaram fora do repositório de propósito. Se algum dia forem usados, entram
como dependência declarada.

`html/lib/vue.min.js` **está** versionado: foi confirmado byte a byte idêntico ao
`dist/vue.min.js` do `vue@2.7.15` — mesmo tamanho (107.335 bytes) e mesmo FNV-1a
(`be90b832`), medido no arquivo servido pelo próprio LMS.

## [3.0.0] — 2026-08-01

Baseline importada. Renomeação de MojoSkin para Echo Classic, com `/mojo` mantido
como alias de recuperação para bookmarks anteriores.
