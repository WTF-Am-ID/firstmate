#!/usr/bin/env bash
set -euo pipefail
ROOT=${FM_PROOF_REPO:?}
WORLD="$SRC/readiness-live"
mkdir -p "$WORLD/bin"
"$ROOT/bin/fm-lab-home.sh" create "$WORLD/home" >/dev/null
"$ROOT/bin/fm-lab-home.sh" create "$WORLD/parent" >/dev/null
printf 'mate\n' > "$WORLD/home/.fm-secondmate-home"
printf 'schema=fm-secondmate-parent.v1\nroute=local\nparent_home=%s\n' "$WORLD/parent" > "$WORLD/home/.fm-secondmate-parent"
export FM_HOME="$WORLD/home"
git init -q -b fm/task "$WORLD/repo"
git -C "$WORLD/repo" commit -q --allow-empty -m 'published candidate'
head=$(git -C "$WORLD/repo" rev-parse HEAD)
git -C "$WORLD/repo" update-ref refs/remotes/origin/fm/task "$head"
cat > "$WORLD/bin/gh" <<'SH'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >> "$READY_LOG"
[ "${READY_PROOF:-main}" != unreadable ] || exit 1
case " $* " in
  *' --json baseRefName '*) printf '%s\n' "${READY_PROOF:-main}" ;;
  *) exit 1 ;;
esac
SH
chmod +x "$WORLD/bin/gh"
export PATH="$WORLD/bin:$PATH" READY_LOG="$WORLD/forge.log"
: > "$READY_LOG"
index=0
for mode in direct-PR no-mistakes; do
  for proof in main wrong unreadable missing; do
    notes=('PR https://github.com/o/r/pull/12 checks green' 'checks green: https://github.com/o/r/pull/12' 'PR #12 checks green' 'checks green: PR#12' 'https://github.com/o/r/pull/12 checks green' 'https://gitlab.com/o/r/-/merge_requests/12 checks green' 'https://git.example.org/team/repo/pulls/12 checks green' '/pull/12 checks green' 'checks green after review (https://github.com/o/r/pull/12)' 'PR http://github.com/o/r/pull/12 checks green')
    if [ "$mode" = direct-PR ]; then
      notes+=('PR https://github.com/o/r/pull/12' 'PR #12' 'opened https://github.com/o/r/pull/12' 'https://github.com/o/r/pull/12' '/pull/12' 'implementation complete')
    fi
    for note in "${notes[@]}"; do
      index=$((index + 1))
      task="case-$index"
      printf 'window=firstmate:fm-%s\nworktree=%s\nproject=%s\nkind=ship\nharness=codex\nmode=%s\npr=https://github.com/o/r/pull/12\npr_head=%s\n' "$task" "$WORLD/repo" "$WORLD/repo" "$mode" "$head" > "$FM_HOME/state/$task.meta"
      [ "$proof" = missing ] || printf 'expected_base=main\n' >> "$FM_HOME/state/$task.meta"
      printf 'done: %s\n' "$note" > "$FM_HOME/state/$task.status"
      before=$(grep -c '^done' "$WORLD/parent/state/mate.status" 2>/dev/null || true)
      before=${before:-0}
      out=$(READY_PROOF="$proof" "$ROOT/bin/fm-inactive-reconcile.sh" report "$task")
      after=$(grep -c '^done' "$WORLD/parent/state/mate.status" 2>/dev/null || true)
      after=${after:-0}
      printf 'READINESS task=%s mode=%s proof=%s note=%s ready_before=%s ready_after=%s\n%s\n' "$task" "$mode" "$proof" "$note" "$before" "$after" "$out"
      if [ "$proof" = main ] && { [ "$note" = 'PR https://github.com/o/r/pull/12 checks green' ] || [ "$note" = 'PR https://github.com/o/r/pull/12' ]; }; then
        test "$after" = "$((before + 1))"
        tail -1 "$WORLD/parent/state/mate.status"
      else
        test "$after" = "$before"
      fi
    done
  done
done
cat "$READY_LOG"
printf 'READINESS_PUBLIC_CLI_EXIT=0\n'
