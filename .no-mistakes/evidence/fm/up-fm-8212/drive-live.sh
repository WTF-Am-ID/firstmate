#!/usr/bin/env bash
set -euo pipefail
EVIDENCE=${2:?evidence directory}
. /tmp/upfm8212-evidence/up8212-test-live-scenarios.sh "$1"

# Retain actual synthetic product output and persisted byte contracts before
# tests/lib.sh removes its private fixture root at shell exit.
python3 - "$TMP_ROOT" "$EVIDENCE/product-state.json" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
rows = []
for home in sorted(root.iterdir()):
    if not home.is_dir():
        continue
    files = {}
    selected = [home / 'forge' / n for n in ('order', 'calls', 'clock')]
    selected += [home / 'state' / n for n in ('contributions-poll.json', '.wake-queue')]
    selected += list((home / 'data').glob('*/contributions.json'))
    selected += list(home.glob('poll-*.stdout'))
    selected += [home / n for n in ('oldest-before.json', 'malformed-prior.json', 'target.json', 'target-prior.json', 'prior.json', 'final.json')]
    for file in selected:
        if file.is_symlink():
            files[str(file.relative_to(home))] = {'symlink': str(file.readlink())}
        elif file.is_file():
            data = file.read_text()
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                pass
            files[str(file.relative_to(home))] = data
    rows.append({'synthetic_home': home.name, 'files': files})
pathlib.Path(sys.argv[2]).write_text(json.dumps(rows, indent=2) + '\n')
print('LIVE_PRODUCT_STATE_ARTIFACT=' + sys.argv[2])
PY

# The unsafe-state scenario also covers a regular but invalid state document.
home=$(new_home invalid-scheduler-evidence)
forge_home "$home"
wrap_forge "$home"
printf '{"schema":"fm-contributions-poll.v1","attempts":{"https://github.com/o/r/pull/8":"not-a-date"}}\n' > "$home/state/contributions-poll.json"
cp "$home/state/contributions-poll.json" "$home/prior.json"
set +e
out=$(with_home "$home" "$ROOT/bin/fm-contributions.sh" poll 2>&1)
rc=$?
set -e
printf 'LIVE_INVALID_SCHEDULER exit=%s output=%s\n' "$rc" "$out"
[ "$rc" -ne 0 ] || fail 'invalid scheduler state was accepted'
[[ "$out" = *'invalid contribution scheduler state'* ]] || fail 'invalid scheduler state lacked its diagnostic'
[ ! -s "$home/forge/calls" ] || fail 'invalid scheduler state contacted the forge'
cmp "$home/prior.json" "$home/state/contributions-poll.json" || fail 'invalid scheduler state was overwritten'
printf 'LIVE_INVALID_SCHEDULER forge_reads=0 state_unchanged=true\n'
printf 'LIVE_EVIDENCE_COMPLETE candidate=%s\n' "$(git -C "$ROOT" rev-parse HEAD)"
