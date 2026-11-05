#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
. "$ROOT/bin/fm-nm-run-lib.sh"
WORLD="$SRC/live"
mkdir -p "$WORLD"
lab() { "$ROOT/bin/fm-lab-home.sh" create "$1" >/dev/null; }
repo() {
  mkdir -p "$1"
  git -C "$1" init -q -b main
  git -C "$1" commit -q --allow-empty -m fixture
  git -C "$1" update-ref refs/remotes/origin/main "$(git -C "$1" rev-parse HEAD)"
}
if [ "${1:-all}" != s5 ]; then
printf '\nSCENARIO brief generation\n'
lab "$WORLD/brief"
FM_HOME="$WORLD/brief" "$ROOT/bin/fm-brief.sh" named-integration demo --mode direct-PR --base-branch release/integration
cat "$WORLD/brief/data/named-integration/brief.md"
printf 'BRIEF_EXIT=0\n'

# This synthetic forge is only the external CLI boundary. Every operation below
# executes the unmodified public Firstmate command in a disposable marked home.
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
mkdir -p "$FM_HOME/config"
printf 'forgejo.example\n' > "$FM_HOME/config/forgejo-hosts"
printf '\nSCENARIO public registration and polling with synthetic forge records\n'
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
    # Published watcher consumes the task-owned metadata, including legacy state.
    cp "$meta" "$meta.saved"
    sed '/^expected_base=/d' "$meta.saved" > "$meta"
    out=$("$FM_HOME/state/$provider.check.sh")
    test -z "$out"
    printf 'POLL %s missing-task-destination=silent\n' "$provider"
    printf 'base_branch=main\n' >> "$meta"
    out=$("$FM_HOME/state/$provider.check.sh")
    test "$out" = merged
    printf 'POLL %s legacy-named-base=%s\n' "$provider" "$out"
    cp "$meta.saved" "$meta"
  fi
  # Mismatched and unreadable proof must refuse registration before publication.
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

printf '\nSCENARIO merge refuses retarget and moved reviewed head\n'
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

printf '\nSCENARIO real crew-state refuses a deadline-truncated pipeline read\n'
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
printf 'TRUNCATED_READ_EXIT=0\n'
fi

[ "${1:-all}" != cli ] || exit 0

printf '\nSCENARIO S5 public scan with three real sleeping destination reads\n'
for timer in normal perl; do
  scene="$WORLD/s5-$timer"
  mkdir -p "$scene/tools" "$scene/forge"
  for tool in perl bash sh env sleep git dirname basename mkdir mktemp chmod mv rm rmdir cat grep tail cut tr sed stat date wc head sort find awk readlink id ps shasum sha256sum cksum touch ln uname cmp realpath jq; do
    path=$(type -P "$tool" 2>/dev/null) || continue
    ln -s "$path" "$scene/tools/$tool"
  done
  if [ "$timer" = normal ]; then
    ln -s "$(type -P timeout)" "$scene/tools/timeout"
  fi
  lab "$scene/parent"
  lab "$scene/mate"
  printf 'mate\n' > "$scene/mate/.fm-secondmate-home"
  printf 'schema=fm-secondmate-parent.v1\nroute=local\nparent_home=%s\n' "$scene/parent" > "$scene/mate/.fm-secondmate-parent"
  number=0
  for child in a-hung b-hung c-hung z-ready; do
    number=$((number+1))
    repo "$scene/mate/projects/$child"
    head=$(git -C "$scene/mate/projects/$child" rev-parse HEAD)
    printf 'window=firstmate:fm-%s\nworktree=%s\nproject=%s\nharness=codex\nkind=ship\nmode=direct-PR\nyolo=off\nspawn_gen=s1.1.1\nexpected_base=main\npr=https://github.com/o/r/pull/%s\npr_head=%s\n' "$child" "$scene/mate/projects/$child" "$scene/mate/projects/$child" "$number" "$head" > "$scene/mate/state/$child.meta"
    printf 'done: PR https://github.com/o/r/pull/%s checks green\n' "$number" > "$scene/mate/state/$child.status"
    touch -d '5 minutes ago' "$scene/mate/state/$child.meta" "$scene/mate/state/$child.status"
  done
  cat > "$scene/forge/gh" <<'SH'
#!/usr/bin/env bash
printf '%s %s %s %s\n' "$$" "${FM_READ_DEADLINE:-0}" "$(date +%s%3N)" "${3:-}" >> "$S5_PIDS"
case "${3:-}" in
  */1|*/2|*/3) exec sleep 30 ;;
  */4) printf 'main\n' ;;
  *) exit 97 ;;
esac
SH
  chmod +x "$scene/forge/gh"
  mechanism=$(PATH="$scene/tools" bash -c '. "$1"; fm_timeout_mechanism' _ "$ROOT/bin/fm-timeout-lib.sh")
  test "$timer:$mechanism" = normal:timeout || test "$timer:$mechanism" = perl:perl
  printf 'S5 mechanism=%s\n' "$mechanism"
  for scan in 1 2 3 4 5; do
    : > "$scene/pids"
    started=$(fm_nm_now_ms)
    PATH="$scene/forge:$scene/tools" FM_HOME="$scene/mate" FM_ROOT_OVERRIDE="$ROOT" FM_STATE_OVERRIDE="$scene/mate/state" FM_CONFIG_OVERRIDE="$scene/mate/config" FM_DATA_OVERRIDE="$scene/mate/data" S5_PIDS="$scene/pids" FM_INACTIVE_RECONCILE_BUDGET_SECS=3 "$ROOT/bin/fm-inactive-reconcile.sh" scan
    elapsed=$(( $(fm_nm_now_ms) - started ))
    printf 'S5 timer=%s scan=%s elapsed_ms=%s cursor=%s\n' "$timer" "$scan" "$elapsed" "$(cat "$scene/mate/state/.terminal-outcome-ledger-scan" 2>/dev/null || true)"
    test "$elapsed" -le 4000
    while read -r pid deadline read_start url; do
      state=$(ps -p "$pid" -o stat= 2>/dev/null || true)
      printf 'S5 pid=%s deadline=%s start_ms=%s url=%s state_after_scan=%s\n' "$pid" "$deadline" "$read_start" "$url" "${state:-gone}"
      case "$state" in ''|*Z*) ;; *) kill "$pid"; exit 1 ;; esac
      test "$deadline" -gt "$read_start"
      printf '%s\n' "$url" >> "$scene/visited"
    done < "$scene/pids"
    grep -q child-outcome-z-ready-done "$scene/parent/state/mate.status" 2>/dev/null && break
  done
  for number in 1 2 3; do
    grep -Fxq "https://github.com/o/r/pull/$number" "$scene/visited"
  done
  cat "$scene/parent/state/mate.status"
  test "$(grep -c child-outcome-z-ready-done "$scene/parent/state/mate.status")" = 1
  ! grep -Eq 'child-outcome-[abc]-hung' "$scene/parent/state/mate.status"
  count=0
  for receipt in "$scene/mate/state/terminal-outcomes/"*.reported; do
    test -f "$receipt" || continue
    cat "$receipt"
    count=$((count+1))
  done
  test "$count" = 1
  printf 'S5_PASS timer=%s scan=%s\n' "$timer" "$scan"
done
printf 'S5_EXIT=0\n'
