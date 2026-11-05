#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
LAB=/opt/src/live-homes
mkdir -p "$LAB/fakebin"
cat > "$LAB/fakebin/tmux" <<'SH'
#!/usr/bin/env bash
case "${1:-}" in
 display-message) printf '1\n';;
 capture-pane) printf '╭────╮\n│    │\n╰────╯\n';;
 list-windows) printf 'fm-worker\n';;
esac
exit 0
SH
chmod +x "$LAB/fakebin/tmux"
export PATH="$LAB/fakebin:$PATH"
mkhome() {
 H="$LAB/$1"
 mkdir -p "$H"/{state,data,config,projects}
 printf 'backend = "markdown"\n[markdown]\npath = "data/backlog.md"\narchive = "data/archive.md"\ndone_keep = 100\n' > "$H/.tasks.toml"
 printf '## In flight\n\n## Queued\n\n## Done\n' > "$H/data/backlog.md"
 printf 'window=sess:fm-worker\nkind=ship\nharness=codex\nbackend=tmux\n' > "$H/state/worker.meta"
}
send() { env FM_HOME="$H" FM_ROOT_OVERRIDE="$H" FM_SEND_SETTLE=0 "$ROOT/bin/fm-send.sh" worker "$@"; }
hold() { env FM_HOME="$H" "$ROOT/bin/fm-captain-hold.sh" "$@"; }
task() { (cd "$H" && tasks-axi "$@"); }
has() { grep -F -- "$2" "$1" >/dev/null || { echo "ASSERT_MISSING $2 in $1"; exit 1; }; }
not_has() { if grep -F -- "$2" "$1" >/dev/null; then echo "ASSERT_UNEXPECTED $2 in $1"; exit 1; fi; }
refuse() { set +e; "$@"; rc=$?; set -e; printf 'REFUSAL_EXIT=%s\n' "$rc"; test "$rc" -ne 0; }
printf '\nSCENARIO S1: real CLI status resolutions, synthetic user/supervisor/mechanical sources and tight line budget\n'
for kind in user supervisor mechanical; do
 mkhome "kind-$kind"
 printf 'needs-decision [key=choice]: select a route\n' > "$H/state/worker.status"
 at=; test "$kind" != user || at=2026-11-04T15:23:07Z
 send --resolve-key choice --source-kind "$kind" --source "$kind:message-901" --source-time "$at" 'Use route north'
 cat "$H/state/worker.status" "$H/state/worker.inbox/001.msg"
 has "$H/state/worker.status" "[source-kind=$kind] [source=$kind:message-901]"
 test "$kind" != user || has "$H/state/worker.status" "[source-time=$at]"
done
mkhome tight
printf 'needs-decision [key=choice]: select\n' > "$H/state/worker.status"
ref=$(printf '%100s' x | tr ' ' x)
send --resolve-key choice --source-kind user --source "$ref" --source-time 2026-11-04T15:23:07Z 'use REST'
cat "$H/state/worker.status"
has "$H/state/worker.status" "[source=$ref] [source-time=2026-11-04T15:23:07Z]"
test "$(tail -1 "$H/state/worker.status" | wc -c)" -le 221
echo 'SCENARIO_RESULT S1 PASS'
printf '\nSCENARIO S2: missing/invalid source refuses before enqueue or closure\n'
mkhome refusal
printf 'needs-decision [key=choice]: select\n' > "$H/state/worker.status"
refuse send --resolve-key choice 'north'
refuse send --resolve-key choice --source-kind user --source 'message-902' north
refuse send --resolve-key choice --source-kind supervisor --source '[forged]' north
test ! -d "$H/state/worker.inbox"
not_has "$H/state/worker.status" resolved
cat "$H/state/worker.status"
hold hold missing-source --title 'Missing source' --reason choose
printf 'north\n' > "$H/answer.txt"
refuse hold answer missing-source --decision-file "$H/answer.txt"
task show missing-source --full > "$H/record.txt"
not_has "$H/record.txt" 'Resolution recorded'
cat "$H/record.txt"
echo 'SCENARIO_RESULT S2 PASS'
printf '\nSCENARIO S3: direct, shared, and reconciliation preserve distinct declared authority\n'
mkhome held
printf 'north\n' > "$H/answer.txt"
hold hold direct --title Direct --reason choose
hold answer direct --decision-file "$H/answer.txt" --source-kind user --source 'chat:message-903' --source-time 2026-11-04T15:23:07Z
task show direct --full > "$H/direct.txt"
has "$H/direct.txt" 'Source kind: user'
has "$H/direct.txt" 'Source reference: chat:message-903'
has "$H/direct.txt" 'Source message UTC: 2026-11-04T15:23:07Z'
hold hold shared --title Shared --reason choose
printf 'shared\tnorth\t\n' | hold answers --source-kind supervisor --source 'supervisor:judgement-904'
task show shared --full > "$H/shared.txt"
has "$H/shared.txt" 'Source kind: supervisor'
not_has "$H/shared.txt" 'Captain decision:'
hold hold moot --title Moot --reason choose
hold bind board-fixture
printf 'moot\n' | hold reconcile-requests --source-id board-fixture --source 'board:result-905'
hold reconcile close moot --evidence-file "$H/answer.txt"
task show moot --full > "$H/moot.txt"
has "$H/moot.txt" 'Source kind: mechanical'
has "$H/moot.txt" "Source reference: fm-captain-hold reconcile close: $H/answer.txt"
has "$H/moot.txt" 'Reconciliation evidence:'
cat "$H/direct.txt" "$H/shared.txt" "$H/moot.txt"
echo 'SCENARIO_RESULT S3 PASS'
printf '\nSCENARIO S4: new source mismatch refuses and source-free legacy replay stays source-free\n'
refuse hold answer direct --decision-file "$H/answer.txt" --source-kind user --source 'different-message' --source-time 2026-11-04T15:23:07Z
task show direct --full | sed -n 's/^  body: //p' | jq -r . | sed '/^Source kind: /d; /^Source reference: /d; /^Source message UTC: /d' > "$H/legacy-body.txt"
task update direct --body-file "$H/legacy-body.txt"
hold answer direct --decision-file "$H/answer.txt" --source-kind user --source 'chat:message-903' --source-time 2026-11-04T15:23:07Z
task show direct --full > "$H/legacy.txt"
not_has "$H/legacy.txt" 'Source kind:'
cat "$H/legacy.txt"
echo 'SCENARIO_RESULT S4 PASS'
printf '\nSCENARIO S5: literal sends, exact keys, reserved keys, flag misuse, and failed enqueue\n'
mkhome guards
printf 'needs-decision [key=choice]: select\n' > "$H/state/worker.status"
refuse send --source-kind supervisor --source 'judgement-906' --key Enter --resolve-key choice
refuse send --resolve-key wrong --source-kind supervisor --source 'judgement-906' north
test ! -d "$H/state/worker.inbox"
send --source is the flag to pass
cat "$H/state/worker.inbox/001.msg"
has "$H/state/worker.inbox/001.msg" '--source is the flag to pass'
not_has "$H/state/worker.status" resolved
mkhome enqueue-fail
printf 'needs-decision [key=choice]: select\n' > "$H/state/worker.status"
printf 'not a directory\n' > "$H/state/worker.inbox"
refuse send --resolve-key choice --source-kind supervisor --source 'judgement-907' north
not_has "$H/state/worker.status" resolved
cat "$H/state/worker.status"
mkhome reserved
printf 'blocked [key=pending-reply-0123456789abcdef]: pending-reply-missed: task=worker pending-reply-id=0123456789abcdef request=choose\n' > "$H/state/worker.status"
send --resolve-key pending-reply-0123456789abcdef --source-kind supervisor --source 'judgement-908' north
cat "$H/state/worker.status"
has "$H/state/worker.status" '[source-kind=supervisor] [source=judgement-908]'
env FM_STATE_OVERRIDE="$H/state" "$ROOT/bin/fm-wake-drain.sh" > "$H/drain.txt"
cat "$H/drain.txt"
not_has "$H/drain.txt" 'OPEN DECISIONS'
echo 'SCENARIO_RESULT S5 PASS'
echo 'LIVE_EXIT=0'
