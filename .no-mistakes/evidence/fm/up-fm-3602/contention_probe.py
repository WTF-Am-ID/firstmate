import json, os, pathlib, subprocess, time
root = pathlib.Path.cwd()
state = root / '.test-3602' / 'contention-state'
state.mkdir()
env = {k: v for k, v in os.environ.items() if not k.startswith('FM_') and k not in ('STATE', 'TMUX')}
env.update(FM_HOME=str(state.parent), FM_STATE_OVERRIDE=str(state), TMPDIR=str(root / '.test-3602/tmp'))
script = str(root / 'bin/fm-wake-grant.sh')
subprocess.run(['bash', script, 'activate', str(os.getpid()), 'existing'], env=env, check=True)
(state / '.branch-eligible-rows').write_text('1\n')
owner = (state / '.branch-eligible-owner').read_bytes()
lock = state / '.wake-queue.lock'
lock.mkdir()
(lock / 'pid').write_text(str(os.getpid()) + '\n')
command = ['bash', script, 'release', 'existing']
child = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    time.sleep(0.6)
    blocked = child.poll() is None
    retained = ((state / '.branch-eligible-owner').read_bytes() == owner and
                (state / '.branch-eligible-rows').read_text() == '1\n' and
                (lock / 'pid').read_text() == str(os.getpid()) + '\n')
    assert blocked and retained, 'Release changed state or exited while foreign lock was held'
    print(json.dumps({'command': command, 'while_foreign_lock_held': {'process_waiting': blocked, 'owner_record_retained': True, 'rows': '1\n', 'lock_pid': (lock / 'pid').read_text()}}), flush=True)
    (lock / 'pid').unlink()
    lock.rmdir()
    stdout, stderr = child.communicate(timeout=10)
    assert child.returncode == 0 and not (state / '.branch-eligible-rows').exists()
    assert (state / '.branch-eligible-owner').read_bytes() == owner and not lock.exists() and not lock.is_symlink()
    print(json.dumps({'after_foreign_owner_releases_lock': {'exit': child.returncode, 'stdout': stdout, 'stderr': stderr, 'rows_removed': True, 'owner_record_retained': True, 'acquired_lock_released': True}}), flush=True)
finally:
    if child.poll() is None:
        child.terminate()
        child.communicate(timeout=10)
