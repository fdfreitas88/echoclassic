#!/bin/bash
# Instala a arvore de trabalho local no LMS do musicplayer, guardando antes um
# ponto de restauracao. Para testar uma correcao antes de publicar.
#
# Uso:
#   tools/deploy.sh              portoes, backup, sincroniza e verifica
#   tools/deploy.sh -n           mostra o que mudaria, sem escrever nada
#   tools/deploy.sh -r           tambem reinicia o LMS
#   tools/deploy.sh -s           pula npm test e npm run validate
#   tools/deploy.sh -f           reinicia mesmo com player tocando
#
# Reiniciar so e necessario depois de mexer em Plugin.pm, Settings.pm ou
# strings.txt, que o Perl carrega uma vez. JS, CSS e template sao lidos do disco
# a cada requisicao, e o getAssetRevision e o mtime mais novo da arvore -- entao
# sincronizar ja invalida o cache dos assets, sem precisar subir a versao.
#
# Para desfazer:  tools/rollback.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. tools/lib/echo.sh

DRY=0; RESTART=0; SKIP_GATES=0; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run)    DRY=1 ;;
    -r|--restart)    RESTART=1 ;;
    -s|--skip-gates) SKIP_GATES=1 ;;
    -f|--force)      FORCE=1 ;;
    -h|--help)       sed -n '2,18p' "$0"; exit 0 ;;
    *) die "opcao desconhecida: $1" ;;
  esac
  shift
done

# ---------------------------------------------------------------- portoes
bold "1/5  portoes locais"
if [ "$SKIP_GATES" -eq 0 ]; then run_gates; else info "(pulados por -s)"; fi

# ---------------------------------------------------------------- servidor
bold "2/5  servidor"
require_host
REMOTE_VER="$(remote_version)"
[ -n "$REMOTE_VER" ] || die "EchoClassic nao encontrado em \$HOME/$REMOTE_PLUGIN no $HOST"
info "local $(local_version)  ->  instalado $REMOTE_VER"
REV_BEFORE="$(asset_revision)"

# ---------------------------------------------------------------- previa
bold "3/5  o que vai mudar"

CHANGES="$(rsync_preview rsync "${RSYNC_OPTS[@]}" --dry-run --itemize-changes "$SRC/" "$HOST:$REMOTE_PLUGIN/")"
if [ -z "$CHANGES" ]; then
  info "nada a fazer -- o servidor ja esta identico a arvore local"
else
  echo "$CHANGES" | sed 's/^/  /'
fi

if [ "$DRY" -eq 1 ]; then printf "\n\033[33mdry-run: nada foi escrito\033[0m\n"; exit 0; fi
[ -n "$CHANGES" ] || { printf "\n"; ok "nada a instalar"; exit 0; }

# ---------------------------------------------------------------- backup + sync
bold "4/5  ponto de restauracao e sincronizacao"
STAMP="$(backup_now deploy)"
info "ponto de restauracao: $STAMP"
rsync "${RSYNC_OPTS[@]}" "$SRC/" "$HOST:$REMOTE_PLUGIN/"
info "sincronizado"
prune_backups 10

# ---------------------------------------------------------------- restart
if [ "$RESTART" -eq 1 ]; then
  bold "5/5  reinicio do LMS"
  PLAYERS="$(lms_rpc '{"id":1,"method":"slim.request","params":["",["players",0,99]]}' \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(((JSON.parse(s).result||{}).players_loop||[]).map(x=>x.playerid).join(" "))}catch(e){console.log("")}})' || true)"
  BUSY=""
  for pid in $PLAYERS; do
    MODE="$(lms_rpc "{\"id\":1,\"method\":\"slim.request\",\"params\":[\"$pid\",[\"mode\",\"?\"]]}" \
      | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log((JSON.parse(s).result||{})._mode||"")}catch(e){console.log("")}})' || true)"
    [ "$MODE" = "play" ] && BUSY="$BUSY $pid"
  done
  if [ -n "$BUSY" ] && [ "$FORCE" -eq 0 ]; then
    die "player tocando ($BUSY). Pare a reproducao, ou use -f."
  fi

  # restartserver -> main::restartServer, que roda cleanup() -- e e o cleanup que
  # grava as preferencias. Matar o processo no lugar disso descarta preferencia:
  # foi assim que o registro do plugin se perdeu duas vezes.
  # canRestartServer() falha em seguranca: se o reinicio nao for permitido, o
  # servidor continua no ar e so registra erro no log.
  lms_rpc '{"id":1,"method":"slim.request","params":["",["restartserver"]]}' >/dev/null 2>&1 || true
  printf "  aguardando o servidor voltar"
  BACK=0
  for _ in $(seq 1 60); do
    sleep 2; printf "."
    if lms_rpc '{"id":1,"method":"slim.request","params":["",["serverstatus",0,0]]}' 2>/dev/null | grep -q '"version"'; then BACK=1; break; fi
  done
  printf "\n"
  [ "$BACK" -eq 1 ] || die "o LMS nao voltou em 120s. Abra o app no servidor:
    ssh $HOST 'open -a \"Lyrion Music Server\"'
  Depois, se precisar:  tools/rollback.sh"
  info "servidor no ar"
else
  bold "5/5  reinicio"
  info "pulado. JS, CSS e template nao precisam."
  info "Use -r depois de mexer em Plugin.pm, Settings.pm ou strings.txt."
fi

# ---------------------------------------------------------------- verificacao
verify_remote
REV_AFTER="$(asset_revision)"
info "asset revision    $REV_BEFORE -> $REV_AFTER"
# So cobra avanco se algum asset realmente mudou. Um deploy que mexe apenas em
# Plugin.pm ou strings.txt nao move a revisao -- e nao precisa mover, porque o
# que o navegador tem em cache continua sendo o atual. Avisar ali seria alarme
# falso, e alarme falso repetido ensina a ignorar o aviso de verdade.
if printf '%s\n' "$CHANGES" | grep -q 'HTML/echoclassic/' \
   && [ "$REV_AFTER" -le "$REV_BEFORE" ] 2>/dev/null; then
  warn "os assets mudaram mas o asset revision NAO avancou: a URL nao muda e o
  navegador serve o JS anterior mesmo com hard reload. Force com:
    touch $SRC/HTML/echoclassic/html/js/*.js && tools/deploy.sh"
fi

printf "\n"
ok "pronto"
info "abra $SKIN_URL  e faca hard reload (Cmd+Shift+R)"
info "desfazer:  tools/rollback.sh"
