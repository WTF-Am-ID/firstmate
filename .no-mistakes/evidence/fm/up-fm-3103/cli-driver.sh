#!/usr/bin/env bash
set -euo pipefail
ROOT=${FM_PROOF_REPO:?}
. "$ROOT/bin/fm-nm-run-lib.sh"
WORLD="$SRC/cli-live"
mkdir -p "$WORLD"
lab() { "$ROOT/bin/fm-lab-home.sh" create "$1" >/dev/null; }
repo() {
  mkdir -p "$1"
  git -C "$1" init -q -b main
  git -C "$1" commit -q --allow-empty -m fixture
  git -C "$1" update-ref refs/remotes/origin/main "$(git -C "$1" rev-parse HEAD)"
}
printf 'SCENARIO brief generation\n'
lab "$WORLD/brief"
FM_HOME="$WORLD/brief" "$ROOT/bin/fm-brief.sh" named-integration demo --mode direct-PR --base-branch release/integration
grep -F 'Base branch: release/integration' "$WORLD/brief/data/named-integration/brief.md"
printf 'BRIEF_EXIT=0\n'
mkdir -p "$WORLD/forge-bin"
cat > "$WORLD/forge-bin/gh" <<'SH'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >> "$FORGE_LOG"
[ "${FORGE_UNREADABLE:-0}" = 0 ] || exit 1
case " $* " in
  *' pr merge '*) printf 'MERGE_CALL\n' >> "$FORGE_LOG"; exit 91 ;;
  *' --json state,baseRefName '*) printf '%s\tMERGED\n' "$FORGE_BASE" ;;
  *' --json baseRefName '*) printf '%s\n' "$FORGE_BASE" ;;
  *' --json isDraft '*) printf '{"isDraft":false}\n' ;;
  *statusCheckRollup*) printf '{"state":"OPEN","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","headRefOid":"%s","baseRefName":"%s","statusCheckRollup":[]}\n' "$FORGE_HEAD" "$FORGE_BASE" ;;
  *' --json headRefOid '*) printf '%s\n' "$FORGE_HEAD" ;;
  *) exit 92 ;;
esac
SH
cat > "$WORLD/forge-bin/glab" <<'SH'
#!/usr/bin/env bash
printf 'glab %s\n' "$*" >> "$FORGE_LOG"
[ "${FORGE_UNREADABLE:-0}" = 0 ] || exit 1
printf '{"target_branch":"%s","state":"merged"}\n' "$FORGE_BASE"
SH
cat > "$WORLD/forge-bin/gerrit-axi" <<'SH'
#!/usr/bin/env bash
printf 'gerrit %s\n' "$*" >> "$FORGE_LOG"
[ "${FORGE_UNREADABLE:-0}" = 0 ] || exit 1
printf '{"ok":true,"changes":[{"change":1,"branch":"%s","status":"MERGED","revision":"%s"}]}\n' "$FORGE_BASE" "$FORGE_HEAD"
SH
cat > "$WORLD/forge-bin/tea" <<'SH'
#!/usr/bin/env bash
printf 'tea %s\n' "$*" >> "$FORGE_LOG"
[ "${FORGE_UNREADABLE:-0}" = 0 ] || exit 1
case "$1" in
  login) printf '[{"name":"lab","url":"https://forgejo.example"}]\n' ;;
  api) printf '{"merged":true,"base":{"ref":"%s"}}\n' "$FORGE_BASE" ;;
  *) exit 93 ;;
esac
SH
chmod +x "$WORLD/forge-bin/"*
export PATH="$WORLD/forge-bin:$PATH" FORGE_LOG="$WORLD/forge.log" FORGE_BASE=main
: > "$FORGE_LOG"
repo "$WORLD/worktree"
export FORGE_HEAD
FORGE_HEAD=$(git -C "$WORLD/worktree" rev-parse HEAD)
lab "$WORLD/pr-home"
export FM_HOME="$WORLD/pr-home"
printf 'forgejo.example\n' > "$FM_HOME/config/forgejo-hosts"
for provider in github gitlab gerrit forgejo; do
  case "$provider" in
    github) url=https://github.com/o/r/pull/1; host=github.com; project=o/r ;;
    gitlab) url=https://gitlab.com/o/r/-/merge_requests/1; host=gitlab.com; project=o/r ;;
    gerrit) url=https://gerrit.example/c/o/r/+/1; host=gerrit.example; project=o/r ;;
    forgejo) url=https://forgejo.example/o/r/pulls/1; host=forgejo.example; project=o/r ;;
  esac
  meta="$FM_HOME/state/$provider.meta"
  printf 'window=firstmate:fm-%s\nworktree=%s\nproject=%s\nharness=codex\nkind=ship\nmode=direct-PR\nexpected_base=main\n' "$provider" "$WORLD/worktree" "$WORLD/worktree" > "$meta"
  "$ROOT/bin/fm-pr-check.sh" "$provider" "$url"
  test -f "$FM_HOME/state/$provider.pr-poll"
  printf 'REGISTER %s matching poll armed\n' "$provider"
  out=$("$ROOT/bin/fm-pr-poll.sh" --validated "$provider" "$url" "$host" "$project" 1 main)
  test "$out" = merged
  printf 'POLL %s matching=%s\n' "$provider" "$out"
  out=$(FORGE_BASE=wrong "$ROOT/bin/fm-pr-poll.sh" --validated "$provider" "$url" "$host" "$project" 1 main)
  test -z "$out"
  printf 'POLL %s retargeted=silent\n' "$provider"
  out=$(FORGE_UNREADABLE=1 "$ROOT/bin/fm-pr-poll.sh" --validated "$provider" "$url" "$host" "$project" 1 main)
  test -z "$out"
  printf 'POLL %s unreadable=silent\n' "$provider"
  if [ "$provider" != gerrit ]; then
    cp "$meta" "$meta.saved"
    sed '/^expected_base=/d' "$meta.saved" > "$meta"
    out=$(bash "$FM_HOME/state/$provider.check.sh")
    printf '%s\n' "$out"
    case "$out" in *'merge/readiness refused: expected PR base unavailable.'*) ;; *) exit 1 ;; esac
    test -z "$(bash "$FM_HOME/state/$provider.check.sh")"
    printf 'POLL %s missing-task-destination=one-recovery-notice-no-merge\n' "$provider"
    printf 'base_branch=main\n' >> "$meta"
    out=$(bash "$FM_HOME/state/$provider.check.sh")
    test "$out" = merged
    printf 'POLL %s legacy-named-base=%s\n' "$provider" "$out"
    cp "$meta.saved" "$meta"
  fi
  for mode in mismatch unreadable absent; do
    cp "$meta" "$FM_HOME/state/reject.meta"
    rc=0
    case "$mode" in
      mismatch) FORGE_BASE=wrong "$ROOT/bin/fm-pr-check.sh" reject "$url" > "$WORLD/refusal" 2>&1 || rc=$? ;;
      unreadable) FORGE_UNREADABLE=1 "$ROOT/bin/fm-pr-check.sh" reject "$url" > "$WORLD/refusal" 2>&1 || rc=$? ;;
      absent) sed '/^expected_base=/d' "$meta" > "$FM_HOME/state/reject.meta"; "$ROOT/bin/fm-pr-check.sh" reject "$url" > "$WORLD/refusal" 2>&1 || rc=$? ;;
    esac
    cat "$WORLD/refusal"
    test "$rc" != 0
    test ! -e "$FM_HOME/state/reject.pr-poll"
    printf 'REGISTER %s %s refused rc=%s\n' "$provider" "$mode" "$rc"
  done
done
printf 'FORGE_MATRIX_EXIT=0\n'
printf 'SCENARIO independent local and parent legacy recovery notices\n'
for order in ledger-first watcher-first; do
  home="$WORLD/legacy-$order"
  lab "$home"
  lab "$home-parent"
  printf 'mate\n' > "$home/.fm-secondmate-home"
  printf 'schema=fm-secondmate-parent.v1\nroute=local\nparent_home=%s\n' "$home-parent" > "$home/.fm-secondmate-parent"
  cp "$FM_HOME/state/github.meta" "$home/state/child.meta"
  sed '/^expected_base=/d' "$FM_HOME/state/github.meta" > "$home/state/child.meta"
  cp "$FM_HOME/state/github.pr-poll" "$home/state/child.pr-poll"
  cp "$FM_HOME/state/github.check.sh" "$home/state/child.check.sh"
  printf 'done: PR https://github.com/o/r/pull/1\n' > "$home/state/child.status"
  if [ "$order" = ledger-first ]; then
    FM_HOME="$home" "$ROOT/bin/fm-inactive-reconcile.sh" report child
  fi
  out=$(FM_HOME="$home" bash "$home/state/child.check.sh")
  printf 'LEGACY order=%s local=%s\n' "$order" "$out"
  case "$out" in *'merge/readiness refused: expected PR base unavailable.'*) ;; *) exit 1 ;; esac
  FM_HOME="$home" "$ROOT/bin/fm-inactive-reconcile.sh" report child
  FM_HOME="$home" "$ROOT/bin/fm-inactive-reconcile.sh" report child
  test -z "$(FM_HOME="$home" bash "$home/state/child.check.sh")"
  cat "$home-parent/state/mate.status"
  test "$(grep -c 'merge/readiness refused' "$home-parent/state/mate.status")" = 1
  ! grep -Eq '^done' "$home-parent/state/mate.status"
  printf 'expected_base=main\n' >> "$home/state/child.meta"
  FM_HOME="$home" "$ROOT/bin/fm-pr-check.sh" child https://github.com/o/r/pull/1
  test ! -e "$home/state/child.pr-base-notified"
  test ! -e "$home/state/child.pr-base-parent-notified"
  printf 'LEGACY order=%s one-local-one-parent rearm-cleared-both\n' "$order"
done
printf 'LEGACY_AUDIENCES_EXIT=0\n'
rc=0
FORGE_BASE=wrong "$ROOT/bin/fm-pr-merge.sh" github https://github.com/o/r/pull/1 > "$WORLD/merge.out" 2>&1 || rc=$?
cat "$WORLD/merge.out"
test "$rc" != 0
! grep -q MERGE_CALL "$FORGE_LOG"
printf 'MERGE retargeted refused rc=%s no-merge-call\n' "$rc"
rc=0
"$ROOT/bin/fm-pr-merge.sh" github https://github.com/o/r/pull/1 --expected-head 1111111111111111111111111111111111111111 > "$WORLD/merge.out" 2>&1 || rc=$?
cat "$WORLD/merge.out"
test "$rc" != 0
! grep -q MERGE_CALL "$FORGE_LOG"
grep -F 'not the expected head 1111111111111111111111111111111111111111' "$WORLD/merge.out"
printf 'MERGE moved-reviewed-head refused rc=%s no-merge-call\n' "$rc"
cat "$FORGE_LOG"
printf 'MERGE_BOUNDARY_EXIT=0\n'
lab "$WORLD/deadline-home"
mkdir -p "$WORLD/deadline-bin"
cat > "$WORLD/deadline-bin/no-mistakes" <<'SH'
#!/usr/bin/env bash
printf 'pipeline-read %s pid=%s\n' "$*" "$$" >> "$DEADLINE_LOG"
exec sleep 5
SH
chmod +x "$WORLD/deadline-bin/no-mistakes"
printf 'window=firstmate:fm-child\nworktree=%s\nproject=%s\nharness=codex\nkind=ship\nmode=no-mistakes\nyolo=off\n' "$WORLD/worktree" "$WORLD/worktree" > "$WORLD/deadline-home/state/child.meta"
printf 'done: implemented the change\n' > "$WORLD/deadline-home/state/child.status"
rc=0
started=$(fm_nm_now_ms)
out=$(PATH="$WORLD/deadline-bin:$PATH" FM_HOME="$WORLD/deadline-home" FM_READ_DEADLINE="$((started + 1000))" DEADLINE_LOG="$WORLD/deadline.log" "$ROOT/bin/fm-crew-state.sh" child) || rc=$?
elapsed=$(( $(fm_nm_now_ms) - started ))
printf 'CREW_STATE rc=%s elapsed_ms=%s output=%s\n' "$rc" "$elapsed" "$out"
cat "$WORLD/deadline.log"
test "$rc" = 124
case "$out" in 'state: unknown '*) ;; *) exit 1 ;; esac
test "$elapsed" -lt 2500
printf 'TRUNCATED_READ_EXIT=0\nCLI_PROOF_EXIT=0\n'
