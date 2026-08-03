# Avaliacao de publicacao — Echo Classic 3.1.0

Data: 02/08/2026

## Veredito

A versao 3.1.0 esta pronta para gerar uma release candidata e para publicacao
oficial em instalacoes de um player. Os fluxos de troca de player, sincronizacao e
transferencia ainda precisam de aceite em uma instalacao com dois players antes de
serem anunciados como verificados. [nao verificado]

O artefato `dist/EchoClassic-3.1.0.zip` contem `EchoClassic` na raiz, passou no
teste de integridade e tem SHA-1
`c2b705ea7efec7e76f19316ceec5b85fe81ed7d3`, registrado em `repo.xml`.
[medido]

O checkout nao possui remoto Git configurado. O destino `fdfreitas88/echoclassic`
foi definido a partir da identidade Git local e do e-mail do projeto; deve ser
confirmado antes do upload caso a release pertença a uma organizacao. [medido]

## Impressao digital inicial

Antes das alteracoes, o apendice A foi comparado ao commit `2eea0b7`: 46 arquivos
esperados, 46 encontrados, sem arquivo ausente, excedente ou checksum divergente.
[calculado, comparacao SHA-256 e tamanho]

## Reproducao real

Passaram em um player conectado: play com tempo avancando, pause mantendo a
posicao, seek, volume durante polling, anterior, proxima, fim da faixa avancando a
fila, reproducao de arquivo local e reproducao de item Qobuz. O tempo restante da
fila caiu junto com o tempo decorrido. [ao vivo]

O cancelamento do gesto no seek restaurou a leitura anterior e nao congelou
`dragTime`. [ao vivo]

Ao fim da sessao, faixa corrente, indice da fila, posicao, volume e modo de
reproducao voltaram ao estado inicial. [ao vivo]

Nao foram exercitados troca de player, sincronizacao e transferencia porque a
instalacao expunha apenas um player. Tambem nao havia um stream real com duracao
zero; o comportamento limitado para esse caso foi conferido apenas na formatacao e
no codigo. [nao verificado]

## Testes automatizados

`npm test` executa 6 testes e os 6 passam. [medido]

- `format.js`: duracao com horas, `longDuration` sem 60 minutos, profundidade no
  plural e capa em tamanhos arbitrarios. [medido]
- `strings.txt` e `i18n.js`: parser PT/EN, expressao com `||` envolvida por `$t()`
  e filtro Vue com `|` preservado. [medido]
- Importacao de preferencias: rejeicao de valores malformados. [medido]
- Busca: relevancia e enriquecimento de album e faixa. [medido]
- Estrutura: ausencia das regressoes conhecidas de controles aninhados, player,
  fila, busca e Favoritos. [medido]

Os cinco viewports foram medidos ao vivo, mas ainda nao fazem parte de um teste de
navegador executavel no CI. Reproducao, historico nativo, foco, troca de player,
sincronizacao e transferencia tambem nao possuem automacao de navegador.
[nao verificado]

## Navegacao

1. O defeito push/replace foi refutado no estado recebido: `back()` chama o
   historico nativo quando o estado e a profundidade coincidem, e `popstate`
   restaura a pilha correspondente. Voltar de profundidade 2 para 1 preservou o
   quadro anterior. [ao vivo]
2. Os resets antes de abrir artista ou artista relacionado foram reproduzidos no
   codigo e removidos em `detail.js` e `albumblock.js`; o caminho anterior passou a
   ser preservado. Resets que representam troca explicita de raiz foram mantidos.
   [ao vivo]
3. Em profundidade 1, quando quadro e raiz repetem o mesmo rótulo, o Voltar agora
   usa o nome da aba. Na sessao em ingles, exibiu `My Music` em vez de repetir o
   titulo. [ao vivo]

## Interface, idioma e busca

Resultados de album mostram artista e ano. Resultados de faixa mostram artista,
album, duracao e origem; respostas incompletas sao enriquecidas por consultas ao
servidor. [ao vivo]

A origem local foi traduzida na sessao em ingles. `strings.txt` possui 258 entradas
de interface com PT e EN, incluindo a nova acao de Favoritos. [calculado, contagem
de chaves `ECHOCLASSIC_UI_`]

Favoritos vazio oferece `Open My Music`/`Abrir Minha Música` e a acao abre a raiz de
Minha Musica. [ao vivo]

Nos viewports 390x844, 430x932, 768x1024, 1024x768 e 1366x900 houve zero overflow
horizontal, zero controle interativo aninhado, zero botao sem nome, player completo
contido e cabecalho da fila sem sobreposicao em 390 px. [medido, DOM]

O console ficou sem erros e avisos durante a sessao. [ao vivo]

## Portoes de validacao

`npm run validate` terminou com `TUDO PASSA`. [medido]

- Sintaxe: 21 arquivos JavaScript aprovados. [calculado, `node --check`]
- Templates: 18 compilados, zero erro. [calculado,
  `vue-template-compiler@2.7.15`]
- Modulos: nenhuma referencia orfa. [calculado, `tools/check-modules.js`]
- Contraste: 15 de 15 pares aprovados. [calculado,
  `tools/check-contrast.py`]

O validador agora falha se o compilador nao puder ser instalado; ele nao relata
mais sucesso quando o segundo portao foi pulado. O fluxo automatizado executa os
testes, os quatro portoes e a consistencia da versao. [código]

## Reavaliacao

| Item | Antes | Agora | Evidencia |
|---|---:|---:|---|
| Empacotamento do plugin no LMS | 9 | 9,5 | ZIP integro, versao e SHA consistentes. [medido] |
| Privacidade e seguranca do repositorio | 9 | 9 | Varredura preservada; sem mudanca de superficie. [medido] |
| Contraste WCAG AA | 9 | 9 | 15/15 pares passam. [calculado] |
| Layout e responsividade | 8 | 9 | Cinco viewports passam. [medido] |
| Higiene do repositorio | 8 | 9 | Dependencias fixadas e validacao continua. [medido] |
| Fila de reproducao | 8 | 9 | Avanco e tempo restante observados em movimento. [ao vivo] |
| Player completo | 8 | 9 | Transporte, seek e volume exercitados. [ao vivo] |
| Internacionalizacao | 7 | 9 | Busca, origem e Favoritos conferidos em ingles. [ao vivo] |
| Estados vazio, erro e carregamento | 7 | 8,5 | Favoritos acionavel; demais estados preservados. [ao vivo] |
| Robustez da camada de dados | 7 | 8 | Busca incompleta enriquecida e coberta por teste. [medido] |
| Acessibilidade estrutural | 6 | 8 | Estrutura e cinco viewports sem regressoes. [medido] |
| Busca | 6 | 8,5 | Resultados distinguiveis e testados. [ao vivo] |
| Documentacao | 6 | 9 | README, changelog e aceite de release atualizados. [medido] |
| Desempenho | 5 | 5 | Sem perfil de CPU, rede ou memoria nesta passada. [nao verificado] |
| Navegacao e continuidade | 4 | 8,5 | Tres suspeitas decididas e fluxo exercitado. [ao vivo] |
| Verificacao funcional de reproducao | 2 | 8,5 | Um player amplamente exercitado; multiplos players pendentes. [ao vivo] |
| Testes automatizados | 1 | 7 | 6/6, CI e portoes; navegador ainda manual. [medido] |

## Aceite restante

Antes de chamar a release de verificada em ambiente multiponto, conectar dois
players e registrar: troca mantendo estado isolado, criacao e dissolucao de grupo,
transferencia de fila e reproducao, e restauracao dos dois estados ao terminar.
[nao verificado]
