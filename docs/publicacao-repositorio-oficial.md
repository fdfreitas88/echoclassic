# Entrar no repositório oficial de plugins do LMS

O que o projeto precisa ter, o que já tem, e o que falta — verificado contra o
código do agregador e contra plugins que já estão lá dentro, não de memória.

## Como a inclusão funciona

Não se envia o plugin. Envia-se a **URL do seu `repo.xml`**, e um robô passa de
poucas em poucas horas juntando todos os `repo.xml` da lista num `extensions.xml`
único, que é o que todo LMS lê por padrão.

| | |
|---|---|
| Repositório | `LMS-Community/lms-plugin-repository` |
| Arquivo a editar | `include.json`, no vetor `repositories` |
| O que acrescentar | `https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml` |
| Como | pull request |
| Quem monta o resultado | `buildrepo.pl`, por GitHub Actions |

O `include.json` também tem um vetor `disabled`, para onde vão as entradas que
deixaram de responder — vale saber que sair da lista é assim, sem aviso.

## O que o agregador faz com o nosso `repo.xml`

Lido no `buildrepo.pl`:

- **Categoria é validada contra uma lista fechada.** Vale `radio`,
  `information`, `musicservices`, `tools`, `scanning`, `hardware`, `playlists`,
  `skin`, `misc`. Qualquer outra é **apagada** em silêncio e o plugin cai em
  `misc`. A nossa é `skin` — dentro da lista.
- **`installations` do autor é descartado** e substituído pela estatística da API
  da comunidade. Não adianta declarar.
- **Links para `wiki.slimdevices.com` e `forums.slimdevices.com`** são reescritos
  para os equivalentes em `lyrion.org`.
- `desc` e `title` sem `lang` são convertidos para a forma com idioma. Os nossos
  já vão com `lang`, em EN e PT.

E o `ExtensionsManager` do próprio servidor, que é quem instala:

- exige `name`, `url` e `version`; o resto é opcional, com `name` servindo de
  `title` quando falta;
- decide se a entrada se aplica pelo par `minTarget`/`maxTarget` da entrada do
  **`repo.xml`** — o `<targetApplication>` do `install.xml` não entra nessa
  conta (os plugins oficiais usam ali valores diferentes entre si:
  `SqueezeCenter`, `SlimServer`, `Logitech Media Server`);
- valida o download contra o `<sha>`. SHA divergente é a causa usual de "baixa e
  recusa".

## Checagem, item a item

| Requisito | Estado |
|---|---|
| Repositório público, com `repo.xml` em URL crua estável | **ok** |
| `repo.xml` válido, raiz `<extensions>` | **ok** |
| `name`, `version`, `minTarget`, `maxTarget` | **ok** — 3.2.1, 8.0, `*` |
| `<url>` apontando para asset de release | **ok** |
| `<sha>` batendo com o arquivo publicado | **ok** — conferido rebaixando o asset |
| `<category>` da lista fechada | **ok** — `skin` |
| `<title>` e `<desc>` com `lang` | **ok** — EN e PT |
| `<creator>`, `<email>`, `<link>` | **ok** |
| `<icon>` | **acrescentado nesta passada** |
| `install.xml` com `id`, `name`, `module`, `version`, `description`, `creator`, `defaultState`, `type`, `targetApplication` | **ok** |
| `install.xml` com `email`, `category`, `icon`, `optionsURL`, `homepageURL` | **acrescentado nesta passada** |
| Sem `<enforce>` no `install.xml` | **ok** — há teste de release travando isso |
| Zip com a pasta do plugin na raiz | **ok** — conferido contra a tag |
| Licença própria | **ok** — GPL-3.0-or-later |
| Dependência de terceiros declarada | **ok** — Vue 2 sob MIT, cabeçalho preservado e citado no README |
| Instalação pelo gerenciador de extensões, ponta a ponta | **ok** — o servidor real baixou do GitHub, conferiu o SHA e instalou sozinho |

## O que ainda falta antes de abrir o pull request

1. **Publicar uma 3.2.2.** O ícone e os campos novos do `install.xml` mudam o
   conteúdo do pacote, e o `<sha>` da 3.2.1 publicada deixa de valer para ele.
   Enviar a URL do `repo.xml` apontando para um pacote cujo SHA não confere é
   exatamente o modo de falha que o agregador não pega e o usuário final pega.
2. **Screenshots no README.** Não é exigência do agregador; é o que decide se
   alguém instala uma skin. Ficam em `docs/img/`.
3. **Decidir o `id` de `targetApplication`.** O nosso diz
   `Logitech Media Server`. Como o `ExtensionsManager` não olha esse campo, e
   como o plugin instala e roda em 9.1.1, não há motivo medido para mexer —
   fica registrado que os oficiais divergem entre si nesse ponto.

## O pull request, quando chegar a hora

```sh
gh repo fork LMS-Community/lms-plugin-repository --clone
# em include.json, acrescentar ao vetor "repositories":
#   "https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml"
gh pr create --repo LMS-Community/lms-plugin-repository \
  --title "Add Echo Classic skin repository" \
  --body "Echo Classic is a GPL-3.0 iOS 9 iPad Music skin for LMS 8.0+. \
Repository: https://github.com/fdfreitas88/echoclassic"
```

Depois de aceito, a entrada aparece sozinha no `extensions.xml` na próxima
passada do robô, e o plugin passa a ser oferecido sem o usuário precisar
acrescentar repositório nenhum à mão.
