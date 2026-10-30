import hashlib
import json
import os
from pathlib import Path
import subprocess as sp
import time

root = Path.cwd()
lab = root/'.test-daemon-lab-2878'
env = os.environ.copy()
for name in ('FM_ROOT_OVERRIDE','FM_STATE_OVERRIDE','FM_DATA_OVERRIDE','FM_CONFIG_OVERRIDE','FM_PROJECTS_OVERRIDE','FM_GATE_REFUSE_BYPASS'):
    env.pop(name, None)
env['FM_HOME'] = str(lab)
def run(args, check=True):
    return sp.run(args, env=env, cwd=root, text=True, capture_output=True, check=check)
if not (lab/'.fm-lab-home').exists():
    run(['bash','bin/fm-lab-home.sh','create',str(lab)])
env['TMUX_TMPDIR'] = run(['bash','bin/fm-lab-home.sh','tmux-dir',str(lab)]).stdout.strip()
def tm(*args):
    return run(['tmux','-L','fm-lab',*args]).stdout.strip()
daemon = None
log = None
results = []
def wait_for(predicate, description):
    deadline = time.time()+45
    while time.time()<deadline:
        if predicate():
            results.append(description)
            return
        assert daemon.poll() is None, (lab/'daemon.out').read_text()
        time.sleep(.2)
    raise AssertionError(description + '\n' + (lab/'state/.supervise-daemon.log').read_text()[-2200:])
try:
    if run(['tmux','-L','fm-lab','has-session','-t','s'], check=False).returncode:
        tm('new-session','-d','-s','s','-n','supervisor','-x','120','-y','40','-c',str(lab),'/bin/cat')
    tm('new-window','-d','-t','s:','-n','fm-worker','-c',str(lab),'/bin/cat')
    env['TMUX'] = tm('display-message','-p','-t','s','#{socket_path},#{pid},0')
    env.update(FM_SUPERVISOR_BACKEND='tmux',FM_SUPERVISOR_TARGET='s:supervisor',FM_DAEMON_PRIMARY_HARNESS='codex',FM_HOUSEKEEPING_TICK='1',FM_HEARTBEAT_SCAN_SECS='999999',FM_POLL='1',FM_SIGNAL_GRACE='1',FM_CHECK_INTERVAL='999999',FM_HEARTBEAT='999999',FM_ESCALATE_BATCH_SECS='999999')
    state = lab/'state'
    endpoint = 's:fm-worker'
    key = 'v3.'+hashlib.sha256(endpoint.encode()).hexdigest()
    (state/'worker.meta').write_text(f'window={endpoint}\nbackend=tmux\nharness=codex\nkind=ship\n')
    (state/'worker.status').write_text('paused: awaiting external dependency\n')
    (state/'.afk').write_text('away\n')
    (state/'.subsuper-last-scan').touch()
    (state/f'.paused-{key}').touch()
    log = open(lab/'daemon.out','w')
    daemon = sp.Popen(['bash','bin/fm-supervise-daemon.sh'],cwd=root,env=env,stdout=log,stderr=log)
    wait_for(lambda:(state/'.subsuper-paused-worker').exists(), 'Watcher v3 pause marker is adopted into daemon task-keyed tracking')
    (state/'worker.status').write_text('working: external dependency resolved\n')
    wait_for(lambda:not (state/f'.paused-{key}').exists() and not (state/'.subsuper-paused-worker').exists(), 'Resumed task clears watcher v3 pause marker and daemon pause marker')
    for prefix in ('paused','stale','wedge-escalations'):
        (state/f'.{prefix}-{key}').write_text('1')
    (state/'.subsuper-paused-worker').write_text(str(int(time.time())))
    (state/'.subsuper-stale-worker').write_text(str(int(time.time())))
    (state/'worker.status').write_text('done: isolated lab task completed\n')
    wait_for(lambda:all(not (state/f'.{prefix}-{key}').exists() for prefix in ('paused','stale','wedge-escalations')) and not (state/'.subsuper-paused-worker').exists() and not (state/'.subsuper-stale-worker').exists(), 'Terminal status clears watcher v3 pause/stale/wedge markers and daemon task markers')
finally:
    if daemon is not None and daemon.poll() is None:
        daemon.terminate()
        daemon.wait(timeout=30)
    if log:
        log.close()
    run(['tmux','-L','fm-lab','kill-server'],check=False)
    run(['bash','bin/fm-lab-home.sh','teardown',str(lab)])
Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M659HMEPWX6DNY3A3DX3H168/live-daemon.json').write_text(json.dumps({'candidate':run(['git','rev-parse','HEAD']).stdout.strip(),'product':'bash bin/fm-supervise-daemon.sh and its real watcher, private tmux panes, no harness substitute','results':results,'daemon_exit':daemon.returncode,'private_tmux_stopped':True},indent=2)+'\n')
print('Live daemon checks completed:',len(results))
