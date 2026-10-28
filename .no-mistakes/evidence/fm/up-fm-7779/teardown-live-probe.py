import json, os, pathlib, shutil, subprocess, tempfile

ROOT = pathlib.Path.cwd()
EVIDENCE = pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615TS187BHETD3WPXZCBJD3')
BASE = '417cec2feb4e2976c0acdb2527b87b3ccc71535f'
env = dict(os.environ)
for k in list(env):
    if (k.startswith('FM_') and k.endswith('_OVERRIDE')) or k in ('FM_GATE_REFUSE_BYPASS', 'FM_TASK_ID', 'TASKS_AXI_FILE', 'TASKS_AXI_BACKEND', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'TMUX'):
        env.pop(k, None)
env.update(GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1', GIT_AUTHOR_NAME='probe', GIT_AUTHOR_EMAIL='probe@example.invalid', GIT_COMMITTER_NAME='probe', GIT_COMMITTER_EMAIL='probe@example.invalid')

def cmd(args, e=env, check=True):
    return subprocess.run([str(a) for a in args], env=e, cwd=ROOT, text=True, capture_output=True, check=check, timeout=90)

def executable(path, content):
    path.write_text(content)
    path.chmod(0o755)

scratch = pathlib.Path(tempfile.mkdtemp(prefix='.fm-7779-probe-', dir=ROOT))
baseline = ROOT / 'bin/.fm-teardown-before-7779.sh'
results = []
try:
    executable(baseline, cmd(['git', 'show', f'{BASE}:bin/fm-teardown.sh']).stdout)
    for revision, dirty in [('baseline', True), ('target', True), ('target', False)]:
        label = f'{revision}-' + ('hidden-untracked' if dirty else 'clean')
        case = scratch / label
        case.mkdir()
        home = case / 'home'
        cmd(['bash', 'bin/fm-lab-home.sh', 'create', home])
        fake = case / 'fakebin'
        fake.mkdir()
        project = home / 'projects/project'
        origin = case / 'origin.git'
        wt = case / 'wt'
        cmd(['git', 'init', '-q', '--bare', '--initial-branch=main', origin])
        cmd(['git', 'clone', '-q', origin, project])
        cmd(['git', '-C', project, 'commit', '-q', '--allow-empty', '-m', 'baseline'])
        cmd(['git', '-C', project, 'push', '-q', 'origin', 'main'])
        cmd(['git', '-C', project, 'remote', 'set-head', 'origin', 'main'])
        cmd(['git', '-C', project, 'worktree', 'add', '-q', '-b', 'fm/task-x1', wt, 'main'])
        cmd(['git', '-C', wt, 'config', 'status.showUntrackedFiles', 'no'])
        meta = home / 'state/task-x1.meta'
        meta.write_text(f'window=firstmate:fm-task-x1\nendpoint_task_id=task-x1\nworktree={wt}\nproject={project}\nkind=ship\nmode=no-mistakes\nspawn_gen=teardown-live-probe\nharness=codex\n')
        before = meta.read_bytes()
        (home / 'state/.last-watcher-beat').touch()
        payload = wt / 'new directory/newfile.txt'
        if dirty:
            payload.parent.mkdir()
            payload.write_text('unadded work\n')
        executable(fake / 'treehouse', '''#!/usr/bin/env bash
printf '%s\\n' "treehouse $*" >> "$PROBE_CALLS"
if [ "${1:-}" = return ]; then
  for arg in "$@"; do :; done
  git -C "$arg" reset --hard -q
  git -C "$arg" clean -fdq
fi
''')
        executable(fake / 'tmux', '#!/usr/bin/env bash\nprintf "%s\\n" "tmux $*" >> "$PROBE_CALLS"\nexit 0\n')
        executable(fake / 'no-mistakes', '#!/usr/bin/env bash\nprintf "%s\\n" "no-mistakes $*" >> "$PROBE_CALLS"\nexit 0\n')
        executable(fake / 'gh-axi', '#!/usr/bin/env bash\ncase "$1 $2" in\n "pr list") printf "%s\\n" "count: 0 (showing first 0)" "pull_requests[]: []";;\n *) exit 1;;\nesac\n')
        executable(fake / 'gh', '#!/usr/bin/env bash\nexit 1\n')
        calls = case / 'calls.log'
        e = dict(env, FM_HOME=str(home), PATH=str(fake)+os.pathsep+env['PATH'], PROBE_CALLS=str(calls), TMPDIR=str(case))
        plain = cmd(['git', '-C', wt, 'status', '--porcelain']).stdout
        explicit = cmd(['git', '-C', wt, 'status', '--porcelain', '--untracked-files=all']).stdout
        entry = baseline if revision == 'baseline' else ROOT / 'bin/fm-teardown.sh'
        run = cmd(['bash', entry, 'task-x1'], e=e, check=False)
        log = calls.read_text() if calls.exists() else ''
        result = dict(scenario=label, revision=BASE if revision == 'baseline' else cmd(['git','rev-parse','HEAD']).stdout.strip(), command=f'FM_HOME=<disposable-marked-lab> bash {entry.relative_to(ROOT)} task-x1', plain_git_status=plain, explicit_git_status=explicit, exit=run.returncode, stdout=run.stdout, stderr=run.stderr, dependency_calls=log, file_preserved=payload.exists() and payload.read_text()=='unadded work\n', metadata_preserved=meta.exists() and meta.read_bytes()==before, metadata_exists=meta.exists(), pool_return_called='treehouse return' in log, worktree_exists=wt.exists())
        results.append(result)
        (EVIDENCE / f'{label}.json').write_text(json.dumps(result, indent=2)+'\n')
        print(json.dumps(result), flush=True)
        if revision == 'target' and dirty:
            assert plain == '' and 'new directory/newfile.txt' in explicit
            assert run.returncode == 1 and 'uncommitted changes' in run.stderr and 'new directory/newfile.txt' in run.stderr
            assert result['file_preserved'] and result['metadata_preserved'] and not result['pool_return_called']
        elif revision == 'target':
            assert run.returncode == 0 and result['pool_return_called'] and not result['metadata_exists']
        else:
            assert run.returncode == 0 and result['pool_return_called'] and not result['file_preserved'] and not result['metadata_exists']
finally:
    baseline.unlink(missing_ok=True)
    shutil.rmtree(scratch)
