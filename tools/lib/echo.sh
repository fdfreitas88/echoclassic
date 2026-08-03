#!/bin/bash
# Base comum de deploy.sh, rollback.sh e release.sh.
#
# Nao e executavel por conta propria: cada script faz `source tools/lib/echo.sh`
# e herda daqui a configuracao do servidor, os atalhos de ssh/JSON-RPC e o
# formato dos pontos de restauracao.

# ---------------------------------------------------------------- configuracao
# Sobrescreva pelo ambiente quando o servidor mudar de endereco:
#   ECHO_HOST=musicplayer@192.168.0.9 tools/deploy.sh
HOST="${ECHO_HOST:-musicplayer@10.73.254.20}"
HTTP_HOST="${ECHO_HTTP_HOST:-10.73.254.20:9000}"

# Caminho relativo ao $HOME do servidor. E aqui que o LMS extrai o que instala
# pelo gerenciador de plugins, e e daqui que ele le a skin.
REMOTE_PLUGIN="Library/Caches/Squeezebox/InstalledPlugins/Plugins/EchoClassic"

# Os pontos de restauracao ficam FORA de Plugins/: qualquer diretorio ali dentro
# e lido pelo LMS como um plugin, e uma copia velha do EchoClassic apareceria
# como um segundo plugin com o mesmo id.
BACKUP_ROOT="echoclassic-backups"

# Diretorio do plugin dentro deste repositorio.
SRC="EchoClassic"

SKIN_URL="http://$HTTP_HOST/echoclassic/"

# ---------------------------------------------------------------- saida
bold() { printf "\n\033[1m== %s\033[0m\n" "$1"; }
info() { printf "  %s\n" "$1"; }
warn() { printf "\033[33m  aviso: %s\033[0m\n" "$1"; }
ok()   { printf "\033[32m%s\033[0m\n" "$1"; }
die()  { printf "\033[31mERRO: %s\033[0m\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------- servidor
ssh_run() { ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" "$@"; }

require_host() {
  ssh_run true 2>/dev/null || die "sem ssh para $HOST (defina ECHO_HOST se o endereco mudou)"
}

# Fala com o LMS a partir do proprio servidor: o 127.0.0.1 la dentro e o
# servidor certo. Mirar 127.0.0.1 daqui acerta o LMS desta MacBook, que tem
# outra biblioteca e responde com resultado plausivel e errado.
lms_rpc() {
  ssh_run "curl -s -m 15 -X POST -H 'Content-Type: application/json' -d '$1' http://127.0.0.1:9000/jsonrpc.js"
}

# O getAssetRevision do Plugin.pm e o mtime mais novo debaixo de HTML/echoclassic.
# Se ele nao avancar, a URL dos assets nao muda e o navegador serve o JS anterior
# -- o teste passa a medir a versao antiga sem avisar.
asset_revision() {
  ssh_run "find \"\$HOME/$REMOTE_PLUGIN/HTML/echoclassic\" -type f -exec stat -f '%m' {} + | sort -n | tail -1" 2>/dev/null || echo 0
}

remote_version() {
  ssh_run "grep -o '<version>[^<]*</version>' \"\$HOME/$REMOTE_PLUGIN/install.xml\" 2>/dev/null | sed 's/<[^>]*>//g'" 2>/dev/null || true
}

local_version() { sed -n 's/.*<version>\([^<]*\)<\/version>.*/\1/p' "$SRC/install.xml"; }

remote_file_count() {
  ssh_run "find \"\$HOME/$REMOTE_PLUGIN\" -type f | wc -l | tr -d ' '" 2>/dev/null || echo 0
}

# ---------------------------------------------------------------- rsync
# -t preserva mtime, que e o que move o getAssetRevision. Permissao NAO e
# preservada de proposito: os arquivos deste repositorio sao 600 e a instalacao
# usa 644 -- copiar o 600 deixaria a arvore ilegivel para qualquer usuario que
# nao seja o do servidor, sem necessidade.
# --delete existe para que um arquivo removido do repositorio suma tambem do
# servidor; sem ele, um modulo apagado continuaria sendo servido.
# Array simples, e nao funcao: o bash do macOS e o 3.2, que nao tem mapfile.
# O --chmod com prefixo D/F e sintaxe do rsync 3.x, e so o rsync DAQUI (3.4.1) e
# quem interpreta essa opcao nesta direcao. O servidor tem o rsync 2.6.9 da
# Apple, que recusa esse formato -- por isso a copia interna do rollback usa
# REMOTE_RSYNC_OPTS, sem --chmod.
RSYNC_OPTS=(-rltD --chmod=D755,F644 --no-o --no-g
            --exclude 'INSTALL.sh' --exclude '.DS_Store' --delete)

# Copia de ponto de restauracao para a pasta do plugin: roda inteira dentro do
# servidor, no rsync 2.6.9. Preserva permissao (-p) porque a copia guardada ja
# tem a permissao correta, entao nao ha o que reescrever.
REMOTE_RSYNC="rsync -rlptD --delete --exclude '.DS_Store'"

# Roda um rsync de previa e MORRE se ele falhar. Sem isto, um erro de rsync --
# uma opcao que o servidor nao suporta, por exemplo -- vira previa vazia, previa
# vazia vira "nada a fazer", e o script relata sucesso sem ter feito nada.
rsync_preview() {
  local raw rc
  set +e
  raw="$("$@" 2>&1)"
  rc=$?
  set -e
  [ "$rc" -eq 0 ] || die "rsync falhou (codigo $rc):
$raw"
  printf '%s\n' "$raw" | grep -v '^$' || true
}

# ---------------------------------------------------------------- restauracao
# Layout de um ponto de restauracao no servidor:
#   ~/echoclassic-backups/<stamp>/tree/   copia fiel da pasta do plugin
#   ~/echoclassic-backups/<stamp>/META    versao, commit e origem
#   ~/echoclassic-backups/last            o <stamp> mais recente
# O tree/ e separado do META de proposito: metadado solto dentro da copia
# voltaria para dentro da pasta do plugin no rollback.
backup_now() {
  local stamp reason
  stamp="$(date +%Y%m%d-%H%M%S)"
  reason="${1:-deploy}"
  local commit; commit="$(git rev-parse --short HEAD 2>/dev/null || echo desconhecido)"
  local dirty;  dirty="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

  ssh_run "bash -s" <<REMOTE >/dev/null
set -e
D="\$HOME/$BACKUP_ROOT/$stamp"
mkdir -p "\$D/tree"
cp -Rp "\$HOME/$REMOTE_PLUGIN/." "\$D/tree/"
cat > "\$D/META" <<META
stamp=$stamp
motivo=$reason
versao_instalada=$(remote_version)
commit_local=$commit
arquivos_alterados_local=$dirty
criado_por=$(whoami)@$(hostname -s)
META
echo "$stamp" > "\$HOME/$BACKUP_ROOT/last"
REMOTE
  printf '%s' "$stamp"
}

list_backups() {
  ssh_run "bash -s" <<REMOTE
shopt -s nullglob
R="\$HOME/$BACKUP_ROOT"
LAST=""
[ -f "\$R/last" ] && LAST="\$(cat "\$R/last")"
found=0
for d in "\$R"/*/; do
  s="\$(basename "\$d")"
  [ -d "\$d/tree" ] || continue
  found=1
  v="\$(sed -n 's/^versao_instalada=//p' "\$d/META" 2>/dev/null)"
  m="\$(sed -n 's/^motivo=//p' "\$d/META" 2>/dev/null)"
  c="\$(sed -n 's/^commit_local=//p' "\$d/META" 2>/dev/null)"
  n="\$(find "\$d/tree" -type f | wc -l | tr -d ' ')"
  mark=" "; [ "\$s" = "\$LAST" ] && mark="*"
  printf '  %s %s  v%-7s %-8s commit %-10s %s arquivos\n' "\$mark" "\$s" "\${v:-?}" "\${m:-?}" "\${c:-?}" "\$n"
done
[ "\$found" = 1 ] || echo "  (nenhum ponto de restauracao)"
REMOTE
}

prune_backups() {
  local keep="${1:-10}"
  ssh_run "bash -s" <<REMOTE >/dev/null
shopt -s nullglob
R="\$HOME/$BACKUP_ROOT"
cd "\$R" 2>/dev/null || exit 0
ls -1d */ 2>/dev/null | sed 's|/\$||' | sort -r | tail -n +\$(( $keep + 1 )) | while read -r old; do
  rm -rf "\$R/\$old"
done
REMOTE
}

# ---------------------------------------------------------------- portoes
run_gates() {
  npm test >/dev/null 2>&1 || die "npm test falhou -- rode 'npm test' e corrija (ou use -s para pular)"
  info "ok    npm test"
  npm run validate >/dev/null 2>&1 || die "npm run validate falhou -- rode 'npm run validate' e corrija"
  info "ok    npm run validate"
}

verify_remote() {
  bold "verificacao"
  info "versao instalada  $(remote_version)"
  info "arquivos          $(remote_file_count)"
  local http
  http=$(ssh_run "curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:9000/echoclassic/" 2>/dev/null || true)
  info "skin responde     HTTP $http"
  [ "$http" = "200" ] || warn "esperado HTTP 200"
}
