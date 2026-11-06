#!/usr/bin/env bash
set -euo pipefail
git clone -q "$SRC/candidate.bundle" "$SRC/product"
git -C "$SRC/product" checkout -q -b fm/up-fm-3103
candidate=$(git -C "$SRC/product" rev-parse HEAD)
test "$candidate" = 735c27118dae7bf535522342d1d879db2a98e618
printf 'TEST_CANDIDATE=%s\n' "$candidate"
for tool in codex tmux treehouse; do
  if ! command -v "$tool"; then printf 'MISSING_TOOL=%s\n' "$tool"; fi
done
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Validation GIT_AUTHOR_EMAIL=validation@example.invalid
export GIT_COMMITTER_NAME=Validation GIT_COMMITTER_EMAIL=validation@example.invalid
export FM_PROOF_REPO="$SRC/product"
cd "$SRC/product"
timeout 120 bash "$SRC/readiness-driver.sh"
"$FM_PROOF_REPO/bin/fm-lab-home.sh" create "$SRC/default-brief" >/dev/null
FM_HOME="$SRC/default-brief" "$FM_PROOF_REPO/bin/fm-brief.sh" default-base demo --mode direct-PR
cat "$SRC/default-brief/data/default-base/brief.md"
printf 'DEFAULT_BRIEF_EXIT=0\n'
