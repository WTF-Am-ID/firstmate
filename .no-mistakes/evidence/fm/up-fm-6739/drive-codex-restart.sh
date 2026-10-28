#!/usr/bin/env bash
set -eu
ROOT=$PWD
EVIDENCE=$1
LAB=$(cat "$ROOT/.nm-test-tmp/codex-lab.path")
SOCKET_DIR=$(cat "$LAB/socket-dir")
export TMUX_TMPDIR="$SOCKET_DIR"
export TMUX=$(tmux -L fm-lab display-message -p -t primary '#{socket_path},#{pid},0')
export FM_HOME="$LAB/home"
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS TASKS_AXI_FILE TASKS_AXI_BACKEND
mkdir -p "$LAB/mate/state" "$LAB/mate/data" "$LAB/mate/config" "$LAB/mate/bin" "$FM_HOME/data/sm1"
git -C "$LAB/mate" init -q
printf 'sm1\n' > "$LAB/mate/.fm-secondmate-home"
printf 'codex\n' > "$FM_HOME/config/secondmate-harness"
printf '# Isolated restart verification\nNo projects or work are assigned. Remain idle. Do not delegate or publish.\n' > "$FM_HOME/data/sm1/brief.md"
cat > "$FM_HOME/state/sm1.meta" <<EOF
window=primary:0.0
endpoint_task_id=sm1
worktree=$LAB/mate
project=$LAB/mate
harness=codex
kind=secondmate
mode=secondmate
yolo=off
model=default
effort=default
home=$LAB/mate
backend=tmux
EOF
. "$ROOT/bin/fm-pending-reply-lib.sh"
for verb in blocked failed needs-decision working done; do
  printf '\n=== real Codex endpoint; reply=%s ===\n' "$verb"
  # Remove only the previous case's isolated request and status, retaining real inbox delivery.
  rm -f "$FM_HOME/state/sm1.status"
  rm -rf "$FM_HOME/state/pending-replies"
  FM_SECONDMATE_PERSIST_WAIT=8 FM_SECONDMATE_PERSIST_POLL=1 FM_CONTROL_EXIT_WAIT=15 FM_CONTROL_LAUNCH_WAIT=20 \
    bash "$ROOT/bin/fm-secondmate-restart.sh" sm1 > "$LAB/restart.out" 2>&1 &
  restart_pid=$!
  rec=
  for n in $(seq 1 150); do
    for candidate in "$FM_HOME/state/pending-replies"/*; do
      [ -f "$candidate" ] || continue
      rec=$candidate
    done
    [ -z "$rec" ] || break
    kill -0 "$restart_pid" 2>/dev/null || break
    sleep 0.1
  done
  [ -n "$rec" ] || { cat "$LAB/restart.out"; exit 1; }
  corr=$(fm_pending_reply_get "$rec" corr_id)
  # Answer only once real request delivery is recorded.
  for n in $(seq 1 150); do
    [ -z "$(fm_pending_reply_get "$rec" delivered_epoch)" ] || break
    kill -0 "$restart_pid" 2>/dev/null || break
    sleep 0.1
  done
  printf 'request corr=%s delivered_epoch=%s\n' "$corr" "$(fm_pending_reply_get "$rec" delivered_epoch)"
  [ -n "$(fm_pending_reply_get "$rec" delivered_epoch)" ] || { cat "$LAB/restart.out"; exit 1; }
  printf '%s [corr=%s]: records persisted; deliberately untouched unrelated work\n' "$verb" "$corr" >> "$FM_HOME/state/sm1.status"
  rc=0
  wait "$restart_pid" || rc=$?
  cat "$LAB/restart.out"
  phase=$(fm_pending_reply_get "$rec" phase)
  printf 'exit=%s phase=%s pane_command=%s\n' "$rc" "$phase" "$(tmux -L fm-lab display-message -p -t primary '#{pane_current_command}')"
  cat "$FM_HOME/state/sm1.status"
  tmux -L fm-lab capture-pane -p -t primary > "$EVIDENCE/codex-$verb-pane.txt"
  if [ "$verb" = done ]; then
    [ "$rc" = 0 ]
    grep -q 'summary: 1 of 1 restarted, 0 nudged, 0 unreached' "$LAB/restart.out"
    [ "$phase" = resolved ]
  else
    [ "$rc" = 3 ]
    grep -q 'summary: 0 of 1 restarted, 1 nudged, 0 unreached' "$LAB/restart.out"
    [ ! -e "$FM_HOME/state/sm1.control-relaunch" ]
    if [ "$verb" = working ]; then [ "$phase" = awaiting_report ]; else [ "$phase" = resolved ]; fi
  fi
done
