#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
EVIDENCE=/Users/daddy/.no-mistakes-upstream-codex/evidence/01M616RBW0B9HP0T9V5MFFGC02
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=probe GIT_AUTHOR_EMAIL=probe@example.invalid
export GIT_COMMITTER_NAME=probe GIT_COMMITTER_EMAIL=probe@example.invalid
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS
unset TASKS_AXI_FILE TASKS_AXI_BACKEND
REAL_GIT=$(command -v git)
export REAL_GIT
export TMUX='.phase-test/tmux.sock,0,0'
cleanup() {
  tmux -S .phase-test/tmux.sock kill-server 2>/dev/null || true
  rm -f bin/.phase-baseline-teardown.sh
  rm -rf .phase-test/live
}
trap cleanup EXIT
mkdir -p .phase-test/live
git show 417cec2feb4e2976c0acdb2527b87b3ccc71535f:bin/fm-teardown.sh > bin/.phase-baseline-teardown.sh
chmod +x bin/.phase-baseline-teardown.sh

for mode in baseline-yaml amended-yaml amended-python exact old-git-exact old-git-amended; do
  CASE="$ROOT/.phase-test/live/$mode"
  mkdir -p "$CASE"
  LAB="$CASE/home"
  bash bin/fm-lab-home.sh create "$LAB" >/dev/null
  export FM_HOME="$LAB"
  export TREEHOUSE_ROOT="$CASE/pool"
  git init -q --bare --initial-branch=main "$CASE/origin.git"
  git clone -q "$CASE/origin.git" "$LAB/projects/repo" 2>/dev/null
  PROJ="$LAB/projects/repo"
  git -C "$PROJ" commit -q --allow-empty -m baseline
  git -C "$PROJ" push -q origin main
  WT=$(cd "$PROJ" && treehouse get --lease --no-fetch --branch fm/task-x1 2> "$CASE/treehouse-get.log")
  printf 'local parent\n' > "$WT/parent.txt"
  git -C "$WT" add parent.txt
  git -C "$WT" commit -q -m 'local parent'
  git -C "$WT" push -q origin HEAD:refs/heads/fm/task-x1
  git -C "$PROJ" fetch -q origin
  file=config.yml
  good=$'a:\n  b: 1\n'
  bad=$'a:\nb: 1\n'
  if [ "$mode" = amended-python ]; then
    file=logic.py
    good=$'if False:\n    print("never")\n'
    bad=$'if False:\n    pass\nprint("never")\n'
    # Keep the change whitespace-only while changing execution.
    good=$'if False:\n    pass\n    print("never")\n'
  fi
  printf '%s' "$good" > "$WT/$file"
  git -C "$WT" add "$file"
  git -C "$WT" commit -q -m 'add semantic indentation'
  git clone -q "$CASE/origin.git" "$CASE/merged"
  git -C "$CASE/merged" checkout -q -b merged-head
  printf '%s' "$good" > "$CASE/merged/$file"
  git -C "$CASE/merged" add "$file"
  git -C "$CASE/merged" commit -q -m 'add semantic indentation'
  PR_HEAD=$(git -C "$CASE/merged" rev-parse HEAD)
  git -C "$CASE/merged" push -q origin HEAD:refs/pull/7/head
  git -C "$WT" fetch -q origin refs/pull/7/head
  case "$mode" in
    baseline-yaml|amended-*)
      printf '%s' "$bad" > "$WT/$file"
      git -C "$WT" add "$file"
      git -C "$WT" commit -q --amend --no-edit ;;
  esac
  if [ "$mode" = old-git-amended ]; then
    printf '%s' "$bad" > "$WT/$file"
    git -C "$WT" add "$file"
    git -C "$WT" commit -q --amend --no-edit
  fi
  HEAD_BEFORE=$(git -C "$WT" rev-parse HEAD)
  [ "$HEAD_BEFORE" != "$PR_HEAD" ]
  mkdir -p "$CASE/inputbin"
  # Only the forge response and pipeline lookup are offline inputs.
  # The executable under test, Git, Treehouse, tmux, and filesystem are real.
  cat > "$CASE/inputbin/gh" <<'SH'
#!/usr/bin/env bash
if [ "${1:-} ${2:-}" = 'pr view' ]; then
  printf 'MERGED\t%s\thttps://github.com/example/repo/pull/7\n' "$PROBE_PR_HEAD"
else
  exit 1
fi
SH
  cat > "$CASE/inputbin/no-mistakes" <<'SH'
#!/usr/bin/env bash
# This disposable task has no pipeline. Never contact the operator daemon.
exit 0
SH
  chmod +x "$CASE/inputbin/gh" "$CASE/inputbin/no-mistakes"
  export PROBE_PR_HEAD="$PR_HEAD"
  if [[ "$mode" = old-git-* ]]; then
    cat > "$CASE/inputbin/git" <<'SH'
#!/usr/bin/env bash
if [ "${1:-}" = patch-id ]; then
  printf '%s\n' "$*" >> "$PROBE_GIT_LOG"
  if [ "${2:-}" = --verbatim ]; then
    echo 'error: unknown option `verbatim`' >&2
    exit 129
  fi
fi
exec "$REAL_GIT" "$@"
SH
    chmod +x "$CASE/inputbin/git"
  fi
  export PROBE_GIT_LOG="$CASE/git.log"
  tmux -S .phase-test/tmux.sock new-window -d -t fm-lab-7781 -n fm-task-x1 -c "$ROOT" 'sleep 600'
  cat > "$LAB/state/task-x1.meta" <<EOF
window=fm-lab-7781:fm-task-x1
endpoint_task_id=task-x1
spawn_gen=live-probe-$mode
worktree=$WT
project=$PROJ
kind=ship
mode=no-mistakes
pr=https://github.com/example/repo/pull/7
pr_head=$PR_HEAD
EOF
  cp "$LAB/state/task-x1.meta" "$CASE/meta.before"
  touch "$LAB/state/.last-watcher-beat"
  tool="$ROOT/bin/fm-teardown.sh"
  [ "$mode" != baseline-yaml ] || tool="$ROOT/bin/.phase-baseline-teardown.sh"
  set +e
  PATH="$CASE/inputbin:$PATH" "$tool" task-x1 > "$CASE/stdout" 2> "$CASE/stderr"
  rc=$?
  set -e
  {
    printf 'mode=%s\nrevision=' "$mode"
    if [ "$mode" = baseline-yaml ]; then echo 417cec2feb4e2976c0acdb2527b87b3ccc71535f; else git rev-parse HEAD; fi
    printf 'command=FM_HOME=<marked-lab> TREEHOUSE_ROOT=<lab-pool> bin/fm-teardown.sh task-x1\nexit=%s\nlocal_head_before=%s\nmerged_head=%s\n' "$rc" "$HEAD_BEFORE" "$PR_HEAD"
    printf 'local content before teardown:\n%s' "$(git -C "$WT" show "$HEAD_BEFORE:$file")"
    printf '\nstdout:\n'
    cat "$CASE/stdout"
    printf 'stderr:\n'
    cat "$CASE/stderr"
    printf 'local_head_after=%s\n' "$(git -C "$WT" rev-parse HEAD)"
    if git -C "$WT" show-ref --verify --quiet refs/heads/fm/task-x1; then echo task_branch=retained; else echo task_branch=removed; fi
    if [ -e "$LAB/state/task-x1.meta" ]; then echo task_record=retained; else echo task_record=removed; fi
    if [ -f "$CASE/git.log" ]; then cat "$CASE/git.log"; fi
  } > "$EVIDENCE/live-$mode.log"
  cat "$EVIDENCE/live-$mode.log"
  case "$mode" in
    baseline-yaml|exact)
      [ "$rc" = 0 ]
      [ ! -e "$LAB/state/task-x1.meta" ]
      ! git -C "$WT" show-ref --verify --quiet refs/heads/fm/task-x1 ;;
    *)
      [ "$rc" = 1 ]
      grep -q 'REFUSED:.*not landed' "$CASE/stderr"
      [ "$(git -C "$WT" rev-parse HEAD)" = "$HEAD_BEFORE" ]
      [ "$(git -C "$WT" symbolic-ref --short HEAD)" = fm/task-x1 ]
      cmp "$CASE/meta.before" "$LAB/state/task-x1.meta" ;;
  esac
  if [[ "$mode" = old-git-* ]]; then
    grep -q -- 'patch-id --verbatim' "$CASE/git.log"
    ! grep -q -- '--stable' "$CASE/git.log"
  fi
  tmux -S .phase-test/tmux.sock kill-window -t fm-lab-7781:fm-task-x1 2>/dev/null || true
  rm -rf "$CASE"
done
