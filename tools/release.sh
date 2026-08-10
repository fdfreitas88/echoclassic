#!/bin/bash
# Deixa uma versao pronta para ir ao GitHub: sobe a versao nos arquivos que
# precisam, roda os portoes, empacota o zip e grava o SHA-1 no repo.xml.
#
# Nao faz nada de rede. Ao final imprime os comandos de git e gh para voce
# conferir e rodar.
#
# Uso:
#   tools/release.sh 3.1.3          prepara a 3.1.3
#   tools/release.sh 3.1.3 -n       mostra o que faria, sem escrever
#   tools/release.sh 3.1.3 -s       pula npm test e npm run validate
#   tools/release.sh 3.1.3 -d       permite arvore suja
#
# Armadilhas que este script existe para fechar:
#   - versao precisa bater em install.xml, Plugin.pm, repo.xml e CHANGELOG.md;
#     publicar conteudo novo sob um numero ja usado faz as instalacoes existentes
#     nunca receberem a atualizacao;
#   - <enforce> no install.xml faz o ExtensionsManager pular o plugin, e ele
#     nunca aparece em Plugins Ativos;
#   - <category>skin</category> fora do repo.xml faz a pagina de plugins esconder
#     a entrada sempre que alguma categoria estiver selecionada;
#   - <sha> diferente do arquivo publicado e a causa usual de o LMS baixar e
#     entao recusar o plugin.
set -euo pipefail
cd "$(dirname "$0")/.."
. tools/lib/echo.sh

VERSION=""; DRY=0; SKIP_GATES=0; ALLOW_DIRTY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run)     DRY=1 ;;
    -s|--skip-gates)  SKIP_GATES=1 ;;
    -d|--allow-dirty) ALLOW_DIRTY=1 ;;
    -h|--help)        sed -n '2,17p' "$0"; exit 0 ;;
    -*) die "opcao desconhecida: $1" ;;
    *)  VERSION="$1" ;;
  esac
  shift
done

[ -n "$VERSION" ] || die "informe a versao. Ex.: tools/release.sh 3.1.3"
printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
  || die "versao '$VERSION' nao e X.Y.Z"

CURRENT="$(local_version)"
ZIP="dist/EchoClassic-$VERSION.zip"
TAG="v$VERSION"
# A unica URL que o repo.xml publicado pode carregar. Fica aqui, calculada da
# versao, para o bump e o portao de publicacao lerem a mesma coisa.
EXPECTED_URL="https://github.com/fdfreitas88/echoclassic/releases/download/$TAG/EchoClassic-$VERSION.zip"

# ---------------------------------------------------------------- 1. estado
bold "1/7  estado do repositorio"
info "versao atual: $CURRENT  ->  nova: $VERSION"
[ "$CURRENT" = "$VERSION" ] && warn "a versao ja e $VERSION; os arquivos nao mudam, mas o zip e o SHA sao refeitos"

# O || true nao e decorativo: com pipefail, um grep que nao acha nada derruba a
# linha inteira, e arvore limpa e exatamente o caso em que ele nao acha nada.
DIRTY="$(git status --porcelain | grep -v '^?? ' | wc -l | tr -d ' ' || true)"
if [ "$DIRTY" != "0" ] && [ "$ALLOW_DIRTY" -eq 0 ]; then
  git status --short | grep -v '^?? ' | sed 's/^/    /' || true
  die "arvore suja. Commite antes, ou use -d se for de proposito."
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  die "a tag $TAG ja existe. Publicar conteudo novo sob um numero usado faz as instalacoes existentes nunca receberem a atualizacao."
fi

# ---------------------------------------------------------------- 2. changelog
bold "2/7  CHANGELOG"
if grep -q "^## \[$VERSION\]" CHANGELOG.md; then
  info "ok    secao [$VERSION] encontrada"
else
  die "CHANGELOG.md nao tem a secao '## [$VERSION]'. Escreva a entrada antes -- e ela que
  registra como cada efeito foi comprovado, e nenhum script sabe escrever isso."
fi

# ---------------------------------------------------------------- 3. bump
bold "3/7  versao nos arquivos"
if [ "$DRY" -eq 1 ]; then
  info "(dry-run) install.xml, Plugin.pm e repo.xml iriam para $VERSION"
else
  sed -i '' "s|<version>[^<]*</version>|<version>$VERSION</version>|" "$SRC/install.xml"
  sed -i '' "s|sub getSkinVersion { return '[^']*' }|sub getSkinVersion { return '$VERSION' }|" "$SRC/Plugin.pm"
  sed -i '' "s|<plugin name=\"EchoClassic\" version=\"[^\"]*\"|<plugin name=\"EchoClassic\" version=\"$VERSION\"|" repo.xml
  # A <url> inteira, e nao so o numero dentro dela. O sed anterior casava
  # apenas uma URL que ja fosse publica, entao um <url> apontando para um zip
  # local (private-candidate/EchoClassic-3.2.8.zip) atravessava o bump intacto
  # e chegava ao descritor publicado. Ver PUB-01.
  PREVIOUS_URL="$(sed -n 's|.*<url>\([^<]*\)</url>.*|\1|p' repo.xml)"
  [ "$PREVIOUS_URL" = "$EXPECTED_URL" ] \
    || warn "a <url> era '$PREVIOUS_URL' e foi reescrita. Confira no diff antes de publicar."
  sed -i '' "s|<url>[^<]*</url>|<url>$EXPECTED_URL</url>|" repo.xml
  info "install.xml, Plugin.pm, repo.xml"
fi

# ---------------------------------------------------------------- 4. invariantes
bold "4/7  invariantes de publicacao"
grep -q '<enforce>' "$SRC/install.xml" \
  && die "<enforce> voltou ao install.xml. Com ele o plugin nunca aparece em Plugins Ativos."
info "ok    sem <enforce> no install.xml"

grep -q '<category>skin</category>' repo.xml \
  || die "<category>skin</category> sumiu do repo.xml. Sem ela a pagina de plugins esconde a entrada."
info "ok    <category>skin</category> presente"

# PUB-01. O descritor de 3.2.8 chegou pronto para publicar dizendo
# literalmente "PRIVATE 3.2.8 QA CANDIDATE ... Do not publish" e apontando para
# private-candidate/EchoClassic-3.2.8.zip. Nenhum portao reparou: check-version
# so compara numeros, e a contagem de arquivos do zip nao olha para a <url>. Um
# repo.xml assim publicado da erro de download em toda instalacao existente.
if [ "$DRY" -eq 1 ] && ! grep -q "<url>$EXPECTED_URL</url>" repo.xml; then
  warn "a <url> ainda nao e a publica; o bump (passo 3) a reescreveria para:"
  info "$EXPECTED_URL"
fi
if [ "$DRY" -eq 0 ]; then
  grep -q "<url>$EXPECTED_URL</url>" repo.xml \
    || die "a <url> do repo.xml nao e a URL publica da release $TAG. Esperado:
  $EXPECTED_URL"
  info "ok    <url> publica de $TAG"
fi

grep -qi 'private-candidate\|do not publish\|nao publique' repo.xml \
  && die "repo.xml ainda carrega marca de candidato privado. Um descritor que diz
  para nao ser publicado nao pode ser o descritor publicado."
info "ok    sem marca de candidato privado no repo.xml"

# ---------------------------------------------------------------- 5. portoes
bold "5/7  portoes"
if [ "$SKIP_GATES" -eq 0 ]; then run_gates; else info "(pulados por -s)"; fi
if [ "$DRY" -eq 0 ]; then
  node tools/check-version.js || die "versoes inconsistentes"
else
  info "(dry-run) check-version rodaria aqui"
fi

# ---------------------------------------------------------------- 6. pacote
bold "6/7  pacote"
EXPECTED="$(find "$SRC" -type f ! -name INSTALL.sh ! -name '.DS_Store' | wc -l | tr -d ' ')"
if [ "$DRY" -eq 1 ]; then
  info "(dry-run) geraria $ZIP com $EXPECTED arquivos"
else
  mkdir -p dist
  rm -f "$ZIP"
  # A pasta EchoClassic vai na raiz do zip: e assim que o LMS espera receber.
  zip -rq "$ZIP" "$SRC" -x "$SRC/INSTALL.sh" -x '*.DS_Store'
  IN_ZIP="$(unzip -Z1 "$ZIP" | grep -vc '/$' || true)"
  [ "$IN_ZIP" = "$EXPECTED" ] \
    || die "o zip tem $IN_ZIP arquivos e a arvore tem $EXPECTED. A diferenca precisa ser explicada antes de publicar."
  info "$ZIP  —  $IN_ZIP arquivos, $(wc -c <"$ZIP" | tr -d ' ') bytes"

  # PUB-01. A contagem nao pega o caso que motivou este portao: o zip de 3.2.8
  # tinha exatamente o numero certo de arquivos e conteudo anterior ao HEAD --
  # o ios9.css e o actions.js empacotados nao eram os do repositorio, e o SHA-1
  # gravado conferia com o pacote errado. So comparacao de conteudo enxerga
  # isso.
  VERIFY="$(mktemp -d)"
  trap 'rm -rf "$VERIFY"' EXIT
  unzip -qq "$ZIP" -d "$VERIFY"
  DRIFT="$(diff -r "$SRC" "$VERIFY/$SRC" 2>&1 \
    | grep -v 'INSTALL.sh' | grep -v '.DS_Store' || true)"
  if [ -n "$DRIFT" ]; then
    printf '%s\n' "$DRIFT" | head -40 | sed 's/^/    /'
    die "o pacote nao e a arvore que o gerou. Publicar assim entrega um artefato
  diferente do que foi testado -- foi exatamente o que a 3.2.8 fez."
  fi
  rm -rf "$VERIFY"
  trap - EXIT
  info "ok    pacote identico a arvore"
fi

# ---------------------------------------------------------------- 7. sha
bold "7/7  SHA-1 no repo.xml"
if [ "$DRY" -eq 1 ]; then
  info "(dry-run) o <sha> receberia o SHA-1 do zip"
else
  SHA="$(shasum -a 1 "$ZIP" | awk '{print $1}')"
  sed -i '' "s|<sha>[^<]*</sha>|<sha>$SHA</sha>|" repo.xml
  info "$SHA"
  GRAVADO="$(sed -n 's|.*<sha>\([^<]*\)</sha>.*|\1|p' repo.xml)"
  [ "$GRAVADO" = "$SHA" ] || die "o <sha> gravado ($GRAVADO) nao bate com o zip ($SHA)"
  info "ok    <sha> confere com o arquivo"
  node tools/check-version.js
fi

if [ "$DRY" -eq 1 ]; then printf "\n\033[33mdry-run: nada foi escrito\033[0m\n"; exit 0; fi

printf "\n"
ok "$VERSION preparada"
cat <<FIM

Confira o diff e publique:

  git add $SRC/install.xml $SRC/Plugin.pm repo.xml CHANGELOG.md
  git commit -m "release: $VERSION"
  git tag $TAG
  git push origin main --tags
  gh release create $TAG $ZIP --title "Echo Classic $VERSION" --notes-file <(sed -n "/^## \[$VERSION\]/,/^## \[/p" CHANGELOG.md | sed '\$d')

O zip nao entra em commit: dist/ esta no .gitignore e o arquivo viaja como
asset da release.

Depois de publicar, no servidor:
  - o repositorio precisa estar em Ajustes > Plugins > Repositorios adicionais:
    https://raw.githubusercontent.com/fdfreitas88/echoclassic/main/repo.xml
  - o LMS so procura atualizacao uma vez por dia (checkVersionInterval 86400),
    entao reinicie o servidor para forcar uma leitura nova;
  - o raw.githubusercontent.com ja serviu repo.xml de duas versoes atras vindo de
    cache de CDN. Confira pelo caminho da tag, ou com uma query cache-busting.
FIM
