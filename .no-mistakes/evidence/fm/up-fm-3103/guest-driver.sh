#!/usr/bin/env bash
set -euo pipefail
git clone -q "$SRC/candidate.bundle" "$SRC/product"
git -C "$SRC/product" checkout -q -b fm/up-fm-3103
candidate=$(git -C "$SRC/product" rev-parse HEAD)
test "$candidate" = 27406d7c42aad8136b7fe6800bfafae9cfc1c403
test "$(id -un)" = ubuntu
printf 'TEST_CANDIDATE=%s\nTEST_USER=%s\n' "$candidate" "$(id -un)"
git --version
jq --version
perl -e 'printf "perl %vd\n", $^V'
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Validation GIT_AUTHOR_EMAIL=validation@example.invalid
export GIT_COMMITTER_NAME=Validation GIT_COMMITTER_EMAIL=validation@example.invalid
export FM_TEST_EVIDENCE=1 FM_PROOF_REPO="$SRC/product"
cd "$SRC/product"
bash "$SRC/retry034-corrected-live.sh" s5
bash "$SRC/proof035-cli.sh"
bash bin/fm-test-run.sh --jobs 1 tests/fm-inactive-reconcile.test.sh
bash bin/fm-test-run.sh --jobs 1 tests/fm-dod-lib.test.sh
bash bin/fm-test-run.sh --jobs 1 tests/fm-pr-check-security.test.sh
printf 'ACCEPTED_INCOMPLETE_SUITE=tests/fm-control-relaunch.test.sh;Pi-unavailable;prior-targeted-cases-and-S7-accepted;not-repeated\n'
printf 'TEST_PHASE_EXIT=0\n'
