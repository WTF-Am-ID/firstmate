#!/usr/bin/env bash
# Local-only landing must use the durable done head, including across races.
set -u
# shellcheck source=tests/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=bin/fm-dod-lib.sh
. "$ROOT/bin/fm-dod-lib.sh"

TMP_ROOT=$(fm_test_tmproot fm-merge-local)
fm_git_identity fmtest fmtest@example.invalid

make_case() {
  local name=$1
  CASE="$TMP_ROOT/$name"
  PROJ="$CASE/project"
  WT="$CASE/worker"
  HOME_DIR="$CASE/home"
  META="$HOME_DIR/state/local-task.meta"
  mkdir -p "$HOME_DIR/state" "$HOME_DIR/data" "$HOME_DIR/config" "$HOME_DIR/bin"
  printf '#!/bin/sh\nexit 0\n' > "$HOME_DIR/bin/fm-guard.sh"
  chmod +x "$HOME_DIR/bin/fm-guard.sh"
  fm_git_worktree "$PROJ" "$WT" fm/local-task
  BASE=$(git -C "$PROJ" rev-parse HEAD)
  git -C "$WT" commit -q --allow-empty -m X
  X=$(git -C "$WT" rev-parse HEAD)
  printf 'kind=ship\nmode=local-only\nbranch=fm/local-task\nproject=%s\nworktree=%s\nspawn_gen=fixture-1\n' \
    "$PROJ" "$WT" > "$META"
}

record_done() {
  FM_HOME="$HOME_DIR" fm_dod_accept_ship_done ship local-only "$WT" "$PROJ" \
    'done [at=1790000000]: ready in branch fm/local-task' \
    "$HOME_DIR/state" local-task "$META"
}

land() {
  FM_ROOT_OVERRIDE="$HOME_DIR" FM_HOME="$HOME_DIR" FM_STATE_OVERRIDE="$HOME_DIR/state" \
    bash "${MERGE_SCRIPT:-$ROOT/bin/fm-merge-local.sh}" local-task
}

assert_refused() {
  local out rc=0
  out=$(land 2>&1) || rc=$?
  [ "$rc" -ne 0 ] || fail "landing unexpectedly succeeded: $out"
  [ "$(git -C "$PROJ" rev-parse HEAD)" = "$BASE" ] || fail 'refusal moved main'
}

test_branch_advance_does_not_change_approval() {
  make_case advanced
  record_done || fail 'done head was not accepted'
  git -C "$WT" commit -q --allow-empty -m Y
  assert_refused
  # Re-reading the old done report must not silently approve Y.
  record_done >/dev/null 2>&1 && fail 'stale done report was rebound to Y'
  git -C "$WT" reset -q --hard "$X"
  land >/dev/null || fail 'approved X did not land'
  [ "$(git -C "$PROJ" rev-parse HEAD)" = "$X" ] || fail 'landing did not use X'
  pass 'branch advance refuses, and restoring the reported X lands exactly X'
}

test_missing_and_malformed_head_refuse() {
  local value
  for value in missing empty abbreviated expression duplicate; do
    make_case "$value"
    case "$value" in
      missing) ;;
      empty) printf 'local_done_head=\n' >> "$META" ;;
      abbreviated) printf 'local_done_head=%s\n' "${X:0:8}" >> "$META" ;;
      expression) printf 'local_done_head=refs/heads/fm/local-task\n' >> "$META" ;;
      duplicate) printf 'local_done_head=%s\nlocal_done_head=%s\n' "$X" "$X" >> "$META" ;;
    esac
    assert_refused
  done
  pass 'missing, malformed and ambiguous done heads refuse without moving main'
}

# A Git shim moves either approval metadata or the branch after the hold check.
# It is a scheduling seam only: every Git operation still uses the real binary.
test_change_after_hold_check_refuses() {
  local mode real_git out rc
  real_git=$(command -v git)
  for mode in branch approval; do
    make_case "race-$mode"
    record_done || fail 'race fixture done was not accepted'
    git -C "$WT" commit -q --allow-empty -m Y
    Y=$(git -C "$WT" rev-parse HEAD)
    git -C "$WT" reset -q --hard "$X"
    mkdir -p "$CASE/fakebin"
    cat > "$CASE/fakebin/git" <<'SH'
#!/usr/bin/env bash
case "$*" in
  *' merge --ff-only '*)
    if [ "$RACE_MODE" = branch ]; then
      "$REAL_GIT" -C "$RACE_PROJ" update-ref refs/heads/fm/local-task "$RACE_Y"
    else
      printf 'local_done_head=%s\n' "$RACE_Y" >> "$RACE_META"
    fi
    ;;
esac
exec "$REAL_GIT" "$@"
SH
    chmod +x "$CASE/fakebin/git"
    rc=0
    out=$(PATH="$CASE/fakebin:$PATH" REAL_GIT="$real_git" RACE_MODE="$mode" \
      RACE_PROJ="$PROJ" RACE_Y="$Y" RACE_META="$META" land 2>&1) || rc=$?
    # A branch race after Git itself starts cannot select Y: the merge operand
    # must already be X. Earlier races and metadata races must refuse.
    if [ "$rc" -eq 0 ]; then
      [ "$(git -C "$PROJ" rev-parse HEAD)" = "$X" ] || fail "race landed Y: $out"
    else
      [ "$(git -C "$PROJ" rev-parse HEAD)" = "$BASE" ] || fail 'race refusal moved main'
    fi
  done
  pass 'a concurrent branch or approval change cannot land Y'
}

test_change_during_approval_check_refuses() {
  local mode out rc
  for mode in branch approval; do
    make_case "approval-$mode"
    record_done || fail 'approval race fixture done was not accepted'
    git -C "$WT" commit -q --allow-empty -m Y
    Y=$(git -C "$WT" rev-parse HEAD)
    git -C "$WT" reset -q --hard "$X"
    cp -R "$ROOT/bin" "$CASE/toolbin"
    cat > "$CASE/toolbin/fm-captain-hold.sh" <<'SH'
#!/usr/bin/env bash
if [ "$RACE_MODE" = branch ]; then
  git -C "$RACE_PROJ" update-ref refs/heads/fm/local-task "$RACE_Y"
else
  printf 'local_done_head=%s\n' "$RACE_Y" >> "$RACE_META"
fi
exit 3
SH
    rc=0
    out=$(MERGE_SCRIPT="$CASE/toolbin/fm-merge-local.sh" RACE_MODE="$mode" \
      RACE_PROJ="$PROJ" RACE_Y="$Y" RACE_META="$META" land 2>&1) || rc=$?
    [ "$rc" -ne 0 ] || fail "approval race succeeded: $out"
    [ "$(git -C "$PROJ" rev-parse HEAD)" = "$BASE" ] || fail 'approval race moved main'
  done
  pass 'approval and branch changes during the hold read refuse without moving main'
}

test_snapshot_cannot_pin_a_replacement_task() {
  local captured
  make_case stale-snapshot
  captured="$CASE/local-task.meta"
  cp "$META" "$captured"
  printf 'spawn_gen=replacement\n' >> "$META"
  FM_HOME="$HOME_DIR" fm_dod_accept_ship_done ship local-only "$WT" "$PROJ" \
    'done: ready' "$HOME_DIR/state" local-task "$captured" >/dev/null 2>&1 \
    && fail 'a stale snapshot pinned a replacement task'
  assert_no_grep '^local_done_head=' "$META" 'stale snapshot changed live readiness'
  pass 'captured metadata cannot pin a replacement task generation'
}

fm_test_run test_branch_advance_does_not_change_approval \
  test_missing_and_malformed_head_refuse test_change_after_hold_check_refuses \
  test_change_during_approval_check_refuses test_snapshot_cannot_pin_a_replacement_task
