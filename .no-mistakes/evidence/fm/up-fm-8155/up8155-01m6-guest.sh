#!/usr/bin/env bash
set -euo pipefail
cd "$SRC"
export PATH="$SRC/deps/node_modules/.bin:$PATH"
git clone "$SRC/up8155-01m6-candidate.bundle" "$SRC/candidate"
cd "$SRC/candidate"
test "$(git rev-parse HEAD)" = 8e8be8f14a5b24982a8fc95e65eb7a843abab6d6
printf 'CANDIDATE=%s\nUSER=%s\n' "$(git rev-parse HEAD)" "$(id)"
node --version
tasks-axi --version
set +e
bash bin/fm-test-run.sh tests/fm-send-resolve-key.test.sh tests/fm-captain-hold-lifecycle.test.sh
rc=$?
set -e
printf 'FOCUSED_EXIT=%s\n' "$rc"
[ "$rc" = 0 ] || exit "$rc"

# Reuse the existing end-to-end definitions for reviewer-visible persisted output.
# The product and original test files stay byte-identical to the candidate.
sed '/^test_ordinary_source_flags_remain_message_text$/,$d' tests/fm-send-resolve-key.test.sh > tests/.test-phase-send-evidence.sh
cat >> tests/.test-phase-send-evidence.sh <<'EVIDENCE'
test_resolution_source_kinds_survive_closure
test_tight_status_budget_preserves_source
test_resolution_requires_source_before_delivery
test_user_source_requires_message_time
printf '\n=== SEND PERSISTED STATUS AND REFUSALS ===\n'
while IFS= read -r f; do printf '\nFILE %s\n' "$f"; cat "$f"; done < <(find "$TMP_ROOT" -type f \( -name '*.status' -o -name '*.err' \) | sort)
EVIDENCE
bash tests/.test-phase-send-evidence.sh
sed '/^test_interrupted_resolution_and_utf8_attribution$/,$d' tests/fm-captain-hold-lifecycle.test.sh > tests/.test-phase-hold-evidence.sh
cat >> tests/.test-phase-hold-evidence.sh <<'EVIDENCE'
test_interrupted_resolution_and_utf8_attribution
test_resolution_attribution
test_legacy_parent_replays_preserve_absent_attribution
printf '\n=== LIFECYCLE PERSISTED RECORDS, PARENT CHANNELS, AND REFUSALS ===\n'
while IFS= read -r f; do printf '\nFILE %s\n' "$f"; cat "$f"; done < <(find "$TMP_ROOT" -type f \( -name 'backlog.md' -o -name '*.status' -o -name 'changed.out' -o -name 'oversized.out' \) | sort)
EVIDENCE
bash tests/.test-phase-hold-evidence.sh
printf 'PRODUCT_EVIDENCE_EXIT=0\n'
