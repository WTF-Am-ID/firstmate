#!/usr/bin/env bash
set -eu
ROOT=$PWD
S=$ROOT/.validation-3103
LAB=$S/spawn-home
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_BACKEND FM_GATE_REFUSE_BYPASS
"$ROOT/bin/fm-lab-home.sh" create "$LAB"
SOCKET_DIR=$("$ROOT/bin/fm-lab-home.sh" tmux-dir "$LAB")
export TMUX_TMPDIR=$SOCKET_DIR
export FM_HOME=$LAB
export TMPDIR=$S/tmp
export TREEHOUSE_ROOT=$S/spawn-pool
SOCKET=$SOCKET_DIR/tmux-$(id -u)/fm-lab
cleanup() {
  [ ! -S "$SOCKET" ] || tmux -S "$SOCKET" kill-server
  "$ROOT/bin/fm-lab-home.sh" teardown "$LAB"
  rm -rf "$LAB" "$S/spawn-project" "$S/spawn-origin.git" "$S/spawn-pool"
}
trap cleanup EXIT
mkdir -p "$S/spawn-project"
git -C "$S/spawn-project" init -q -b master
printf 'synthetic launch repository\n' > "$S/spawn-project/README"
git -C "$S/spawn-project" add README
git -C "$S/spawn-project" -c user.name=Lab -c user.email=lab@example.invalid commit -qm initial
git clone -q --bare "$S/spawn-project" "$S/spawn-origin.git"
git -C "$S/spawn-project" remote add origin "file://$S/spawn-origin.git"
git -C "$S/spawn-project" fetch -q origin
git -C "$S/spawn-project" remote set-head origin -a
git -C "$S/spawn-project" branch integration/release
 git -C "$S/spawn-project" push -q origin integration/release
printf 'codex\n' > "$LAB/config/crew-harness"
touch "$LAB/config/supervision-host-off"
env -u NO_MISTAKES_GATE -u FM_GATE_REFUSE_BYPASS -u FM_ROOT_OVERRIDE -u FM_STATE_OVERRIDE -u FM_DATA_OVERRIDE -u FM_CONFIG_OVERRIDE -u FM_PROJECTS_OVERRIDE tmux -L fm-lab new-session -d -s primary -x 120 -y 40 -c "$ROOT" -e FM_HOME="$LAB" codex
export TMUX=$SOCKET,0,0
for id in default-task named-task; do
  flags=()
  [ "$id" != named-task ] || flags=(--base-branch integration/release)
  "$ROOT/bin/fm-brief.sh" "$id" synthetic --mode direct-PR "${flags[@]+${flags[@]}}"
  python3 - "$LAB/data/$id/brief.md" <<'PY'
import sys
p=sys.argv[1]
s=open(p).read().replace('{TASK}','This is a disposable launch validation. Make no edits and do not publish. Wait for supervision.').replace('{FIRSTMATE_SPEC}','Inspect no files, run no commands and make no edits. Remain idle after acknowledging this instruction.')
open(p,'w').write(s)
PY
  "$ROOT/bin/fm-spawn.sh" "$id" "$S/spawn-project" --mode direct-PR --yolo off --harness codex --backend tmux "${flags[@]+${flags[@]}}"
  printf '\nTASK METADATA %s\n' "$id"
  cat "$LAB/state/$id.meta"
  printf '\nLAUNCH DESTINATION %s\n' "$id"
  sed -n '/# Expected pull request destination/,$p' "$LAB/data/$id/launch-brief.md"
done
sleep 3
printf '\nPRIVATE LAB WINDOWS\n'
tmux -S "$SOCKET" list-windows -a -F '#{session_name}:#{window_name} #{pane_current_command} #{pane_width}x#{pane_height}'
for id in default-task named-task; do
  window=$(sed -n 's/^window=//p' "$LAB/state/$id.meta")
  printf '\nLIVE WORKER %s\n' "$id"
  tmux -S "$SOCKET" capture-pane -p -t "$window"
done
