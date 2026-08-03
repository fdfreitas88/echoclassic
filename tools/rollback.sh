#!/bin/bash
# Restaura a pasta do plugin no servidor a partir de um ponto de restauracao
# gravado por tools/deploy.sh.
#
# Uso:
#   tools/rollback.sh              volta para o ponto mais recente
#   tools/rollback.sh -l           lista os pontos disponiveis
#   tools/rollback.sh -t <stamp>   volta para um ponto especifico
#   tools/rollback.sh -n           mostra o que mudaria, sem escrever
#   tools/rollback.sh -r           tambem reinicia o LMS
#   tools/rollback.sh -f           reinicia mesmo com player tocando
#
# O proprio rollback grava um ponto antes de escrever, entao voltar atras
# tambem tem volta.
set -euo pipefail
cd "$(dirname "$0")/.."
. tools/lib/echo.sh

DRY=0; RESTART=0; FORCE=0; TARGET=""; LIST=0
while [ $# -gt 0 ]; do
  case "$1" in
    -l|--list)    LIST=1 ;;
    -t|--to)      shift; TARGET="${1:-}"; [ -n "$TARGET" ] || die "-t exige um stamp" ;;
    -n|--dry-run) DRY=1 ;;
    -r|--restart) RESTART=1 ;;
    -f|--force)   FORCE=1 ;;
    -h|--help)    sed -n '2,16p' "$0"; exit 0 ;;
    *) die "opcao desconhecida: $1" ;;
  esac
  shift
done

require_host

# ---------------------------------------------------------------- listar
bold "pontos de restauracao"
list_backups
[ "$LIST" -eq 1 ] && exit 0

# ---------------------------------------------------------------- escolher
if [ -z "$TARGET" ]; then
  TARGET="$(ssh_run "cat \"\$HOME/$BACKUP_ROOT/last\" 2>/dev/null" || true)"
  [ -n "$TARGET" ] || die "nenhum ponto de restauracao registrado. Use -l para ver o que existe, e -t <stamp> para escolher."
fi

ssh_run "test -d \"\$HOME/$BACKUP_ROOT/$TARGET/tree\"" 2>/dev/null \
  || die "ponto '$TARGET' nao existe ou esta incompleto (sem tree/). Use -l."

bold "alvo"
info "restaurar a partir de $TARGET"
ssh_run "cat \"\$HOME/$BACKUP_ROOT/$TARGET/META\" 2>/dev/null" | sed 's/^/    /' || true

# ---------------------------------------------------------------- previa
bold "o que vai mudar"

# A copia e local no servidor: origem e destino estao os dois la, e quem roda e o
# rsync 2.6.9 de la. Sem --exclude INSTALL.sh de proposito: o ponto de
# restauracao ja e exatamente o que a pasta do plugin tinha, e restaurar deve
# devolver aquilo, nada a mais.
CHANGES="$(rsync_preview ssh_run "$REMOTE_RSYNC --dry-run --itemize-changes \"\$HOME/$BACKUP_ROOT/$TARGET/tree/\" \"\$HOME/$REMOTE_PLUGIN/\"")"
if [ -z "$CHANGES" ]; then
  info "nada a fazer -- o servidor ja esta igual a esse ponto"
else
  echo "$CHANGES" | sed 's/^/  /'
fi

if [ "$DRY" -eq 1 ]; then printf "\n\033[33mdry-run: nada foi escrito\033[0m\n"; exit 0; fi
[ -n "$CHANGES" ] || { printf "\n"; ok "nada a restaurar"; exit 0; }

# ---------------------------------------------------------------- restaurar
bold "restauracao"
REV_BEFORE="$(asset_revision)"
SAFETY="$(backup_now rollback)"
info "estado atual guardado em $SAFETY"
ssh_run "$REMOTE_RSYNC \"\$HOME/$BACKUP_ROOT/$TARGET/tree/\" \"\$HOME/$REMOTE_PLUGIN/\"" >/dev/null
info "restaurado de $TARGET"

# O ponto de restauracao guarda os mtimes originais, que sao ANTERIORES aos que
# estavam instalados. Restaurados como estao, o asset revision andaria para tras
# -- e a URL dos assets voltaria a ser uma que o navegador ja tem em cache, com o
# JS mais novo dentro. O resultado seria o codigo antigo no disco e o codigo novo
# na tela, sem nada indicando isso. Carimbar agora fecha essa porta.
ssh_run "find \"\$HOME/$REMOTE_PLUGIN/HTML/echoclassic\" -exec touch {} +"
info "assets carimbados (forca o navegador a rebaixar o cache)"

# O 'last' passa a apontar para o ponto de seguranca recem-criado: um segundo
# rollback desfaz este, em vez de reaplicar o mesmo alvo em loop.
ssh_run "echo '$SAFETY' > \"\$HOME/$BACKUP_ROOT/last\""

# ---------------------------------------------------------------- restart
if [ "$RESTART" -eq 1 ]; then
  bold "reinicio do LMS"
  PLAYERS="$(lms_rpc '{"id":1,"method":"slim.request","params":["",["players",0,99]]}' \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(((JSON.parse(s).result||{}).players_loop||[]).map(x=>x.playerid).join(" "))}catch(e){console.log("")}})' || true)"
  BUSY=""
  for pid in $PLAYERS; do
    MODE="$(lms_rpc "{\"id\":1,\"method\":\"slim.request\",\"params\":[\"$pid\",[\"mode\",\"?\"]]}" \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log((JSON.parse(s).result||{})._mode||"")}catch(e){console.log("")}})' || true)"
    [ "$MODE" = "play" ] && BUSY="$BUSY $pid"
  done
  [ -n "$BUSY" ] && [ "$FORCE" -eq 0 ] && die "player tocando ($BUSY). Pare a reproducao, ou use -f."
  lms_rpc '{"id":1,"method":"slim.request","params":["",["restartserver"]]}' >/dev/null 2>&1 || true
  printf "  aguardando o servidor voltar"
  BACK=0
  for _ in $(seq 1 60); do
    sleep 2; printf "."
    if lms_rpc '{"id":1,"method":"slim.request","params":["",["serverstatus",0,0]]}' 2>/dev/null | grep -q '"version"'; then BACK=1; break; fi
  done
  printf "\n"
  [ "$BACK" -eq 1 ] || die "o LMS nao voltou em 120s. Abra o app no servidor:
    ssh $HOST 'open -a \"Lyrion Music Server\"'"
  info "servidor no ar"
fi

# ---------------------------------------------------------------- verificacao
verify_remote
REV_AFTER="$(asset_revision)"
info "asset revision    $REV_BEFORE -> $REV_AFTER"
if [ "$REV_AFTER" -le "$REV_BEFORE" ] 2>/dev/null; then
  warn "o asset revision NAO avancou. O navegador pode continuar servindo o JS
  que estava em cache; faca hard reload e confira."
fi

printf "\n"
ok "restaurado"
info "abra $SKIN_URL  e faca hard reload (Cmd+Shift+R)"
info "desfazer este rollback:  tools/rollback.sh -t $SAFETY"
