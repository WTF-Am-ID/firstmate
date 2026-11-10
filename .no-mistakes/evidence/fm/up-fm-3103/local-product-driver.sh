#!/usr/bin/env bash
set -euo pipefail
ROOT=$PWD
EVIDENCE=~/.no-mistakes-upstream-codex/evidence/01M73E74W2CG6332TM477GGFTR
LAB="$ROOT/.tmp-up3103-072/local-lab"
cleanup() { rm -rf -- "$LAB"; }
trap cleanup EXIT
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME='Local validation' GIT_AUTHOR_EMAIL=local@example.invalid
export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"
"$ROOT/bin/fm-lab-home.sh" create "$LAB"
export FM_HOME="$LAB"
printf 'Candidate: '; git rev-parse HEAD
printf '\nS1: actual brief CLI, default and named destinations\n'
"$ROOT/bin/fm-brief.sh" default synthetic --mode no-mistakes
"$ROOT/bin/fm-brief.sh" named synthetic --mode direct-PR --base-branch release/integration
"$ROOT/bin/fm-brief.sh" local synthetic --mode local-only
cp "$LAB/data/default/brief.md" "$EVIDENCE/default-brief.md"
cp "$LAB/data/named/brief.md" "$EVIDENCE/named-brief.md"
python3 - "$LAB" <<'PY'
import pathlib, sys
home = pathlib.Path(sys.argv[1])
for task in ('default', 'named', 'local'):
    text = (home / 'data' / task / 'brief.md').read_text()
    section = text.split('# Definition of done', 1)[1]
    print(f'--- {task}: delivered Definition of done ---')
    print(section.splitlines()[:9])
    if task != 'local':
        assert 'verify the live PR base against the task-owned expected destination' in section
    if task == 'named':
        assert 'release/integration' in section
PY
mkdir -p "$LAB/projects/child" "$LAB/parent/state"
git -C "$LAB/projects/child" init -q -b main
git -C "$LAB/projects/child" commit -q --allow-empty -m initial
HEAD_SHA=$(git -C "$LAB/projects/child" rev-parse HEAD)
git -C "$LAB/projects/child" update-ref refs/remotes/origin/main "$HEAD_SHA"
printf 'mate\n' > "$LAB/.fm-secondmate-home"
printf 'schema=fm-secondmate-parent.v1\nroute=local\nparent_home=%s/parent\n' "$LAB" > "$LAB/.fm-secondmate-parent"
cat > "$LAB/state/child.meta" <<EOF
worktree=$LAB/projects/child
project=$LAB/projects/child
kind=ship
mode=direct-PR
harness=codex
spawn_gen=local-validation.1
pr=https://github.com/synthetic/fixture/pull/1
EOF
printf 'done: PR https://github.com/synthetic/fixture/pull/1\n' > "$LAB/state/child.status"
printf '\nS5: real reconciliation CLI, missing destination, repeated fresh processes\n'
"$ROOT/bin/fm-inactive-reconcile.sh" report child
"$ROOT/bin/fm-inactive-reconcile.sh" report child
printf '%s\n' 'Parent channel after two report processes:'
cat "$LAB/parent/state/mate.status"
python3 - "$LAB" <<'PY'
import pathlib, sys
home = pathlib.Path(sys.argv[1])
lines = (home / 'parent/state/mate.status').read_text().splitlines()
assert len(lines) == 1, lines
assert lines[0].startswith('blocked '), lines
assert 'expected PR base unavailable' in lines[0], lines
assert not list((home / 'state/terminal-outcomes').glob('*.reported'))
assert (home / 'state/child.pr-base-parent-notified').is_file()
print('One blocked parent event, one delivery marker, no ready/merged terminal receipt.')
PY
printf '\nS6: moved local head must not produce a ready parent outcome\n'
printf '\nexpected_base=main\n' >> "$LAB/state/child.meta"
git -C "$LAB/projects/child" commit -q --allow-empty -m unpublished
printf 'done: PR https://github.com/synthetic/fixture/pull/2 checks green\n' > "$LAB/state/child.status"
"$ROOT/bin/fm-inactive-reconcile.sh" report child
python3 - "$LAB" <<'PY'
import pathlib, sys
home = pathlib.Path(sys.argv[1])
lines = (home / 'parent/state/mate.status').read_text().splitlines()
assert len(lines) == 1, lines
assert not list((home / 'state/terminal-outcomes').glob('*.reported'))
print('Unpublished moved head produced no ready event and no terminal receipt.')
print('Parent channel remains:')
print('\n'.join(lines))
PY
printf '\nAll local product CLI checks completed. Disposable lab removed by EXIT trap.\n'
