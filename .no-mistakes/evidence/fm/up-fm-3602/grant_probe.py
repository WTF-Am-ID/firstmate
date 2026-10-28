import json, os, pathlib, shutil, subprocess, time
root = pathlib.Path.cwd()
scratch = root / '.test-3602'
evidence = pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M619AKHZZ4PM0HFR59XMA839')
base = '417cec2feb4e2976c0acdb2527b87b3ccc71535f'
target = '8dce46f1707bb950cacfbc03d145442ac03a9dd4'
env = os.environ.copy()
for k in list(env):
    if k.startswith('FM_') or k in ('STATE', 'TMUX'):
        env.pop(k)
env['TMPDIR'] = str(scratch / 'tmp')
results = []
fixture = scratch / 'injected' / 'bin'
fixture.mkdir(parents=True, exist_ok=True)
for name in ('fm-wake-grant.sh', 'fm-wake-lib.sh', 'fm-path-lib.sh'):
    shutil.copyfile(root / 'bin' / name, fixture / name)
with (fixture / 'fm-wake-lib.sh').open('a') as f:
    f.write('\nfm_lock_acquire_wait() { printf "injected acquire failure\\n" >&2; return 2; }\n')
baseline = scratch / 'baseline' / 'bin'
baseline.mkdir(parents=True, exist_ok=True)
for name in ('fm-wake-lib.sh', 'fm-path-lib.sh'):
    shutil.copyfile(fixture / name, baseline / name)
(baseline / 'fm-wake-grant.sh').write_bytes(subprocess.check_output(['git', 'show', base + ':bin/fm-wake-grant.sh']))

def snapshot(state):
    out = {}
    for name in ('.branch-eligible-owner', '.branch-eligible-rows', '.wake-queue'):
        p = state / name
        out[name] = p.read_text() if p.exists() else None
    lock = state / '.wake-queue.lock'
    out['lock_exists'] = lock.exists() or lock.is_symlink()
    out['lock_pid'] = (lock / 'pid').read_text() if (lock / 'pid').exists() else None
    out['temporary_records'] = sorted(p.name for p in state.glob('.branch-eligible-*.tmp.*'))
    return out

def args(action):
    return {'release': ['release', 'existing'], 'deactivate': ['deactivate', str(os.getpid()), 'existing'],
            'activate': ['activate', str(os.getpid()), 'replacement'], 'publish': ['publish', 'existing', '1']}[action]

def run(command, case_env):
    return subprocess.run(command, env=case_env, text=True, capture_output=True, timeout=10)

for mode in ('injected-failure', 'real-acquire-failure', 'real-success', 'baseline-injected-failure'):
    for action in ('release', 'deactivate', 'activate', 'publish'):
        state = scratch / 'cases' / mode / action
        state.mkdir(parents=True, exist_ok=True)
        case_env = env | {'FM_HOME': str(state.parent), 'FM_STATE_OVERRIDE': str(state)}
        seed = run(['bash', str(root / 'bin/fm-wake-grant.sh'), 'activate', str(os.getpid()), 'existing'], case_env)
        assert seed.returncode == 0, seed.stderr
        (state / '.branch-eligible-rows').write_text('1\n')
        (state / '.wake-queue').write_text('1\t1\tsignal\ttask.status\tsignal: task\n')
        if mode in ('injected-failure', 'baseline-injected-failure', 'real-acquire-failure'):
            lock = state / '.wake-queue.lock'
            lock.mkdir()
            (lock / 'pid').write_text(str(os.getpid()) + '\n')
        if mode == 'real-success' and action == 'publish':
            (state / '.branch-eligible-rows').unlink()
        before = snapshot(state)
        script = root / 'bin/fm-wake-grant.sh'
        if mode == 'injected-failure':
            script = fixture / 'fm-wake-grant.sh'
        elif mode == 'baseline-injected-failure':
            script = baseline / 'fm-wake-grant.sh'
        elif mode == 'real-acquire-failure':
            # The production wait function returns failure for a missing parent.
            # Both grant records and a foreign live lock in STATE remain present.
            case_env['FM_WAKE_QUEUE_LOCK'] = str(state / 'nonexistent-parent' / 'queue.lock')
        command = ['bash', str(script)] + args(action)
        response = run(command, case_env)
        after = snapshot(state)
        if mode in ('injected-failure', 'real-acquire-failure'):
            expected = response.returncode != 0 and before == after
        elif mode == 'baseline-injected-failure':
            expected = response.returncode == 0
            if action in ('release', 'deactivate', 'activate'):
                expected = expected and before != after
        else:
            expected = response.returncode == 0 and not after['lock_exists'] and not after['temporary_records']
            if action == 'release':
                expected = expected and after['.branch-eligible-rows'] is None and after['.branch-eligible-owner'] == before['.branch-eligible-owner']
            elif action == 'deactivate':
                expected = expected and after['.branch-eligible-rows'] is None and after['.branch-eligible-owner'] is None
            elif action == 'activate':
                expected = expected and after['.branch-eligible-rows'] is None and after['.branch-eligible-owner'].endswith('\nreplacement\n')
            else:
                expected = expected and after['.branch-eligible-rows'] == '1\n' and after['.branch-eligible-owner'] == before['.branch-eligible-owner']
        record = {'mode': mode, 'action': action, 'revision': base if mode.startswith('baseline') else target,
                  'command': command, 'exit': response.returncode, 'stdout': response.stdout, 'stderr': response.stderr,
                  'before': before, 'after': after, 'expected_observed': expected}
        results.append(record)
        print(json.dumps(record), flush=True)
        assert expected, record
(evidence / 'grant-cli-state.json').write_text(json.dumps(results, indent=2) + '\n')
print('All CLI state expectations observed. Baseline reproduces unsafe success; target rejects both injected and real acquisition failures.')
