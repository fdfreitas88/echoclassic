#!/bin/bash
# Instala o Echo Classic deste checkout no diretorio de plugins do LMS.
#
# Usa rsync sem --delete de proposito: se um dia o repositorio deixar de trazer
# algum arquivo que a instalacao tem, e melhor deixar o arquivo orfao para tras
# do que apagar algo que o servidor esteja usando. Para uma instalacao limpa,
# apague a pasta de destino antes de rodar.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="${1:-$HOME/Library/Application Support/Squeezebox/Plugins}"
[ -d "$DEST" ] || { echo "ERRO: diretorio de plugins nao existe: $DEST"; exit 1; }

if pgrep -f 'slimserver\.pl' >/dev/null 2>&1; then
  echo "AVISO: o servidor esta rodando."
  echo "       CSS e JavaScript entram no proximo reload da pagina, porque o"
  echo "       Plugin.pm carimba cada asset com o mtime mais novo da arvore."
  echo "       Plugin.pm, Settings.pm, strings.txt e a pagina de ajustes so"
  echo "       entram depois de reiniciar o servidor."
fi

rsync -a --exclude '.DS_Store' EchoClassic/ "$DEST/EchoClassic/"
echo "[ok] instalado em $DEST/EchoClassic"

# Restos de versoes anteriores que precisam sumir, nao ser sobrescritos.
for stale in "HTML/mojo/skinconfig.yml" "HTML/echoclassic/html/js/layers.js"; do
  if [ -e "$DEST/EchoClassic/$stale" ] && [ ! -e "EchoClassic/$stale" ]; then
    rm -f "$DEST/EchoClassic/$stale"
    echo "[ok] removido resto de versao anterior: $stale"
  fi
done

echo
echo "Reinicie o servidor e abra:  http://localhost:9000/echoclassic/"
