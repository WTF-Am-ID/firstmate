import hashlib
import json
import os
from pathlib import Path
import re
import subprocess as sp
import time

ROOT = Path.cwd()
LAB = ROOT / '.test-lab-2878'
EVIDENCE = Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M659HMEPWX6DNY3A3DX3H168')
env = os.environ.copy()
for name in ('FM_ROOT_OVERRIDE', 'FM_STATE_OVERRIDE', 'FM_DATA_OVERRIDE', 'FM_CONFIG_OVERRIDE', 'FM_PROJECTS_OVERRIDE', 'FM_GATE_REFUSE_BYPASS'):
    env.pop(name, None)
env.update(FM_HOME=str(LAB), TMUX_TMPDIR=(LAB/'state/.fm-lab-tmux-dir').read_text().strip())
procs = []
results = []

def run(args, check=True):
    return sp.run(args, cwd=ROOT, env=env, text=True, capture_output=True, check=check)

def tm(*args):
    return run(['tmux', '-L', 'fm-lab', *args]).stdout.strip()

env['TMUX'] = tm('display-message', '-p', '-t', 's', '#{socket_path},#{pid},0')
env.update(FM_POLL='1', FM_SIGNAL_GRACE='1', FM_CHECK_INTERVAL='999999', FM_HEARTBEAT='999999', FM_SECONDMATE_LIVENESS_SECS='99999999', FM_WATCH_HANDLING_SUCCESSOR='1')
state = LAB/'state'

def key(endpoint):
    return 'v3.' + hashlib.sha256(endpoint.encode()).hexdigest()

def meta(task, endpoint):
    (state/f'{task}.meta').write_text(f'window={endpoint}\nbackend=tmux\nharness=codex\nkind=ship\n')

def start():
    out = open(LAB/'watch.out', 'w')
    err = open(LAB/'watch.err', 'w')
    p = sp.Popen(['bash', 'bin/fm-watch.sh'], cwd=ROOT, env=env, stdout=out, stderr=err)
    out.close(); err.close(); procs.append(p)
    return p

def stop(p):
    if p.poll() is None:
        p.terminate()
        p.wait(timeout=20)

def ack():
    r = run(['bash', 'bin/fm-wake-drain.sh'])
    m = re.search(r'--ack-through ([0-9]+) --recovery-generation ([A-Za-z0-9._-]+)', r.stderr)
    assert m, r.stderr[-1200:]
    run(['bash', 'bin/fm-wake-drain.sh', '--ack-through', m[1], '--recovery-generation', m[2]])

def wake(endpoint):
    p = start()
    p.wait(timeout=55)
    output = (LAB/'watch.out').read_text()
    assert p.returncode == 0, (p.returncode, (LAB/'watch.err').read_text())
    assert f'stale: {endpoint}\n' in output, output
    k = key(endpoint)
    markers = {prefix: (state/f'.{prefix}-{k}').read_text().strip() for prefix in ('hash', 'count', 'stale')}
    assert int(markers['count']) >= 2 and markers['hash'] == markers['stale'], markers
    results.append({'endpoint': endpoint, 'output': f'stale: {endpoint}', 'exit': p.returncode, 'stable_polls': int(markers['count']), 'key_bytes': len(k), 'longest_core_marker_bytes': len('.count-' + k), 'hash_matches_stale': True})
    ack()

def quiet(label):
    p = start()
    before = {f.name: int(f.read_text()) for f in state.glob('.count-v3.*')}
    deadline = time.time() + 35
    while time.time() < deadline:
        assert p.poll() is None, (LAB/'watch.out').read_text()
        after = {f.name: int(f.read_text()) for f in state.glob('.count-v3.*')}
        if any(after.get(name, 0) > n for name, n in before.items()):
            break
        time.sleep(.2)
    else:
        raise AssertionError('No completed poll for ' + label)
    stop(p)
    assert not (LAB/'watch.out').read_text().strip(), (LAB/'watch.out').read_text()
    results.append({'check': label, 'completed_poll': True, 'unexpected_wake': False})

try:
    for endpoint in ('s:fm-a/b', 's:fm-a_b'):
        tm('send-keys', '-t', endpoint, '-l', 'quiet pane ' + endpoint)
        tm('send-keys', '-t', endpoint, 'Enter')
    for task, endpoint in [('first', 's:fm-a/b'), ('second', 's:fm-a_b')]:
        meta(task, endpoint)
    legacy = 's_fm-a_b'
    legacy_hash = hashlib.md5(tm('capture-pane', '-p', '-t', 's:fm-a/b', '-S', '-40').encode()).hexdigest()
    for suffix in (legacy, 'v2.s%3Afm-a%2Fb'):
        for prefix in ('hash', 'stale'):
            (state/f'.{prefix}-{suffix}').write_text(legacy_hash)
        (state/f'.count-{suffix}').write_text('99')
    wake('s:fm-a/b')
    wake('s:fm-a_b')
    first_hash = (state/f'.hash-{key("s:fm-a/b")}').read_text()
    (state/'second.meta').rename(LAB/'second.meta')
    quiet('remove sibling, retain first endpoint suppressor')
    (LAB/'second.meta').rename(state/'second.meta')
    quiet('restore sibling, retain both endpoint suppressors')
    assert (state/f'.hash-{key("s:fm-a/b")}').read_text() == first_hash
    assert (state/f'.count-{legacy}').read_text() == '99'
    results.append({'check': 'legacy and v2 evidence ignored', 'legacy_count_unchanged': True, 'distinct_current_keys': key('s:fm-a/b') != key('s:fm-a_b')})
    for f in state.glob('*.meta'):
        f.unlink()
    punctuation = ['fm-a!b', 'fm-a%b', 'fm-船/员', 'fm-船_员']
    for index, name in enumerate(punctuation):
        endpoint = 's:' + name
        tm('new-window', '-d', '-t', 's', '-n', name, '-c', str(LAB), '/bin/cat')
        tm('send-keys', '-t', endpoint, '-l', 'quiet ' + name)
        tm('send-keys', '-t', endpoint, 'Enter')
        meta('punctuation', endpoint)
        wake(endpoint)
        (state/'punctuation.meta').unlink()
    session = 's' * 180
    task = 't' * 64
    endpoint = session + ':fm-' + task
    tm('new-session', '-d', '-s', session, '-n', 'fm-' + task, '-x', '120', '-y', '40', '-c', str(LAB), '/bin/cat')
    tm('send-keys', '-t', endpoint, '-l', 'quiet long endpoint')
    tm('send-keys', '-t', endpoint, 'Enter')
    meta(task, endpoint)
    assert len(endpoint.encode()) == 248
    wake(endpoint)
    (state/f'{task}.meta').unlink()
    meta('first', 's:fm-a/b')
    meta('second', 's:fm-a/b')
    (LAB/'config/turnend-churn-absorb').touch()
    (state/'first.turn-ended').touch()
    tm('send-keys', '-t', 's:fm-a/b', '-l', 'new pane content')
    tm('send-keys', '-t', 's:fm-a/b', 'Enter')
    p = start(); p.wait(timeout=40)
    output = (LAB/'watch.out').read_text()
    assert p.returncode == 0 and 'first.turn-ended' in output, output
    assert not (state/f'.churn-since-{key("s:fm-a/b")}').exists()
    results.append({'check': 'duplicate endpoint records cannot absorb changed-pane turn end', 'exit': p.returncode, 'signal_surfaced': True, 'churn_deadline_created': False})
    ack()
    (EVIDENCE/'live-watcher.json').write_text(json.dumps({'candidate':run(['git','rev-parse','HEAD']).stdout.strip(), 'product':'bash bin/fm-watch.sh, bash bin/fm-wake-drain.sh, installed tmux 3.8; real cat panes, no harness substitute', 'results':results}, indent=2, ensure_ascii=False)+'\n')
    print('Live watcher scenarios completed:', len(results))
finally:
    for p in procs:
        stop(p)
    run(['tmux','-L','fm-lab','kill-server'],check=False)
