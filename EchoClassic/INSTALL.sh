#!/bin/bash
# Instala o EchoClassic na pasta de plugins por usuário do LMS.
# Fora do gerenciador de plugins de propósito: desinstalar é apagar a pasta.
set -uo pipefail
DEST="$HOME/Library/Application Support/Squeezebox/Plugins"
BACKUP_ROOT="$HOME/Library/Application Support/Squeezebox/EchoClassic Backups"
SRC="$(cd "$(dirname "$0")" && pwd)"
[ -f "$SRC/install.xml" ] || { echo "ERRO: rode este script de dentro da pasta EchoClassic"; exit 1; }
if find "$DEST" -maxdepth 1 -type d -name 'EchoClassic.backup-*' -print -quit 2>/dev/null | grep -q .; then
  echo "ERRO: existem backups do EchoClassic dentro de $DEST"
  echo "Mova-os para $BACKUP_ROOT antes de instalar; copias concorrentes confundem o LMS."
  exit 1
fi
if pgrep -f 'slimserver\.pl' >/dev/null 2>&1; then
  echo "AVISO: o servidor está rodando. A cópia funciona, mas o skin só aparece após reiniciar."
fi
mkdir -p "$DEST" || exit 1
if [ -d "$DEST/EchoClassic" ]; then
  BK="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BK" || exit 1
  mv "$DEST/EchoClassic" "$BK/"
  echo "[ok] versão anterior movida para $BK"
fi
ditto "$SRC" "$DEST/EchoClassic" || exit 1
rm -f "$DEST/EchoClassic/INSTALL.sh"
echo "[ok] instalado em $DEST/EchoClassic"
echo
echo "Reinicie o servidor pelo ícone da barra de menus e abra:"
echo "   http://localhost:9000/echoclassic"
echo "   http://$(ipconfig getifaddr en0 2>/dev/null || echo '<ip>'):9000/echoclassic"
echo
echo "Desinstalar:  rm -rf \"$DEST/EchoClassic\"  e reiniciar o servidor."
