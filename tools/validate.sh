#!/bin/bash
# Quatro portoes de validacao do Echo Classic. Roda sem rede depois da primeira vez.
# Uso: tools/validate.sh
set -uo pipefail
cd "$(dirname "$0")/.."
SKIN="EchoClassic/HTML/echoclassic/html"
fail=0
step() { printf "\n\033[1m== %s\033[0m\n" "$1"; }

step "1/4  sintaxe JavaScript"
while IFS= read -r f; do
  case "$f" in */lib/*) continue;; esac
  if node --check "$f" >/dev/null 2>&1; then
    printf "  ok    %s\n" "${f#$SKIN/}"
  else
    printf "  FALHA %s\n" "${f#$SKIN/}"; node --check "$f"; fail=1
  fi
done < <(find "$SKIN/js" -name '*.js' | sort)

step "2/4  templates Vue"
if [ ! -d node_modules/vue-template-compiler ]; then
  echo "  instalando vue-template-compiler (so na primeira vez)..."
  npm install --no-save --silent --no-fund --no-audit vue-template-compiler@2.7.16 || {
    echo "  PULADO: sem rede e sem vue-template-compiler instalado"; }
fi
if [ -d node_modules/vue-template-compiler ]; then
  node tools/check-templates.js || fail=1
fi

step "3/4  referencias entre modulos"
node tools/check-modules.js || fail=1

step "4/4  contraste WCAG"
python3 tools/check-contrast.py || fail=1

printf "\n"
if [ "$fail" -eq 0 ]; then printf "\033[32mTUDO PASSA\033[0m\n"; else printf "\033[31mHA FALHAS\033[0m\n"; fi
exit $fail
