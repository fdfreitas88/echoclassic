# Echo Classic — auditoria unificada para estabilizacao de UX

Data: 02/08/2026  
Arvore auditada: `<repositorio>`  
Instalacao ativa comparada: `<pasta de plugins do LMS>/EchoClassic`  
LMS ao vivo: `http://<servidor>:9000/echoclassic/`

Este documento reconcilia a auditoria de 21 itens (revisao de release) com a auditoria anterior da versao 3.0.0 e o estado real 3.0.1. Ele nao corrige codigo.

## 1. Identificacao da arvore

[calculado] A copia de trabalho contem a arvore 3.0.1 do Apendice A para todos os arquivos presentes: todos os hashes SHA-256 de 16 caracteres e tamanhos conferem byte a byte, exceto `.github/workflows/validate.yml`, ausente na arvore local.

[codigo] A versao em disco e 3.0.1: `EchoClassic/install.xml:6` contem `<version>3.0.1</version>` e `EchoClassic/Plugin.pm:50` retorna `3.0.1`.

[codigo] A historia Git nao esta materializada: `git ls-files` lista apenas `.gitattributes` e `README.md`; o restante aparece como arquivos nao rastreados/modificados no status. Isso confirma a premissa do handoff: a arvore fisica esta completa, mas os commits do bundle ainda nao foram enxertados.

[codigo] `tests/` e os arquivos de handoff citados no briefing nao existem em `<repositorio>` nem em `<copia de trabalho>`. O comando `find` para esses nomes nao retornou entradas. Divergencia estrutural: o briefing mandava le-los, mas eles nao estao nesta copia.

[codigo] Origem e instalacao ativa conferem nos arquivos verificados diretamente: `install.xml`, `index.html`, `settings.js` e `ios9.css` tem o mesmo hash/tamanho entre repo e `Plugins/EchoClassic`.

[ao vivo] O LMS ao vivo carrega a skin, mas injeta `LMS_SKIN_VERSION="3.0.0"` no HTML e a tela de Ajustes mostra "Versao da skin 3.0.0", apesar de `Plugin.pm` em disco retornar 3.0.1. [inferencia] O modulo Perl antigo provavelmente continua em memoria porque o LMS nao foi reiniciado depois da troca dos arquivos.

[codigo] A instalacao ativa ainda contem arquivos operacionais obsoletos: `HTML/mojo/skinconfig.yml` e `HTML/_sonda.txt`. Isso mantem pendente a limpeza pos-publicacao descrita no handoff.

## 2. Veredito sobre os 21 itens

| Item | Status | Evidencia e falta |
|---|---|---|
| P1.1 Player completo em 1024x768 | parcial | [ao vivo] Em 1024x768, player adaptavel sem fila tem `.npfull` com `clientHeight=563` e `scrollHeight=719`; `.np-tools` termina em `y=775`, 7px alem do viewport. [codigo] O CSS tenta compactar em `ios9.css:773-781`, mas ainda ha overflow. Com fila embutida, a capa cai para 108px e controles essenciais ficam visiveis. Falta eliminar overflow da primeira tela sem fila e validar todos os seis viewports. |
| P1.2 Controles interativos aninhados | aberto | [ao vivo] Em Minha Musica, existem linhas `role="button"` com botao "Mais acoes" dentro. [codigo] Exemplos: `browse.js:119-140`, `albumblock.js:86-109`, `search.js:52-69`, `playlists.js:32-56`, `queue.js:44-66`. Com lista de albuns/faixas, o usuario navega por uma linha clicavel e o leitor de tela encontra outro controle dentro dela. |
| P2.3 Favoritos vazio | feito | [codigo] `opmlview.js:65-70` trata listas compostas so por itens `text` como vazias; `opmlview.js:75-90` mostra titulo/mensagem em portugues. [nao verificado] Nesta sessao nao havia favoritos vazios para reproduzir. |
| P2.4 Fila parada ambigua | parcial | [ao vivo] A fila anuncia `aria-label="Fila de reproducao"` mas o titulo visual ainda e "Proximas"; o contador aparece como `12 · 1 h 3 min restantes`, sem "faixas"; nao indica qual faixa iniciara no Play. [codigo] `queue.js:15`, `queue.js:18-20`, `queue.js:28-31`. |
| P2.5 Fila sem fechamento visivel | feito | [ao vivo] O popover tem botao `aria-label="Fechar fila"`. [codigo] Botao em `queue.js:33-35`, Escape em `queue.js:123-133`, foco restaurado em `queue.js:115-119`. |
| P2.6 Localizacao inconsistente | aberto | [ao vivo] Radio mostra `My Presets`, `Local Radio`, `Music`, `Sports`, `News`, `Talk`, `By Location`, `By Language`, `Podcasts` e campo `Search TuneIn`. [codigo] `index.html:3` fixa `lang="pt-BR"` e nao ha camada `LmsStr`; `browse.js:252` e `detail.js:101` fixam `pt-BR` em ordenacao. |
| P2.7 Busca sem contexto | parcial | [codigo] Faixas exibem artista e album quando disponiveis (`search.js:57-60`); albuns carregam artista/ano para o frame aberto (`search.js:167-171`). [ao vivo] Na busca "Acqua", varias faixas classicas repetidas apareceram sem artista/album visivel no texto da lista. Falta origem/formato e contexto consistente para distinguir titulos repetidos. |
| P2.8 Relevancia da busca | parcial | [ao vivo] Busca por "Acqua" mostrou `Acqua Fragile` em Artistas e seus albuns antes das faixas "Musica sull'acqua". [codigo] `search.js` apenas renderiza o retorno de `LmsApi.search` e nao aplica ranking proprio; se o servidor devolver ordem ruim, a skin nao corrige. Falta uma ordenacao testavel por exata/inicio/parcial/demais. |
| P2.9 Continuidade da busca | parcial | [ao vivo] Ao abrir busca a tab "Minha Musica" continua `aria-selected`; Cancelar devolve o foco ao botao de busca. [codigo] abrir/fechar busca em `navbar.js:74-86`; Escape global em `ui.js:496-502`; `closeSearch()` nao guarda/restaura scroll (`ui.js:389-392`). |
| P2.10 Carrossel de recentes cortado | parcial | [codigo] CSS atual tem `padding:0 10px 8px` e `scroll-snap-align:start` em `ios9.css:305-307`; a raiz zera scroll apos reload em `browse.js:740-743`. [nao verificado] Nao reproduzi corte visual nesta sessao; falta teste visual desktop e troca de agrupamento. |
| P2.11 Marca truncada em 320px | feito por caminho divergente | [ao vivo] Em 320x568, `.brand` mostra `Echo Classic`, `scrollWidth=clientWidth=70`; nao trunca. [codigo] `statusbar.js:8` removeu "by Felipe"; CSS mobile oculta o relogio em `ios9.css:1121-1124`. |
| P2.12 "Sem transicao / gapless" truncado | feito | [ao vivo] Em 320x568, a linha Transicao tem `scrollWidth=clientWidth=309`, select `scrollWidth=clientWidth=209`, e o texto selecionado e "Sem transicao / gapless". [codigo] `settings.js:63-67`, largura do select em `ios9.css:267-268` e `ios9.css:553`. |
| P2.13 Secoes duplicadas "Player completo" | feito por caminho divergente | [ao vivo] Ajustes mostra "Barras de progresso" e "Layout do player completo". [codigo] `settings.js:149-197`. Falta decisao se esses nomes substituem os nomes do briefing. |
| P2.14 Contador de selecao sem nome | aberto | [codigo] `browse.js:65` renderiza `<span aria-live="polite">{{ selectionCount }}</span>`; `selectionCount` em `browse.js:220` e numero cru. Com selecao ativa, usuario de leitor de tela ouve "0" ou "1" sem substantivo. |
| P2.15 "Restaurar" ambiguo | feito | [codigo] UI usa "Importar" em `settings.js:223-237`; validacao de forma em `settings.js:453-507`; backup antes de gravar em `settings.js:518-537`. Nao ha `window.alert`/`window.confirm` nos arquivos JS. |
| P3.16 Barra de selecao movel | aberto | [codigo] Em container <=400px, "Selecionar" ocupa `grid-column:1/3` (`ios9.css:290-300`), confirmando o sintoma do briefing. Falta controle compacto com alvo minimo de 44px. |
| P3.17 Indice alfabetico movel | parcial | [codigo] O rail tem largura 28px e letras com `min-height:24px` (`ios9.css:351-359`); some quando `sortKey === 'recent'` (`browse.js:229-233`). Falta reducao dinamica da lista de letras em telas baixas. |
| P3.18 Ordenacao ambigua | aberto | [codigo] Botao usa titulo da acao seguinte e icone `↑/↓`, sem `aria-label` nem `aria-pressed` (`browse.js:59-61`). Com ordem crescente, o usuario ve `↑` e tooltip "Ordem decrescente", ambiguidade entre estado e acao. |
| P3.19 Playlists extensas | aberto | [codigo] Lista carrega ate 500 playlists (`playlists.js:259-263`) sem filtro local; nomes Qobuz ficam como nome da playlist (`playlists.js:84-87`), sem badge de origem. |
| P3.20 Mini player parado | feito por caminho divergente | [ao vivo] Com faixa carregada e modo parado, mini player mostra a faixa e transportes; "Nada tocando" so aparece sem faixa. [codigo] `miniplayer.js:8-26`, `miniplayer.js:58-69`, `miniplayer.js:105`. Falta decisao se deve tambem mostrar "Parado · N na fila". |
| P3.21 Configuracoes avancadas legadas | parcial | [codigo] Iframe preserva toolbar Echo Classic e botao de voltar (`settings.js:8-17`, `settings.js:401-410`); CSS preenche area util (`ios9.css:527-533`). [ao vivo] Em 320x568, Ajustes informa que paginas nativas abrem dentro dos Ajustes. [nao verificado] Nao abri o iframe nesta sessao; falta homologar 320, 768, 1024 e desktop. |

## 3. Achados anteriores nao cobertos pelos 21 itens

| Achado anterior | Veredito | Evidencia |
|---|---|---|
| Voltar do navegador reentra na navegacao | confirmado aberto | [codigo] `push()` usa `history.pushState` (`nav.js:53-57`), enquanto `back()` da navbar faz `pop()` e `history.replaceState` (`nav.js:86-96`). Cenario: artista -> album, dois voltars da navbar, depois Voltar do navegador restaura frame antigo via `popstate` (`nav.js:105-116`). |
| Pilha zerada em toda entrada lateral | confirmado aberto | [codigo] `LmsNav.reset('musica')` aparece antes de entradas em `browse.js:412-415`, `browse.js:470-474`, `detail.js:111-117`, `albumblock.js:209-226`, `search.js:152-158` e `app.js:110-113`. Cenario: de um album, abrir artista relacionado apaga a trilha anterior. |
| Perda silenciosa de dados na paginacao | confirmado aberto | [codigo] Tetos sem indicador: artistas/albuns ate 10000 (`browse.js:512-527`, `browse.js:633-681`), Recentes 250 (`browse.js:708`), generos 2000 (`browse.js:720-723`), anos 500 (`browse.js:725-729`), detalhe 1000 (`detail.js:191`), faixas por album 500 (`albumblock.js:263-267`), OPML 200 (`opmlview.js:163-165`, `opmlview.js:183`), playlists 500 (`playlists.js:259-263`). |
| Albuns sem artista somem do agrupamento por artista | confirmado aberto | [codigo] `api.js:196-201` descarta artistas sem nome; `browse.js:659-666` retorna `null` quando nao acha artista no indice. Cenario: album com artista vazio aparece por Album e desaparece por Artista. |
| Zero elementos `<h1>`-`<h6>` | confirmado aberto | [ao vivo] `document.querySelectorAll('h1,h2,h3,h4,h5,h6').length` retornou 0 no LMS real. [codigo] templates usam `div`/`span` para titulos, por exemplo `app.js:13-16`, `detail.js:21-28`, `settings.js:20`. |
| `lms-detail` sem token de requisicao | confirmado aberto | [codigo] `detail.js:71-72` recarrega ao trocar `frame`, mas `load()` (`detail.js:141-204`) nao tem `requestToken`; respostas lentas podem sobrescrever a tela atual. |
| Tipografia 100% em pixels | confirmado aberto | [calculado] `rg` encontrou 141 declaracoes `font-size`/`font` em `px` em `ios9.css`; nao ha migracao para `rem`. [codigo] exemplos funcionais: statusbar `ios9.css:159-160`, abas `ios9.css:671-672`, badges `ios9.css:663-665`. |

## 4. Achados novos

NOVO-1 — Versao em memoria do LMS diverge da versao em disco. [ao vivo] O HTML ao vivo injeta `LMS_SKIN_VERSION="3.0.0"` e Ajustes mostra "Versao da skin 3.0.0". [codigo] Disco ativo e repo tem `Plugin.pm:50` retornando 3.0.1 e `install.xml:6` em 3.0.1. Cenario: revisor abre a skin publicada, ve 3.0.0 e conclui que a instalacao nao esta na versao de submissao.

NOVO-2 — Aviso Perl aparece dentro da UI. [ao vivo] O corpo da pagina mostra `[26-08-02 18:11:32.2924] Slim::Utils::Misc::msg ... Subroutine js_literal redefined...`. [codigo] `index.html:40-47` define `sub js_literal` dentro do template; recargas podem redefinir a sub. Cenario: usuario navega na skin e ve log tecnico no rodape da interface.

NOVO-3 — Arquivos obsoletos continuam na instalacao ativa. [codigo] `HTML/mojo/skinconfig.yml` e `HTML/_sonda.txt` ainda existem em `Plugins/EchoClassic`. Cenario: mesmo com fonte corrigido, o seletor de skins pode continuar listando "mojo" ate limpeza e reinicio.

NOVO-4 — O servidor ao vivo reporta skin 3.0.0 mas carrega assets com revisao `1785699694`. [ao vivo] Scripts carregam `?r=1785699694` enquanto a constante de versao e 3.0.0. [inferencia] Isso e consistente com assets novos em disco e modulo Perl antigo em memoria.

## 5. Divergencias de especificacao

Marca. Recomendacao: aceitar a remocao de "by Felipe" da barra. [ao vivo] Em 320x568 "Echo Classic" cabe completo. [codigo] A autoria permanece em `install.xml`/README, e `statusbar.js:8` fica estavel para uma skin oficial.

Nomes das secoes de player. Recomendacao: manter "Barras de progresso" e trocar, se desejado, para "Aparencia das barras de progresso"; manter "Layout do player completo". [codigo] `settings.js:149-197` ja evita o anglicismo "gauge" em texto visual e `aria-label`.

Mini player parado. Recomendacao: manter transportes quando ha faixa carregada, porque isso preserva acesso ao player cheio e acao imediata. Se o texto "Parado · N na fila" for requisito de produto, adiciona-lo como subtitulo quando `mode === 'stop'`, sem remover transportes nem desabilitar a abertura.

## 6. Backlog unificado, deduplicado e ordenado por dependencia/risco

| ID | Origem | Severidade | Arquivos afetados | Aceite verificavel | Bloqueia submissao |
|---|---|---|---|---|---|
| EC-BL-01 | PREV-op + NOVO-1/3 | P1 operacional | Instalacao ativa, reinicio LMS | Remover `HTML/mojo/skinconfig.yml`, `HTML/_sonda.txt`; reiniciar LMS; UI mostra 3.0.1; seletor nao lista "mojo"; `/mojo/` e `/echoclassic/` continuam abrindo. | sim |
| EC-BL-02 | NOVO-2 | P1 | `index.html` ou `Plugin.pm` | Recarregar `/echoclassic/` 5 vezes nao mostra `Subroutine js_literal redefined` no DOM nem console/rodape. | sim |
| EC-BL-03 | REV-P1.2 + PREV-a11y | P1 | `browse.js`, `albumblock.js`, `search.js`, `playlists.js`, `queue.js`, CSS | Script DOM em telas Musica, Busca, Album, Playlist e Fila retorna 0 para `[role="button"] button, button button`; linha principal e menu sao controles irmaos; Enter/Espaco funcionam. | sim |
| EC-BL-04 | REV-P1.1 | P1 | `ios9.css`, `nowplaying.js`, `queue.js` | Em 1024x768, sem e com fila embutida, capa/titulo/artista/gauge/transporte/volume/acoes primarias tem retangulos dentro do viewport; overflow so em conteudo secundario. | sim |
| EC-BL-05 | REV-P2.4 | P2 | `queue.js`, `miniplayer.js` | Fila com 12 itens parada mostra titulo visual "Fila de reproducao", contador "12 faixas · 1 h 3 min restantes", texto "Play iniciara: <faixa>"; acoes redundantes ocultas. | sim |
| EC-BL-06 | REV-P2.14 + P3.18 | P2 | `browse.js` | Contador anuncia "Nenhum/1/N itens selecionados"; ordenacao informa estado atual com `aria-pressed`/`aria-label` e tooltip da proxima acao. | sim |
| EC-BL-07 | REV-P2.9 | P2 | `ui.js`, `navbar.js`, `tabbar.js`, `app.js` | Busca aberta nao deixa tab comum visualmente selecionada; Cancelar/Escape restauram foco e scroll da tela de origem. | sim |
| EC-BL-08 | REV-P2.7/P2.8 | P2 | `search.js`, `api.js`, possivel helper novo | Teste com "Acqua" ordena exata/inicio/parcial/demais; faixas repetidas exibem titulo, artista, album e origem/formato quando relevante; album mostra artista e ano. | sim |
| EC-BL-09 | REV-P2.6 + PREV-i18n | P2 | `index.html`, `strings.txt`, todos os JS com strings | `lang` vem do LMS; strings da skin sao centralizadas; TuneIn respeita idioma quando o LMS fornecer; nao ha mistura silenciosa pt/en nos itens conhecidos. | sim para oficial |
| EC-BL-10 | PREV-A1/A2 | P2 | `nav.js`, chamadas `LmsNav.reset` | Voltar do navegador sai da pagina ou percorre estados na mesma ordem da UI; abrir artista relacionado preserva caminho de volta. | sim |
| EC-BL-11 | PREV-A15 | P2 | `detail.js` | Duas navegacoes rapidas para detalhes diferentes nunca deixam cabecalho de um item com grade de outro; teste usa respostas fora de ordem. | sim |
| EC-BL-12 | PREV-A9/A10 | P2 | `api.js`, `browse.js`, `detail.js`, `albumblock.js`, `opmlview.js`, `playlists.js`, `store.js` | Quando ha mais itens que o teto, UI mostra "Carregar mais" ou aviso de limite; albuns sem artista aparecem em agrupamento "Sem artista" ou equivalente. | sim |
| EC-BL-13 | REV-P2.10/P3.17 | P3 | `browse.js`, `ios9.css` | Carrossel inicia em scrollLeft 0, primeiro/ultimo cards alcancaveis, snap sem deslocamento residual; rail reduz letras conforme altura ou se oculta sem sobrepor. | nao, mas recomendado |
| EC-BL-14 | REV-P3.16/P3.19 | P3 | `browse.js`, `playlists.js`, `ios9.css` | Em 320px, selecao usa controle compacto 44px; com >30 playlists aparece filtro local; Qobuz vira badge/origem, nao prefixo repetitivo. | nao |
| EC-BL-15 | PREV-tipografia + semantica | P2/P3 | `ios9.css`, templates JS | Tipografia funcional usa `rem` com pisos legiveis; ao menos um `<h1>` por tela e headings coerentes aparecem na arvore de acessibilidade. | sim para acessibilidade oficial |
| EC-BL-16 | REV-P3.21 | P3 | `settings.js`, `ios9.css` | Iframe avancado abre com toolbar Echo, botao voltar sempre visivel, sem corte em 320/768/1024/desktop; texto informa que conteudo e do LMS. | nao, mas recomendado |

## 7. Plano minimo de testes

Hoje nao ha `tests/`. Proposta de suite `node --test`:

Sem navegador:

1. `tests/fingerprint.test.js`: calcula SHA/tamanho dos arquivos criticos e falha se `.github/workflows/validate.yml` estiver ausente numa arvore preparada para release.
2. `tests/templates-static.test.js`: extrai templates Vue e falha em controles aninhados (`[role="button"] button`, `button button`) por analise de template ou por renderizacao com `vue-template-compiler` quando instalado.
3. `tests/search-ranking.test.js`: isola uma funcao pura de ranking e cobre exata, inicio, parcial e demais, incluindo "Acqua".
4. `tests/import-validation.test.js`: extrai/duplica validadores de importacao para rejeitar `pins` objeto, `nav` string, JSON invalido e arquivo sem chaves reconhecidas.
5. `tests/format-i18n.test.js`: cobre `duration`, `longDuration`, `rate`, `depth` e evita regressao de pluralizacao basica.
6. `tests/pagination-limits.test.js`: simula paginas com `sourceCount === pageSize` e exige estado `hasMore`/aviso em vez de fim silencioso.

Com navegador:

1. `tests/browser/player-layout.test.js`: abre LMS ou fixture HTML, aplica viewports 320x568, 375x667, 768x1024, 1024x768, 1280x720, 1512x805; mede retangulos do player sem/com fila.
2. `tests/browser/a11y-dom.test.js`: percorre Musica, Busca, Fila, Playlists, Ajustes e garante zero controles interativos aninhados, headings presentes, foco visivel e Escape fechando a camada superior.
3. `tests/browser/search-continuity.test.js`: abre busca a partir de uma tela rolada, digita, cancela e verifica foco/scroll/tabbar.
4. `tests/browser/queue-states.test.js`: fixture com fila parada valida titulo, contador, acao Play e fechamento por botao/Escape/backdrop.
5. `tests/browser/settings-mobile.test.js`: 320px valida marca, Transicao, secoes do player e iframe de configuracoes avancadas.

[calculado] Validacao executada nesta sessao: sintaxe JavaScript passou nos 20 arquivos; referencias entre modulos passaram; contraste passou nos 15 pares. [nao verificado] A compilacao de templates Vue foi pulada porque `vue-template-compiler` nao estava instalado e a sessao ficou sem rede/cache para instala-lo.
