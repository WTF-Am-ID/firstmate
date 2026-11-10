#!/usr/bin/env bash
set -eu
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS FM_TEST_SEAM FM_BACKEND TMUX
ROOT=$PWD
EVIDENCE=~/.no-mistakes-upstream-codex/evidence/01M73QAK19J9F40JB1BZFA5JEN
LAB=$ROOT/.tmp-up3103-test/lab
cleanup() {
  if [ -S "$LAB/tmux/tmux-$(id -u)/fm-lab" ]; then
    tmux -S "$LAB/tmux/tmux-$(id -u)/fm-lab" kill-server
  fi
  rm -rf -- "$LAB"
}
trap cleanup EXIT
bin/fm-lab-home.sh create "$LAB"
export FM_HOME=$LAB
printf '\nGenerate default-base no-mistakes brief\n'
bin/fm-brief.sh default fixture --mode no-mistakes
printf '\nGenerate named integration-base brief\n'
bin/fm-brief.sh named fixture --mode direct-PR --base-branch release/integration
printf '\nGenerate local-only brief\n'
bin/fm-brief.sh local fixture --mode local-only
cp "$LAB/data/default/brief.md" "$EVIDENCE/brief-default.md"
cp "$LAB/data/named/brief.md" "$EVIDENCE/brief-named.md"
cp "$LAB/data/local/brief.md" "$EVIDENCE/brief-local.md"
python3 - "$LAB" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])/'data'
for task in ['default','named']:
    text=(p/task/'brief.md').read_text()
    dod=text.split('# Definition of done',1)[1]
    assert 'Before reporting ready, verify the live PR base against the task-owned expected destination' in dod
named=(p/'named/brief.md').read_text()
assert 'Base branch: release/integration' in named
assert '--base release/integration' in named
print('Generated brief contract: publishing modes require live destination verification inside Definition of done; named PR targets release/integration.')
PY
printf '\nTry the required private-socket Codex primary launch\n'
mkdir -p "$LAB/tmux"
codex --version
rc=0
env -u NO_MISTAKES_GATE -u FM_GATE_REFUSE_BYPASS -u FM_ROOT_OVERRIDE -u FM_STATE_OVERRIDE -u FM_DATA_OVERRIDE -u FM_CONFIG_OVERRIDE -u FM_PROJECTS_OVERRIDE TMUX_TMPDIR="$LAB/tmux" tmux -L fm-lab new-session -d -s primary -x 120 -y 40 -c "$PWD" -e FM_HOME="$LAB" codex || rc=$?
printf 'Private-socket launch exit=%s\n' "$rc"
if [ "$rc" = 0 ]; then
  TMUX_TMPDIR="$LAB/tmux" tmux -L fm-lab capture-pane -p -t primary
  TMUX_TMPDIR="$LAB/tmux" tmux -L fm-lab kill-server
fi
printf '\nCreate synthetic child and local parent homes\n'
MAIN=$LAB/parent
MATE=$LAB/mate
mkdir -p "$MAIN/state" "$MAIN/config" "$MATE/state" "$MATE/config" "$MATE/data" "$MATE/projects/child"
printf 'mate\n' > "$MATE/.fm-secondmate-home"
printf 'schema=fm-secondmate-parent.v1\nroute=local\nparent_home=%s\n' "$MAIN" > "$MATE/.fm-secondmate-parent"
git -C "$MATE/projects/child" init -q
git -C "$MATE/projects/child" -c user.name=Validation -c user.email=validation@example.invalid commit -q --allow-empty -m initial
HEAD_SHA=$(git -C "$MATE/projects/child" rev-parse HEAD)
git -C "$MATE/projects/child" update-ref refs/remotes/origin/main "$HEAD_SHA"
printf 'kind=ship\nmode=direct-PR\nharness=codex\nyolo=off\nworktree=%s\nproject=%s\nspawn_gen=validation.1\n' "$MATE/projects/child" "$MATE/projects/child" > "$MATE/state/child.meta"
printf 'done: ready for review\n' > "$MATE/state/child.status"
printf '\nReport a ready claim with missing expected destination and missing PR identity\n'
FM_HOME="$MATE" bin/fm-inactive-reconcile.sh report child
cat "$MAIN/state/mate.status"
printf '\nRetry that same claim to check one-time parent notice\n'
FM_HOME="$MATE" bin/fm-inactive-reconcile.sh report child
python3 - "$MAIN/state/mate.status" <<'PY'
import pathlib,sys
t=pathlib.Path(sys.argv[1]).read_text()
assert len(t.splitlines())==1
assert t.startswith('blocked ')
assert 'expected PR base unavailable' in t
assert 'Follow bin/fm-pr-check.sh recovery steps' in t
print('The parent received one blocked notice and no done claim.')
PY
printf '\nSupply expected destination but leave PR proof absent\n'
printf 'expected_base=main\n' >> "$MATE/state/child.meta"
FM_HOME="$MATE" bin/fm-inactive-reconcile.sh report child
test "$(wc -l < "$MAIN/state/mate.status" | tr -d ' ')" = 1
printf 'No done claim published without a canonical PR identity.\n'
printf '\nControl: a local-only task can report a preserved head without PR destination proof\n'
sed 's/mode=direct-PR/mode=local-only/' "$MATE/state/child.meta" > "$MATE/state/local.meta"
printf 'done: ready in branch\n' > "$MATE/state/local.status"
FM_HOME="$MATE" bin/fm-inactive-reconcile.sh report local
cat "$MAIN/state/mate.status"
python3 - "$MAIN/state/mate.status" <<'PY'
import pathlib,sys
t=pathlib.Path(sys.argv[1]).read_text()
assert len(t.splitlines())==2
assert 'child local done: ready in branch' in t
assert 'mode=local-only' in t
assert 'child child done:' not in t
print('The local-only control published done; the publishing task remained blocked.')
PY
printf '\nLocal product checks completed; disposable homes removed by EXIT trap.\n'
