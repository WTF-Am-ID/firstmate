#!/usr/bin/env bash
set -eu
ROOT=$PWD
EVIDENCE=$1
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_PENDING_REPLY_DIR_OVERRIDE FM_GATE_REFUSE_BYPASS TASKS_AXI_FILE TASKS_AXI_BACKEND
LAB=$(mktemp -d "$ROOT/.nm-test-tmp/reply.XXXXXX")
watcher=
cleanup() {
  if [ -n "$watcher" ]; then kill "$watcher" 2>/dev/null || true; wait "$watcher" 2>/dev/null || true; fi
  rm -rf -- "$LAB"
}
trap cleanup EXIT
. "$ROOT/bin/fm-pending-reply-lib.sh"
export FM_HOME="$LAB/parent"
"$ROOT/bin/fm-lab-home.sh" create "$FM_HOME" >/dev/null
export FM_PENDING_REPLY_GRACE_SECS=3600
STATE="$FM_HOME/state"
new_request() {
  id=$1 kind=$2
  mate="$LAB/$id"
  mkdir -p "$mate/state"
  printf 'home=%s\nharness=codex\n' "$mate" > "$STATE/$id.meta"
  printf '%s\n' "$id" > "$mate/.fm-secondmate-home"
  printf 'schema=fm-secondmate-parent.v1\nroute=local\nparent_home=%s\n' "$FM_HOME" > "$mate/.fm-secondmate-parent"
  corr=$(fm_pending_reply_create "$FM_HOME" "$STATE" "$id" 'Please persist open work' "$kind")
  fm_pending_reply_mark_delivered "$STATE" "$corr"
  printf '%s\n' "$corr" > "$LAB/$id.corr"
}
phase() { fm_pending_reply_get "$STATE/pending-replies/$1" phase; }
# Actual watcher, with no backend endpoints to probe or relaunch.
for id in local-done local-blocked local-failed local-needs-decision local-timeout local-ordinary; do
  kind=secondmate-restart-persist
  [ "$id" != local-ordinary ] || kind=
  new_request "$id" "$kind"
  printf 'working [corr=%s]: still writing durable records\n' "$corr" > "$mate/state/$id.status"
  # A stale done must never settle this request.
  printf 'done [corr=0000000000000000]: stale completion\n' >> "$mate/state/$id.status"
done
FM_POLL=1 FM_HEARTBEAT=999999 FM_SIGNAL_GRACE=999999 FM_HOME_SUMMARY_INTERVAL=999999 \
  bash "$ROOT/bin/fm-watch.sh" > "$EVIDENCE/local-watcher.log" 2>&1 &
watcher=$!
for n in $(seq 1 100); do
  c=$(cat "$LAB/local-ordinary.corr")
  [ "$(phase "$c")" != resolved ] || break
  kill -0 "$watcher" 2>/dev/null || { cat "$EVIDENCE/local-watcher.log"; exit 1; }
  sleep 0.1
done
for id in local-done local-blocked local-failed local-needs-decision local-timeout local-ordinary; do
  corr=$(cat "$LAB/$id.corr")
  actual=$(phase "$corr")
  expected=awaiting_report
  [ "$id" != local-ordinary ] || expected=resolved
  printf '%s progress: corr=%s phase=%s expected=%s\n' "$id" "$corr" "$actual" "$expected"
  [ "$actual" = "$expected" ]
done
for verb in done blocked failed needs-decision; do
  id=local-$verb
  corr=$(cat "$LAB/$id.corr")
  printf '%s [corr=%s]: persisted open work; deliberately left unrelated work alone\n' "$verb" "$corr" >> "$LAB/$id/state/$id.status"
done
for n in $(seq 1 200); do
  complete=1
  for verb in done blocked failed needs-decision; do
    corr=$(cat "$LAB/local-$verb.corr")
    [ "$(phase "$corr")" = resolved ] || complete=0
  done
  [ "$complete" = 0 ] || break
  kill -0 "$watcher" 2>/dev/null || { cat "$EVIDENCE/local-watcher.log"; exit 1; }
  sleep 0.1
done
for verb in done blocked failed needs-decision; do
  id=local-$verb
  corr=$(cat "$LAB/$id.corr")
  actual=$(phase "$corr")
  printf '%s terminal: corr=%s phase=%s\n' "$id" "$corr" "$actual"
  [ "$actual" = resolved ]
  cat "$STATE/$id.status"
done
corr=$(cat "$LAB/local-timeout.corr")
printf 'progress-only after watcher cycles: corr=%s phase=%s\n' "$corr" "$(phase "$corr")"
[ "$(phase "$corr")" = awaiting_report ]
kill "$watcher"; wait "$watcher" 2>/dev/null || true
watcher=
# Real remote report writer, byte delta reader and parent ingestion executable.
for terminal in done blocked failed needs-decision progress-only ordinary; do
  id=remote-$terminal
  kind=secondmate-restart-persist
  [ "$terminal" != ordinary ] || kind=
  new_request "$id" "$kind"
  printf 'schema=fm-secondmate-parent.v1\nroute=remote\n' > "$mate/.fm-secondmate-parent"
  source="$mate/state/parent-replies.status"
  : > "$source"
  for verb in working "$terminal"; do
    case "$verb" in progress-only|ordinary) continue ;; esac
    offset=$(wc -c < "$source" | tr -d '[:space:]')
    prefix=$(shasum -a 256 "$source" | awk '{print $1}')
    FM_HOME="$mate" bash "$ROOT/bin/fm-secondmate-report.sh" "$verb" "$corr" 'open records written; unrelated work deliberately untouched'
    FM_HOME="$mate" bash "$ROOT/bin/fm-remote-delta-read.sh" state/parent-replies.status "$offset" "$prefix" 0 > "$LAB/delta.json"
    bash "$ROOT/bin/fm-procevent-remote-reply.sh" ingest "$id" "$LAB/delta.json"
    actual=$(phase "$corr")
    expected=resolved
    if [ "$verb" = working ] && [ "$terminal" != ordinary ]; then expected=awaiting_report; fi
    printf '%s %s: corr=%s phase=%s expected=%s\n' "$id" "$verb" "$corr" "$actual" "$expected"
    [ "$actual" = "$expected" ]
  done
  cat "$STATE/$id.status"
done
printf 'probe complete; disposable homes removed on exit\n'
