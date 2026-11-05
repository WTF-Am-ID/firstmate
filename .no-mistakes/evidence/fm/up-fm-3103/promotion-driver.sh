#!/usr/bin/env bash
set -euo pipefail
root=$PWD
lab="$root/.test-phase/promotion-lab"
evidence=~/.no-mistakes-upstream-codex/evidence/01M6NDZ52V94944PG4KY5EBCAJ
bin/fm-lab-home.sh create "$lab"
for sample in default pipeline named local; do
  case "$sample" in
    default) mode=direct-PR; pin=expected_base=main; expected=main ;;
    pipeline) mode=no-mistakes; pin=expected_base=main; expected=main ;;
    named) mode=direct-PR; pin=base_branch=integration/hub; expected=integration/hub ;;
    local) mode=local-only; pin=expected_base=main; expected= ;;
  esac
  mkdir -p "$lab/data/$sample" "$lab/projects/$sample"
  printf 'window=firstmate:fm-%s\nkind=scout\nworktree=%s\n%s\n' "$sample" "$lab/projects/$sample" "$pin" > "$lab/state/$sample.meta"
  cat > "$lab/data/$sample/brief.md" <<'EOF'
# Task
## Captain's intent
Preserve the task-owned pull request destination.

## Firstmate spec
Exercise the promotion command and inspect its generated delivery contracts.
EOF
  printf '\nCOMMAND: FM_HOME=<disposable-lab> bin/fm-promote.sh %s --mode %s --yolo off\n' "$sample" "$mode"
  FM_HOME="$lab" bin/fm-promote.sh "$sample" --mode "$mode" --yolo off
  for surface in ship-instructions.md brief.md; do
    cp "$lab/data/$sample/$surface" "$evidence/promotion-$sample-$surface"
    if [ -n "$expected" ]; then
      grep -Fx "Expected PR base: $expected" "$lab/data/$sample/$surface"
    else
      if grep -F 'Expected PR base:' "$lab/data/$sample/$surface"; then exit 1; fi
      printf '%s: no PR destination in local-only contract\n' "$surface"
    fi
  done
  printf 'persisted metadata:\n'
  cat "$lab/state/$sample.meta"
done
