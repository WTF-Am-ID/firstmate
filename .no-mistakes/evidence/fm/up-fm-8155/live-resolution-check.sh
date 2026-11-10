#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
EVIDENCE=~/.no-mistakes-upstream-codex/evidence/01M730DPQ9V199WZ4JSVEHQJE9
LAB=$(mktemp -d "$ROOT/.resolution-lab.XXXXXX")
trap 'chmod -R u+w "$LAB"; rm -rf -- "$LAB"' EXIT
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS TASKS_AXI_FILE TASKS_AXI_BACKEND FM_BACKEND
bash bin/fm-lab-home.sh create "$LAB"
export FM_HOME=$LAB TMUX="$LAB/private.sock,0,0" FM_SEND_SETTLE=0
printf 'backend = "markdown"\n[markdown]\npath = "data/backlog.md"\narchive = "data/done-archive.md"\ndone_keep = 100\n' > "$LAB/.tasks.toml"
printf '## In flight\n\n## Queued\n\n## Done\n' > "$LAB/data/backlog.md"
TASKS=$(command -v tasks-axi)
cap() { "$ROOT/bin/fm-captain-hold.sh" "$@"; }
task() { (cd "$LAB" && "$TASKS" "$@"); }
show() { task show "$1" --full; }
check() { case "$1" in *"$2"*) ;; *) printf 'ASSERTION FAILED: expected %s in\n%s\n' "$2" "$1"; exit 1 ;; esac; }
absent() { case "$1" in *"$2"*) printf 'ASSERTION FAILED: unexpected %s\n' "$2"; exit 1 ;; esac; }
reject() {
  local rc=0
  "$@" > "$LAB/refusal.txt" 2>&1 || rc=$?
  cat "$LAB/refusal.txt"
  printf 'REFUSAL_EXIT=%s\n' "$rc"
  [ "$rc" -ne 0 ]
}
meta() { printf 'window=lab:fm-%s\nbackend=tmux\nharness=codex\nkind=ship\n' "$1" > "$LAB/state/$1.meta"; }
send() { "$ROOT/bin/fm-send.sh" "$@"; }
printf 'CANDIDATE=%s\n' "$(git rev-parse HEAD)"
old_path=$PATH
export REAL_TASKS_AXI=$TASKS
mkdir "$LAB/faultbin"
printf '%s\n' '#!/usr/bin/env bash' 'if [ "${1:-}" = done ] && [ "${2:-}" = "${FM_FAIL_TASK:-retry-call}" ] && [ ! -f "$FM_HOME/fault-fired" ]; then' '  touch "$FM_HOME/fault-fired"' '  exit 92' 'fi' 'exec "$REAL_TASKS_AXI" "$@"' > "$LAB/faultbin/tasks-axi"
chmod +x "$LAB/faultbin/tasks-axi"
printf 'Use the north route.\n' > "$LAB/answer.txt"
if [ "${1:-all}" = all ]; then
printf '\nS1 ordinary resolution attribution, synthetic CLI delivery with unavailable private terminal\n'
for kind in user supervisor mechanical; do
  id=ordinary-$kind
  meta "$id"
  printf 'needs-decision [key=route]: choose route\n' > "$LAB/state/$id.status"
  flags=()
  [ "$kind" != user ] || flags=(--source-time 2026-11-04T15:23:07Z)
  send "$id" --resolve-key route --source-kind "$kind" --source "$kind:proof-message-7" ${flags[@]+"${flags[@]}"} 'Use north'
  cat "$LAB/state/$id.status" "$LAB/state/$id.inbox/001.msg"
  check "$(cat "$LAB/state/$id.status")" "[source-kind=$kind] [source=$kind:proof-message-7]"
  check "$(cat "$LAB/state/$id.inbox/001.msg")" 'Use north'
done
check "$(cat "$LAB/state/ordinary-user.status")" '[source-time=2026-11-04T15:23:07Z]'
printf 'S1 PASS\n'

printf '\nS2 refusals leave decision open and inbox absent, enqueue failure closes nothing\n'
meta guarded
printf 'needs-decision [key=route]: choose route\n' > "$LAB/state/guarded.status"
original=$(cat "$LAB/state/guarded.status")
reject send guarded --resolve-key route 'Use north'
reject send guarded --resolve-key route --source-kind user --source message:8 'Use north'
reject send guarded --resolve-key route --source-kind user --source message:8 --source-time 2026-11-04T15:23:07+00:00 'Use north'
reject send guarded --resolve-key route --source-kind supervisor --source 'bad[reference]' 'Use north'
reject send guarded --resolve-key wrong-key --source-kind supervisor --source judgement:8 'Use north'
[ ! -e "$LAB/state/guarded.inbox" ]
[ "$original" = "$(cat "$LAB/state/guarded.status")" ]
: > "$LAB/state/guarded.inbox"
reject send guarded --resolve-key route --source-kind supervisor --source judgement:8 'Use north'
[ "$original" = "$(cat "$LAB/state/guarded.status")" ]
cat "$LAB/state/guarded.status"
printf 'S2 PASS\n'

printf '\nS3 direct and shared answers preserve distinct authority labels and message time\n'
printf 'Use the north route.\n' > "$LAB/answer.txt"
for kind in user supervisor mechanical; do
  for interface in answer answers; do
    id=$interface-$kind
    cap hold "$id" --title "Synthetic $interface $kind" --reason choose
    flags=()
    [ "$kind" != user ] || flags=(--source-time 2026-11-04T15:23:07Z)
    if [ "$interface" = answer ]; then
      cap answer "$id" --decision-file "$LAB/answer.txt" --source-kind "$kind" --source "$kind:message-9" ${flags[@]+"${flags[@]}"}
    else
      printf '%s\tnorth\t\n' "$id" | cap answers --source-kind "$kind" --source "$kind:message-9" ${flags[@]+"${flags[@]}"}
    fi
    output=$(show "$id"); printf '%s\n' "$output"
    check "$output" 'state: done'
    check "$output" "Source kind: $kind"
    check "$output" "Source reference: $kind:message-9"
    if [ "$kind" = user ]; then
      check "$output" 'Captain decision:'
      check "$output" 'Source message UTC: 2026-11-04T15:23:07Z'
    else
      check "$output" 'Resolution decision:'
      absent "$output" 'Captain decision:'
    fi
  done
done
printf 'S3 PASS\n'

printf '\nS4 interrupted fm-send closure produces a replayable recovery command\n'
cap hold retry-call --title 'Interrupted close proof' --reason choose
meta delivery
export PATH="$LAB/faultbin:$PATH"
reject send delivery --resolve-key retry-call --source-kind user --source 'message:quoted route 10' --source-time 2026-11-04T15:23:07Z 'Choose "north"; retain $cash'
output=$(show retry-call); printf '%s\n' "$output"
check "$output" 'held: yes'
check "$output" 'Source reference: message:quoted route 10'
cp "$LAB/refusal.txt" "$EVIDENCE/recovery-hint.txt"
retry=$(sed -n 's/^.*Close it with: \(.*\) - do not resend the answer\.$/\1/p' "$LAB/refusal.txt")
[ -n "$retry" ]
reject cap answer retry-call --decision-file "$LAB/answer.txt" --source-kind user --source message:changed --source-time 2026-11-04T15:23:07Z
[ "$output" = "$(show retry-call)" ]
printf 'EXECUTING PRINTED RECOVERY: %s\n' "$retry"
bash -c "$retry"
bash -c "$retry"
output=$(show retry-call); printf '%s\n' "$output"
check "$output" 'state: done'
[ "$(printf '%s' "$output" | grep -o 'Resolution recorded by fm-captain-hold\.' | wc -l | tr -d ' ')" = 1 ]
[ "$(ls "$LAB/state/delivery.inbox/"*.msg | wc -l | tr -d ' ')" = 1 ]
export PATH=$old_path
printf 'S4 PASS\n'
fi

printf '\nS5 reconciliation source binds evidence content across bracketed and copied paths\n'
cap hold reconcile-proof --title 'Evidence proof' --reason choose
cap bind local-proof
printf 'reconcile-proof\n' | cap reconcile-requests --source-id local-proof --source 'synthetic board selection'
printf 'The old route is no longer deployed.\n' > "$LAB/evidence[1].txt"
export FM_FAIL_TASK=reconcile-proof PATH="$LAB/faultbin:$old_path"
rm -f -- "$LAB/fault-fired"
reject cap reconcile close reconcile-proof --evidence-file "$LAB/evidence[1].txt"
output=$(show reconcile-proof)
check "$output" 'held: yes'
check "$output" 'Source kind: mechanical'
cp "$LAB/evidence[1].txt" "$LAB/copied.txt"
chmod 0500 "$LAB/state/reconcile-requests"
reject cap reconcile close reconcile-proof --evidence-file "$LAB/copied.txt"
output=$(show reconcile-proof); printf '%s\n' "$output"
check "$output" 'state: done'
check "$output" 'Source kind: mechanical'
check "$output" 'Source reference: fm-captain-hold reconcile close: sha256:'
check "$output" 'Reconciliation evidence:'
absent "$output" 'Captain decision:'
check "$output" 'state: done'
[ "$(printf '%s' "$output" | grep -o 'Resolution recorded by fm-captain-hold\.' | wc -l | tr -d ' ')" = 1 ]
printf 'Different evidence\n' > "$LAB/changed.txt"
reject cap reconcile close reconcile-proof --evidence-file "$LAB/changed.txt"
[ "$output" = "$(show reconcile-proof)" ]
chmod 0700 "$LAB/state/reconcile-requests"
cap reconcile close reconcile-proof --evidence-file "$LAB/copied.txt"
export PATH=$old_path
printf 'S5 PASS\n'

printf '\nS6 reserved close vocabulary and persisted source-free legacy replay remain compatible\n'
meta reserved
key=pending-reply-abcdef0123456789
printf 'blocked [key=%s]: pending-reply-missed: task=reserved pending-reply-id=abcdef0123456789 request=ship it\n' "$key" > "$LAB/state/reserved.status"
send reserved --resolve-key "$key" --source-kind supervisor --source judgement:reserved 'False escalation'
output=$(cat "$LAB/state/reserved.status"); printf '%s\n' "$output"
check "$output" 'pending-reply-resolved: task=reserved pending-reply-id=abcdef0123456789 via=operator-resolve-key'
check "$output" '[source-kind=supervisor] [source=judgement:reserved]'
absent "$output" "resolved [key=$key]: answered:"
if [ "${1:-all}" != all ]; then
  cap hold answer-user --title 'Legacy replay setup' --reason choose
  cap answer answer-user --decision-file "$LAB/answer.txt" --source-kind user --source message:old --source-time 2026-11-04T15:23:07Z
fi
show answer-user | sed -n 's/^  body: //p' | jq -r . | sed '/^Source kind: /d; /^Source reference: /d; /^Source message UTC: /d' > "$LAB/legacy-body.txt"
task update answer-user --body-file "$LAB/legacy-body.txt"
before=$(show answer-user)
cap answer answer-user --decision-file "$LAB/answer.txt" --source-kind user --source 'new declaration cannot rewrite legacy' --source-time 2026-11-04T15:23:07Z
output=$(show answer-user); printf '%s\n' "$output"
[ "$before" = "$output" ]
absent "$output" 'Source kind:'
printf 'S6 PASS\n'
printf '\nALL LIVE CLI SCENARIOS PASSED\n'
