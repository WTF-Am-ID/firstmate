#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
EVIDENCE=/Users/daddy/.no-mistakes-upstream-codex/evidence/01M6FXHRYH31ZKSRYWYT26KKH6
. "$ROOT/tests/git-config-helpers.sh"
LAB=$(mktemp -d "$ROOT/.tools/phase-validation/fm-lab.XXXXXX")
SOCKET_DIR=
cleanup() {
  if [ -n "$SOCKET_DIR" ]; then
    TMUX_TMPDIR="$SOCKET_DIR" tmux -L fm-lab kill-server 2>/dev/null || true
    "$ROOT/bin/fm-lab-home.sh" teardown "$LAB"
  fi
  rm -rf -- "$LAB"
}
trap cleanup EXIT
"$ROOT/bin/fm-lab-home.sh" create "$LAB"
SOCKET_DIR=$("$ROOT/bin/fm-lab-home.sh" tmux-dir "$LAB")
export TMUX_TMPDIR="$SOCKET_DIR"
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS
export FM_HOME="$LAB"
printf 'tmux\n' > "$LAB/config/backend"
export GIT_AUTHOR_NAME=LiveTest GIT_AUTHOR_EMAIL=live@example.invalid GIT_COMMITTER_NAME=LiveTest GIT_COMMITTER_EMAIL=live@example.invalid
mkdir -p "$LAB/projects/demo"
PROJ="$LAB/projects/demo"
git -C "$PROJ" init -q -b main
printf 'baseline\n' > "$PROJ/worker.txt"
git -C "$PROJ" add worker.txt
git -C "$PROJ" commit -qm baseline
printf '# Backlog\n\n## In flight\n\n## Queued\n\n## Done\n' > "$LAB/data/backlog.md"
for scenario in clean force scout; do
  ID="live-$scenario"
  WT=$(cd "$PROJ" && treehouse --root "$LAB/pool" get --lease --no-fetch --base main -b "fm/$ID")
  kind=ship
  [ "$scenario" != scout ] || kind=scout
  tasks-axi add "$ID" "Live $scenario cleanup" --kind "$kind" --file "$LAB/data/backlog.md" >/dev/null
  tasks-axi start "$ID" --file "$LAB/data/backlog.md" >/dev/null
  mkdir -p "$LAB/data/$ID" "$LAB/state/$ID.inbox"
  printf 'report\n' > "$LAB/data/$ID/report.md"
  printf 'done: live case\n' > "$LAB/state/$ID.status"
  printf 'retained steer\n' > "$LAB/state/$ID.inbox/001.msg"
  cat > "$LAB/state/$ID.meta" <<META
window=primary:fm-$ID
endpoint_task_id=$ID
worktree=$WT
project=$PROJ
kind=$kind
mode=local-only
backend=tmux
harness=codex
spawn_gen=live-$scenario-generation
decisions_reviewed=1
decision_keys=
META
  if [ "$scenario" != clean ]; then
    printf 'disposable scratch edit\n' > "$WT/worker.txt"
    mkdir -p "$WT/nested"
    git -C "$WT/nested" init -q
    printf 'disposable nested content\n' > "$WT/nested/scratch.txt"
  fi
  env -u NO_MISTAKES_GATE -u FM_GATE_REFUSE_BYPASS -u FM_ROOT_OVERRIDE -u FM_STATE_OVERRIDE -u FM_DATA_OVERRIDE -u FM_CONFIG_OVERRIDE -u FM_PROJECTS_OVERRIDE \
    TMUX_TMPDIR="$SOCKET_DIR" tmux -L fm-lab new-session -d -s primary -n "fm-$ID" -x 120 -y 40 -c "$ROOT" -e FM_HOME="$LAB" codex
  tmux -L fm-lab set-window-option -t "primary:fm-$ID" automatic-rename off
  tmux -L fm-lab set-window-option -t "primary:fm-$ID" allow-rename off
  TMUX=$(tmux -L fm-lab display-message -p -t primary '#{socket_path},#{pid},#{session_id}' | sed 's/,\$/,/')
  export TMUX
  tmux -L fm-lab has-session -t primary
  for i in $(seq 1 20); do
    tmux -L fm-lab capture-pane -p -t primary > "$EVIDENCE/$scenario-codex-pane.txt"
    if rg -q 'OpenAI Codex|Do you trust|codex|Hooks need review' "$EVIDENCE/$scenario-codex-pane.txt"; then break; fi
    sleep 1
  done
  printf '\nSCENARIO %s\n' "$scenario"
  printf 'Before cleanup:\n'
  git -C "$WT" status --short --untracked-files=all
  treehouse --root "$LAB/pool" status -C "$PROJ" 2>/dev/null || (cd "$PROJ" && treehouse --root "$LAB/pool" status)
  rc=0
  if [ "$scenario" = force ]; then
    "$ROOT/bin/fm-teardown.sh" "$ID" --force || rc=$?
  else
    "$ROOT/bin/fm-teardown.sh" "$ID" || rc=$?
  fi
  printf 'cleanup_exit=%s\n' "$rc"
  if tmux -L fm-lab has-session -t primary 2>/dev/null; then
    printf 'ERROR: exact task endpoint survived cleanup\n'
    exit 1
  fi
  printf 'VERIFIED: real task endpoint stopped on private fm-lab socket\n'
  [ "$rc" = 0 ]
  printf 'After cleanup:\n'
  [ ! -e "$LAB/state/$ID.meta" ]
  [ ! -e "$LAB/state/$ID.inbox" ]
  [ ! -e "$LAB/state/$ID.backlog-close" ]
  [ -z "$(git -C "$WT" status --porcelain --untracked-files=all)" ]
  ! git -C "$PROJ" show-ref --verify --quiet "refs/heads/fm/$ID"
  tasks-axi show "$ID" --file "$LAB/data/backlog.md"
  (cd "$PROJ" && treehouse --root "$LAB/pool" status)
  printf 'VERIFIED: clean copy, removed branch and retry records, completed backlog transition\n'
  tmux -L fm-lab kill-server 2>/dev/null || true
  unset TMUX
 done
