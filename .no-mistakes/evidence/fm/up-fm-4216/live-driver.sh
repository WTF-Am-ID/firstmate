#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
EVIDENCE=/Users/daddy/.no-mistakes-upstream-codex/evidence/01M61AQ8YRZZ6KT5VG5JF4W5EH
SCRATCH="$ROOT/.test-phase-4216"
REAL_GIT=$(command -v git)
REAL_TMUX=$(command -v tmux)
REAL_TREEHOUSE=$(command -v treehouse)
REAL_TASKS=$(command -v tasks-axi)
. "$ROOT/tests/git-config-helpers.sh"
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS TASKS_AXI_FILE TASKS_AXI_BACKEND FM_TASK_ID TMUX
mkdir -p "$SCRATCH/live-bin"
ln -sf "$REAL_GIT" "$SCRATCH/live-bin/git"
ln -sf "$REAL_TMUX" "$SCRATCH/live-bin/tmux"
ln -sf "$REAL_TREEHOUSE" "$SCRATCH/live-bin/treehouse"
ln -sf "$REAL_TASKS" "$SCRATCH/live-bin/tasks-axi"
export PATH="$SCRATCH/live-bin:/usr/bin:/bin:/usr/sbin:/sbin"
export GIT_AUTHOR_NAME=Lab GIT_AUTHOR_EMAIL=lab@example.invalid GIT_COMMITTER_NAME=Lab GIT_COMMITTER_EMAIL=lab@example.invalid
# The short private socket is provisioned/removed only by the marked-lab helper.
LAB= SOCKET_DIR=
cleanup_socket() {
  if [ -n "$SOCKET_DIR" ]; then
    TMUX_TMPDIR="$SOCKET_DIR" "$REAL_TMUX" -L fm-lab kill-server 2>/dev/null || true
    bash "$ROOT/bin/fm-lab-home.sh" teardown "$LAB"
    SOCKET_DIR=
  fi
}
trap cleanup_socket EXIT
for MODE in old-git contained conflict unlanded unrelated-history; do
  LAB="$SCRATCH/live-$MODE"
  bash "$ROOT/bin/fm-lab-home.sh" create "$LAB" >/dev/null
  SOCKET_DIR=$(bash "$ROOT/bin/fm-lab-home.sh" tmux-dir "$LAB")
  export TMUX_TMPDIR="$SOCKET_DIR"
  "$REAL_TMUX" -L fm-lab new-session -d -s firstmate -n fm-task-x1 -x 100 -y 30 -c "$ROOT" 'sleep 900'
  SOCKET=$("$REAL_TMUX" -L fm-lab display-message -p '#{socket_path}')
  export TMUX="$SOCKET,0,0"
  PROJECT="$LAB/projects/project"
  git init -q --bare "$LAB/origin.git"
  git -C "$LAB/origin.git" symbolic-ref HEAD refs/heads/main
  git clone -q "$LAB/origin.git" "$PROJECT" 2>/dev/null
  git -C "$PROJECT" commit -q --allow-empty -m baseline
  git -C "$PROJECT" push -q origin main
  git -C "$PROJECT" remote set-head origin main
  WT=$(cd "$PROJECT" && treehouse --root "$LAB/projects/pool" get --lease --base main --no-fetch -b fm/task-x1 2> "$LAB/treehouse-create.log")
  if [ "$MODE" = unrelated-history ]; then
    git -C "$WT" checkout -q --orphan unrelated
    git -C "$WT" branch -D fm/task-x1 >/dev/null
    git -C "$WT" symbolic-ref HEAD refs/heads/fm/task-x1
  fi
  printf 'hello\n' > "$WT/feature.txt"
  git -C "$WT" add feature.txt
  git -C "$WT" commit -q -m feature
  case "$MODE" in
    old-git|contained|conflict)
      if [ "$MODE" = conflict ]; then printf 'different\n' > "$PROJECT/feature.txt"; else printf 'hello\n' > "$PROJECT/feature.txt"; fi
      git -C "$PROJECT" add feature.txt
      git -C "$PROJECT" commit -q -m squashed-feature
      git -C "$PROJECT" push -q origin main
      ;;
  esac
  cat > "$LAB/state/task-x1.meta" <<META
window=firstmate:fm-task-x1
endpoint_task_id=task-x1
worktree=$WT
project=$PROJECT
kind=ship
mode=no-mistakes
harness=codex
spawn_gen=live-4216-$MODE
base_branch=main
META
  touch "$LAB/state/.last-watcher-beat"
  cp "$LAB/state/task-x1.meta" "$LAB/meta-before"
  HEAD_BEFORE=$(git -C "$WT" rev-parse HEAD)
  if [ "$MODE" = old-git ]; then ln -sf "$SCRATCH/git-2.37.7/git" "$SCRATCH/live-bin/git"; fi
  LOG="$EVIDENCE/live-$MODE.txt"
  {
    printf 'Candidate: %s\nScenario: %s\n' "$("$REAL_GIT" -C "$ROOT" rev-parse HEAD)" "$MODE"
    git --version
    printf 'Command: FM_HOME=<marked-disposable-lab> bash bin/fm-teardown.sh task-x1\n'
  } > "$LOG"
  RC=0
  FM_HOME="$LAB" bash "$ROOT/bin/fm-teardown.sh" task-x1 >> "$LOG" 2>&1 || RC=$?
  printf 'Exit: %s\n' "$RC" >> "$LOG"
  if [ "$MODE" = contained ]; then
    [ "$RC" = 0 ]
    [ ! -e "$LAB/state/task-x1.meta" ]
    ! "$REAL_TMUX" -L fm-lab has-session -t firstmate 2>/dev/null
    ! "$REAL_GIT" -C "$PROJECT" show-ref --verify --quiet refs/heads/fm/task-x1
    printf 'Observed: task metadata removed; task window closed; task branch removed.\n' >> "$LOG"
    (cd "$PROJECT" && treehouse --root "$LAB/projects/pool" status) >> "$LOG" 2>&1
  else
    [ "$RC" = 1 ]
    [ -d "$WT" ]
    [ "$("$REAL_GIT" -C "$WT" rev-parse HEAD)" = "$HEAD_BEFORE" ]
    [ "$("$REAL_GIT" -C "$WT" branch --show-current)" = fm/task-x1 ]
    cmp "$LAB/meta-before" "$LAB/state/task-x1.meta"
    "$REAL_TMUX" -L fm-lab has-session -t firstmate
    printf 'Observed: isolated copy, original branch and HEAD, byte-identical task metadata, and real task window all preserved.\n' >> "$LOG"
    case "$MODE" in
      old-git|unrelated-history) grep -q 'content-landed proof unavailable' "$LOG"; ! grep -q 'not landed' "$LOG" ;;
      *) grep -q 'not landed' "$LOG"; ! grep -q 'proof unavailable' "$LOG" ;;
    esac
    if [ "$MODE" = old-git ]; then
      # Same real old Git, repository and endpoint against the pre-change script.
      BASE_RC=0
      FM_HOME="$LAB" bash "$ROOT/bin/.test-phase-4216-baseline.sh" task-x1 > "$EVIDENCE/live-old-git-baseline.txt" 2>&1 || BASE_RC=$?
      printf 'Baseline exit: %s\n' "$BASE_RC" >> "$EVIDENCE/live-old-git-baseline.txt"
      [ "$BASE_RC" = 1 ]
      grep -q 'not landed' "$EVIDENCE/live-old-git-baseline.txt"
      cmp "$LAB/meta-before" "$LAB/state/task-x1.meta"
    fi
  fi
  printf '%s: exit %s, expected behavior verified\n' "$MODE" "$RC"
  ln -sf "$REAL_GIT" "$SCRATCH/live-bin/git"
  cleanup_socket
  unset TMUX
 done
