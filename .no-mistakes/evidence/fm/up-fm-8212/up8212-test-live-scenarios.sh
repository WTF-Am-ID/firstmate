#!/usr/bin/env bash
# One-run Test evidence harness. Reuses fixture boundaries, drives the real CLI.
set -euo pipefail
ROOT=${1:?pass the exact no-mistakes candidate working copy}
ROOT=$(git -C "$ROOT" rev-parse --show-toplevel)
EXPECTED=61fe82707e0f5fab1922efdc8fef8dff9cf781a9
[ "$(git -C "$ROOT" rev-parse HEAD)" = "$EXPECTED" ]
mkdir -p "$ROOT/.phase-test/up8212-live/tmp"
export TMPDIR="$ROOT/.phase-test/up8212-live/tmp"
LAB=$(mktemp -d "$TMPDIR/up8212-evidence.XXXXXX")
printf 'LIVE_TEST_PHASE=required\nLIVE_CANDIDATE=%s\nLIVE_PLATFORM=%s\nLIVE_PRODUCT=%s\nLIVE_SCRATCH=%s\n' \
  "$EXPECTED" "$(uname -s)" "$ROOT/bin/fm-contributions.sh" "$LAB"
. "$ROOT/tests/lib.sh"
# This extracts test fixture definitions, not production implementation assertions.
awk 'NR > 5 && /^failures=0$/ { exit } NR > 5 { print }' \
  "$ROOT/tests/fm-contributions.test.sh" > "$LAB/fixtures.sh"
. "$LAB/fixtures.sh"

show_state() {
  local home=$1 scenario=$2 sweep=$3 at=$4 elapsed=$5 coverage
  coverage=$(NOW="$at" bearings "$home")
  jq -cn --arg scenario "$scenario" --argjson sweep "$sweep" --arg now "$at" \
    --argjson elapsed "$elapsed" --rawfile order "$home/forge/order" \
    --slurpfile owner "$home/data/delivery/contributions.json" \
    --slurpfile scheduler "$home/state/contributions-poll.json" --argjson coverage "$coverage" '
    {scenario:$scenario,sweep:$sweep,now:$now,wall_seconds:$elapsed,
      read_order:($order | split("\n") | map(select(length > 0))),
      oldest_owner:($owner[0].records[0] | {url,checked_at,error,observation_state:.observation.state}),
      oldest_attempt:$scheduler[0].attempts["https://github.com/o/r/pull/8"],
      measured:($coverage.contributions | {known,checked,complete})}'
}

for scenario in timeout budget; do
  home=$(new_home "live-$scenario")
  if [ "$scenario" = timeout ]; then
    forge_home "$home"
    wrap_forge "$home"
    printf '1000\n' > "$home/forge/clock"
    printf 'budget-head\n' > "$home/forge/fault"
    mv "$home/fakebin/gh" "$home/fakebin/gh-lab-boundary"
    cat > "$home/fakebin/gh" <<'SH'
#!/usr/bin/env bash
set -eu
if [ "${1:-}" = api ] && [[ "${2:-}" =~ ^repos/o/r/pulls/[0-9]+$ ]]; then
  printf '%s\n' "${2##*/}" >> "$FORGE/order"
  printf '%s\n' "$(( $(cat "$FORGE/clock") + 6 ))" > "$FORGE/clock.next"
  mv "$FORGE/clock.next" "$FORGE/clock"
fi
exec "$(dirname "$0")/gh-lab-boundary" "$@"
SH
    chmod +x "$home/fakebin/gh"
  else
    schedule_forge "$home"
  fi
  record "$home" second 9 open mergeable
  record "$home" third 10 open mergeable
  mutate_record "$home" delivery '.records[0].checked_at="2026-09-15T08:00:00Z"'
  mutate_record "$home" second '.records[0].checked_at="2026-09-15T09:00:00Z"'
  mutate_record "$home" third '.records[0].checked_at="2026-09-15T09:00:00Z"'
  cp "$home/data/delivery/contributions.json" "$home/oldest-before.json"
  printf 'LIVE_SCENARIO_BEGIN %s FM_HOME=%s\n' "$scenario" "$home"
  for sweep in 0 1 2; do
    at=$(jq -nr --arg now "$NOW" --argjson sweep "$sweep" '(($now | fromdateiso8601) + $sweep * 300) | todateiso8601')
    start=$(/bin/date +%s)
    printf 'LIVE_COMMAND scenario=%s sweep=%s FM_CONTRIBUTIONS_NOW=%s bash %s poll\n' "$scenario" "$sweep" "$at" "$ROOT/bin/fm-contributions.sh"
    with_home "$home" env FORGE_SCHEDULE_COST=6 FORGE_SCHEDULE_FAULT="$scenario" \
      FM_CONTRIBUTIONS_NOW="$at" bash "$ROOT/bin/fm-contributions.sh" poll > "$home/poll-$sweep.stdout"
    elapsed=$(( $(/bin/date +%s) - start ))
    [ ! -s "$home/poll-$sweep.stdout" ] || fail 'budget refusal emitted an unavailable diagnostic'
    cmp -s "$home/oldest-before.json" "$home/data/delivery/contributions.json" \
      || fail 'a refused oldest read changed its saved observation'
    [ ! -s "$home/state/.wake-queue" ] || fail 'budget refusal emitted a wake'
    case "$sweep" in 0) expected=8 ;; 1) expected='8 10' ;; 2) expected='8 10 9' ;; esac
    [ "$(paste -sd ' ' "$home/forge/order")" = "$expected" ] || fail 'oldest timeout starved a later URL'
    jq -e --arg now "$NOW" '.attempts["https://github.com/o/r/pull/8"] == $now' \
      "$home/state/contributions-poll.json" >/dev/null || fail 'scheduler lost the refused attempt'
    NOW="$at" bearings "$home" | jq -e --argjson checked "$sweep" '.contributions.checked == $checked and .contributions.complete == false' \
      >/dev/null || fail 'attempt was counted as a good observation'
    if [ "$scenario" = timeout ] && [ "$sweep" -eq 0 ]; then
      [ "$elapsed" -ge 4 ] || fail 'the lab did not exercise a real bounded timeout'
    fi
    show_state "$home" "$scenario" "$sweep" "$at" "$elapsed"
  done
  printf 'LIVE_SCENARIO_PASS %s read_order="8 10 9" oldest_record_unchanged=true fresh_checked=2 known=3 complete=false wakes=0\n' "$scenario"
done

printf 'LIVE_SCENARIO_BEGIN missing-order-and-url-ties\n'
test_oldest_observations_use_the_whole_rotation
printf 'LIVE_SCENARIO_PASS missing-order-and-url-ties\n'
printf 'LIVE_SCENARIO_BEGIN shared-owners-and-terminal-settlement\n'
test_shared_url_observed_once
test_terminal_contribution_settles
test_late_owner_inherits_terminal_observation
printf 'LIVE_SCENARIO_PASS shared-owners-and-terminal-settlement\n'
printf 'LIVE_SCENARIO_BEGIN rejected-and-new-owners\n'
test_rejected_sole_owner_never_uses_a_read_slot
test_scheduler_accepts_owner_created_mid_poll
printf 'LIVE_SCENARIO_PASS rejected-and-new-owners\n'
printf 'LIVE_SCENARIO_BEGIN unsafe-scheduler-state\n'
test_scheduler_state_refuses_symlinks
printf 'LIVE_SCENARIO_PASS unsafe-scheduler-state\n'
printf 'LIVE_LAB_RESULT go scenarios=6 candidate=%s\n' "$(git -C "$ROOT" rev-parse HEAD)"
