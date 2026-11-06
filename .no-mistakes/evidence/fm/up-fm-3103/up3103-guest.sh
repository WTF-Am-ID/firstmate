#!/usr/bin/env bash
set -euo pipefail
git clone -q "$SRC/candidate.bundle" "$SRC/product"
git -C "$SRC/product" checkout -q -b fm/up-fm-3103
candidate=$(git -C "$SRC/product" rev-parse HEAD)
test "$candidate" = 735c27118dae7bf535522342d1d879db2a98e618
test "$(id -un)" = ubuntu
printf 'TEST_CANDIDATE=%s\nTEST_USER=%s\n' "$candidate" "$(id -un)"
git --version
jq --version
perl -e 'printf "perl %vd\n", $^V'
for tool in codex tmux treehouse; do command -v "$tool" || true; done
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Validation GIT_AUTHOR_EMAIL=validation@example.invalid
export GIT_COMMITTER_NAME=Validation GIT_COMMITTER_EMAIL=validation@example.invalid
export FM_TEST_EVIDENCE=1 FM_PROOF_REPO="$SRC/product"
cd "$SRC/product"
overall=0
step() {
  local rc=0
  printf '\nBEGIN_CHECK %s\n' "$1"
  bash "$@" || rc=$?
  printf 'END_CHECK %s exit=%s\n' "$1" "$rc"
  [ "$rc" = 0 ] || overall=1
}
step "$SRC/stalled-read-driver.sh" s5
step "$SRC/cli-driver.sh"
step "$SRC/readiness-driver.sh"
step bin/fm-test-run.sh --jobs 1 tests/fm-dod-lib.test.sh
step bin/fm-test-run.sh --jobs 1 tests/fm-inactive-reconcile.test.sh
step bin/fm-test-run.sh --jobs 1 tests/fm-crew-state.test.sh
step bin/fm-test-run.sh --jobs 1 tests/fm-pr-check-security.test.sh
printf 'TEST_PHASE_EXIT=%s\n' "$overall"
exit "$overall"
