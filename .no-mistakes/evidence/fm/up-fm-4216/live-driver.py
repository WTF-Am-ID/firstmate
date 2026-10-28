import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path.cwd()
SCRATCH = ROOT / '.live-4216-test-current'
EVIDENCE = Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M61M7ZJKT753PDHW6ZNXF5HN')
GIT = shutil.which('git')
TREEHOUSE = shutil.which('treehouse')
OLD = SCRATCH / 'git-2.37.7/git'
env = os.environ.copy()
for key in list(env):
    if key.startswith('FM_') or key in ('TMUX', 'TMUX_PANE', 'TASKS_AXI_FILE', 'TASKS_AXI_BACKEND', 'TREEHOUSE_ROOT', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_COUNT'):
        env.pop(key, None)
env.update(GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1', GIT_AUTHOR_NAME='Live validation', GIT_AUTHOR_EMAIL='test@example.invalid', GIT_COMMITTER_NAME='Live validation', GIT_COMMITTER_EMAIL='test@example.invalid', GIT_TERMINAL_PROMPT='0')
lab = SCRATCH / 'lab'
results = []
socket_dir = None

def run(args, cwd=ROOT, extra=None, check=True, timeout=120):
    result = subprocess.run([str(x) for x in args], cwd=cwd, env={**env, **(extra or {})}, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(f'{args}: exit {result.returncode}\n{result.stdout}\n{result.stderr}')
    return result

def git(path, *args):
    return run([GIT, '-C', path, *args]).stdout.strip()

def write_exe(path, text):
    path.write_text(text)
    path.chmod(0o755)

try:
    run(['bash', 'bin/fm-lab-home.sh', 'create', lab])
    socket_dir = run(['bash', 'bin/fm-lab-home.sh', 'tmux-dir', lab]).stdout.strip()
    env.update(FM_HOME=str(lab), TMUX_TMPDIR=socket_dir)
    (lab / 'config/backlog-backend').write_text('manual\n')
    run(['tmux', '-L', 'fm-lab', 'new-session', '-d', '-s', 'primary', '-x', '100', '-y', '32', '-c', ROOT, 'sleep 3600'])
    socket = run(['tmux', '-L', 'fm-lab', 'display-message', '-p', '-t', 'primary', '#{socket_path},#{pid},0']).stdout.strip()
    env['TMUX'] = socket
    baseline_bin = SCRATCH / 'baseline/bin'
    shutil.copytree(ROOT / 'bin', baseline_bin)
    baseline = run([GIT, 'show', '4a67799d8a8670d6ea1a55250b67d8474b070a09:bin/fm-teardown.sh']).stdout
    (baseline_bin / 'fm-teardown.sh').write_text(baseline)
    for mode in ('old-git', 'unsupported-129', 'contained', 'conflict', 'unlanded', 'error'):
        case = SCRATCH / mode
        case.mkdir()
        origin, project, pool = case / 'origin.git', case / 'project', case / 'pool'
        run([GIT, 'init', '-q', '--bare', '--initial-branch=main', origin])
        run([GIT, 'clone', '-q', origin, project])
        (project / 'feature.txt').write_text('baseline\n')
        git(project, 'add', '.')
        git(project, 'commit', '-qm', 'baseline')
        git(project, 'push', '-q', 'origin', 'main')
        local = {'TREEHOUSE_ROOT': str(pool)}
        acquired = run([TREEHOUSE, 'get', '--lease', '--json', '--no-fetch', '--base', 'main', '-b', f'fm/task-{mode}'], cwd=project, extra=local)
        (EVIDENCE / f'{mode}-allocation.log').write_text(acquired.stdout + acquired.stderr)
        obj = json.loads(acquired.stdout[acquired.stdout.index('{'):])
        # Treehouse JSON owns the allocation's path field.
        path = obj.get('path') or obj.get('worktree') or obj.get('worktree_path')
        if isinstance(path, dict):
            path = path.get('path')
        if not path:
            raise RuntimeError(f'No allocation path in {obj}')
        wt = Path(path)
        (wt / 'feature.txt').write_text('task content\n')
        git(wt, 'add', 'feature.txt')
        git(wt, 'commit', '-qm', 'task work')
        if mode != 'unlanded':
            (project / 'feature.txt').write_text('conflicting content\n' if mode == 'conflict' else 'task content\n')
            git(project, 'add', 'feature.txt')
            git(project, 'commit', '-qm', 'squash task work')
            git(project, 'push', '-q', 'origin', 'main')
        task = f'task-{mode}'
        target = f'primary:fm-{task}'
        run(['tmux', '-L', 'fm-lab', 'new-window', '-d', '-t', 'primary', '-n', f'fm-{task}', '-c', wt, 'sleep 3600'])
        meta = lab / f'state/{task}.meta'
        status = lab / f'state/{task}.status'
        meta.write_text(f'window={target}\nendpoint_task_id={task}\nworktree={wt}\nproject={project}\nkind=ship\nmode=no-mistakes\nbackend=tmux\nspawn_gen=live-4216-{mode}\n')
        status.write_text('done: local scenario ready\n')
        (lab / 'state/.last-watcher-beat').touch()
        before = {'head': git(wt, 'rev-parse', 'HEAD'), 'branch': git(wt, 'symbolic-ref', '--short', 'HEAD'), 'meta': meta.read_text(), 'status': status.read_text(), 'content': (wt / 'feature.txt').read_text()}
        shim = case / 'shim'
        shim.mkdir()
        write_exe(shim / 'gh-axi', '#!/bin/sh\nprintf "count: 0 (showing first 0)\\npull_requests[]: []\\n"\n')
        write_exe(shim / 'gh', '#!/bin/sh\nexit 1\n')
        write_exe(shim / 'no-mistakes', '#!/bin/sh\nexit 0\n')
        write_exe(shim / 'treehouse', '#!/bin/bash\nprintf "%s\\n" "$*" >> "$LIVE_TREEHOUSE_LOG"\nexec "$LIVE_TREEHOUSE" "$@"\n')
        write_exe(shim / 'git', '''#!/bin/bash
args=("$@")
if [ "${1:-}" = -C ]; then shift 2; fi
if [ "${1:-}" = merge-tree ]; then
  printf '%s\\n' "$*" >> "$LIVE_MERGE_LOG"
  case "$LIVE_MODE" in
    old-git) exec "$LIVE_OLD_GIT" "${args[@]}" ;;
    unsupported-129) echo "error: unknown option 'write-tree'" >&2; exit 129 ;;
    error) echo 'fatal: unable to read tree object' >&2; exit 128 ;;
  esac
fi
exec "$LIVE_GIT" "${args[@]}"
''')
        extra = {**local, 'PATH': f'{shim}:{env["PATH"]}', 'LIVE_TREEHOUSE_LOG': str(case / 'treehouse.log'), 'LIVE_TREEHOUSE': TREEHOUSE, 'LIVE_GIT': GIT, 'LIVE_OLD_GIT': str(OLD), 'LIVE_MODE': mode, 'LIVE_MERGE_LOG': str(case / 'merge-tree.log')}
        proof = run([OLD if mode == 'old-git' else GIT, '-C', wt, 'merge-tree', '--write-tree', 'origin/main', 'HEAD'], check=False)
        if mode == 'old-git':
            prior = run(['bash', baseline_bin / 'fm-teardown.sh', task], extra=extra, check=False)
            (EVIDENCE / 'old-git-baseline.log').write_text(f'BASELINE exit={prior.returncode}\n{prior.stdout}{prior.stderr}')
            assert prior.returncode == 1 and 'not landed' in prior.stderr
            assert before['head'] == git(wt, 'rev-parse', 'HEAD') and meta.read_text() == before['meta']
        actual = run(['bash', 'bin/fm-teardown.sh', task], extra=extra, check=False)
        transcript = f'Scenario: {mode}\nCandidate: {git(ROOT, "rev-parse", "HEAD")}\nGit: {run([OLD if mode == "old-git" else GIT, "--version"]).stdout}Command: FM_HOME=<marked lab> TREEHOUSE_ROOT=<isolated pool> bash bin/fm-teardown.sh {task}\nDirect merge-tree probe exit={proof.returncode}\n{proof.stdout}{proof.stderr}\nTeardown exit={actual.returncode}\n{actual.stdout}{actual.stderr}\n'
        assert (case / 'merge-tree.log').exists(), 'containment not attempted'
        if mode == 'contained':
            assert actual.returncode == 0, transcript
            assert not meta.exists() and not status.exists()
            assert (case / 'treehouse.log').exists()
            windows = run(['tmux', '-L', 'fm-lab', 'list-windows', '-t', 'primary', '-F', '#{window_name}']).stdout.splitlines()
            assert f'fm-{task}' not in windows
            transcript += 'Observed: real Treehouse return ran, task metadata/status removed, task window closed.\n'
        else:
            assert actual.returncode == 1, transcript
            assert git(wt, 'rev-parse', 'HEAD') == before['head']
            assert git(wt, 'symbolic-ref', '--short', 'HEAD') == before['branch']
            assert meta.read_text() == before['meta'] and status.read_text() == before['status']
            assert (wt / 'feature.txt').read_text() == before['content']
            assert not (case / 'treehouse.log').exists()
            windows = run(['tmux', '-L', 'fm-lab', 'list-windows', '-t', 'primary', '-F', '#{window_name}']).stdout.splitlines()
            assert f'fm-{task}' in windows
            if mode in ('old-git', 'unsupported-129', 'error'):
                assert 'content-landed proof unavailable' in actual.stderr and 'not landed' not in actual.stderr, transcript
            else:
                assert 'not landed' in actual.stderr and 'proof unavailable' not in actual.stderr, transcript
            if mode == 'unsupported-129':
                assert 'Git 2.38 or newer required' in actual.stderr
            if mode == 'error':
                assert 'Git exit 128' in actual.stderr and 'Git 2.38' not in actual.stderr
            transcript += f'Observed preservation: HEAD={before["head"]}, branch={before["branch"]}, worktree bytes, metadata, status and real tmux task window unchanged. Treehouse return never invoked.\n'
        (EVIDENCE / f'{mode}-live.log').write_text(transcript)
        results.append({'scenario': mode, 'result': 'pass', 'exit': actual.returncode})
        print(json.dumps(results[-1]), flush=True)
finally:
    if socket_dir:
        stopped = run(['tmux', '-L', 'fm-lab', 'kill-server'], check=False)
        torn = run(['bash', 'bin/fm-lab-home.sh', 'teardown', lab], check=False)
        (EVIDENCE / 'lab-cleanup.log').write_text(f'Private tmux kill-server exit={stopped.returncode}\nPrivate socket teardown exit={torn.returncode}\n{torn.stdout}{torn.stderr}')
    (EVIDENCE / 'live-results.json').write_text(json.dumps(results, indent=2) + '\n')
