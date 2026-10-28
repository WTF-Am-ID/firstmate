import hashlib, os, pathlib, re, shutil, subprocess, tempfile, time
ROOT = pathlib.Path.cwd()
SCRATCH = pathlib.Path(tempfile.mkdtemp(prefix='.ack-live-', dir=ROOT))
DRAIN = ROOT / 'bin/fm-wake-drain.sh'
LIB = ROOT / 'bin/fm-wake-lib.sh'
GRANT = ROOT / 'bin/fm-wake-grant.sh'
children = []

def run(argv, env, required=0):
    result = subprocess.run([str(x) for x in argv], env=env, text=True, capture_output=True, timeout=30)
    print('$ ' + ' '.join(str(x).replace(str(ROOT), '.') for x in argv), flush=True)
    print('exit=' + str(result.returncode), flush=True)
    if result.stdout: print(result.stdout.rstrip(), flush=True)
    if result.stderr: print(result.stderr.rstrip(), flush=True)
    if required is not None: assert result.returncode == required, result
    return result

def case(name):
    home = SCRATCH / name
    for child in ['state', 'config', 'data', 'projects']: (home / child).mkdir(parents=True, exist_ok=True)
    env = {k:v for k,v in os.environ.items() if not k.startswith('FM_') or k in ['FM_GATE_REFUSE_BYPASS']}
    env.update(FM_HOME=str(home), FM_ROOT_OVERRIDE=str(home), FM_STATE_OVERRIDE=str(home/'state'), FM_CONFIG_OVERRIDE=str(home/'config'), FM_DATA_OVERRIDE=str(home/'data'), FM_PROJECTS_OVERRIDE=str(home/'projects'), FM_HARNESS='codex')
    return home/'state', env

def library(env, code, *args):
    return run(['bash', '-c', '. "$1"; shift; '+code, '_', LIB, *args], env)

def append(env, kind, key, text): library(env, 'fm_wake_append "$1" "$2" "$3"', kind, key, text)
def snapshot(state): return {name:(state/name).read_bytes() if (state/name).exists() else None for name in ['.wake-queue','.watcher-down','.main-eligible-rows','.branch-eligible-rows','.branch-eligible-owner']}
def digest(data): return hashlib.sha256(data).hexdigest() if data is not None else 'absent'
def record(state, label):
    print(label, flush=True)
    for name, data in snapshot(state).items():
        print(name + ' sha256=' + digest(data) + ' bytes=' + repr(data), flush=True)
def generation(result):
    m = re.search(r'WAKE_ACK_REQUIRED:.*--recovery-generation ([A-Za-z0-9._-]+)', result.stderr)
    assert m, result.stderr
    return m.group(1)
def ack(env, cutoff, gen, required=0, command=DRAIN):
    return run([command, '--ack-through', str(cutoff), '--recovery-generation', gen], env, required)

try:
    print('Revision: ' + subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip(), flush=True)
    print('Worktree: ' + str(ROOT), flush=True)
    for actor in ['main','branch']:
        print('\nSCENARIO actor=' + actor + ': stale refusal and matching partial consumption', flush=True)
        state, env = case(actor)
        append(env,'signal','other','signal: other actor')
        append(env,'signal','earlier','signal: earlier owned row')
        append(env,'signal','later','signal: later owned row')
        run([GRANT,'activate',str(os.getpid()),'probe'],env)
        run([GRANT,'publish','probe',*(['1'] if actor=='main' else ['2','3'])],env)
        if actor=='branch': run([DRAIN], env)
        env['FM_SUPERVISION_ACTOR'] = actor
        gen = generation(run([DRAIN],env))
        before = snapshot(state)
        record(state, 'Before stale acknowledgement')
        rejected = ack(env,2,'stale',required=None)
        assert rejected.returncode != 0
        assert snapshot(state) == before
        print('Stale rejection preserved all queue, marker and ownership bytes.', flush=True)
        ack(env,2,gen)
        after = snapshot(state)
        assert after['.wake-queue'] == b''.join(row for row in before['.wake-queue'].splitlines(keepends=True) if row.split(b'\t')[1] != b'2')
        assert after['.watcher-down'] == before['.watcher-down']
        other = '.branch-eligible-rows' if actor=='main' else '.main-eligible-rows'
        assert after[other] == before[other]
        record(state, 'After matching partial acknowledgement')
        ack(env,3,gen)
        assert b'\t1\t' in (state/'.wake-queue').read_bytes()
        assert b'\t3\t' not in (state/'.wake-queue').read_bytes()
        run([GRANT,'deactivate',str(os.getpid()),'probe'],env)
        print('PASS ' + actor + ' stale refusal, eligible cutoff and other-actor preservation', flush=True)

    print('\nSCENARIO empty queue generation guard, retirement and repeated acknowledgement', flush=True)
    state, env = case('empty')
    (state/'.wake-queue').write_bytes(b'')
    library(env, 'fm_recovery_marker_publish "$STATE/.watcher-down" handling')
    gen = (state/'.watcher-down').read_text().strip().split(':')[-1]
    before = snapshot(state)
    assert ack(env,0,'stale',required=None).returncode != 0
    assert snapshot(state) == before
    ack(env,0,gen)
    assert (state/'.watcher-down').read_text().strip() == 'acked:handling:' + gen
    ack(env,0,gen)
    record(state, 'Empty matching acknowledgement retired only the matching episode')
    print('PASS empty queue stale refusal, matching retirement and idempotent repeat', flush=True)

    print('\nSCENARIO generation advances during the real receipt-lock handoff', flush=True)
    state, env = case('race')
    (state/'terminal-outcomes').mkdir()
    append(env,'check','inactive-outcome:abc123','check: handled inactive outcome')
    append(env,'signal','later','signal: later row')
    gen = generation(run([DRAIN],env))
    before = snapshot(state)
    locker = subprocess.Popen(['bash','-c','. "$1"; fm_lock_acquire_wait "$STATE/.inactive-outcome-reconcile.lock" || exit; printf "READY\n"; read -r release; fm_lock_release "$STATE/.inactive-outcome-reconcile.lock"','_',str(LIB)],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    children.append(locker)
    assert locker.stdout.readline().strip() == 'READY'
    pending = subprocess.Popen([str(DRAIN),'--ack-through','1','--recovery-generation',gen],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    children.append(pending)
    deadline = time.monotonic()+15
    while time.monotonic() < deadline:
        rows = subprocess.check_output(['ps','-axo','ppid=,command='],text=True)
        if any(line.strip().startswith(str(pending.pid)+' ') and 'fm-inactive-reconcile.sh acknowledge abc123' in line for line in rows.splitlines()): break
        assert pending.poll() is None, 'ack exited before receipt handoff'
        time.sleep(.02)
    else: raise AssertionError('ack did not enter real receipt process')
    assert not (state/'.wake-queue.lock').exists(), 'ack did not release queue lock'
    print('Observed real acknowledgement waiting in fm-inactive-reconcile.sh with queue lock released.',flush=True)
    library(env, 'fm_recovery_marker_publish "$STATE/.watcher-down" handling')
    newer = (state/'.watcher-down').read_bytes()
    assert newer != before['.watcher-down']
    locker.communicate('release\n',timeout=10)
    assert locker.returncode == 0
    stdout, stderr = pending.communicate(timeout=15)
    print('$ bin/fm-wake-drain.sh --ack-through 1 --recovery-generation ' + gen,flush=True)
    print('exit=' + str(pending.returncode) + '\n' + stdout + stderr,flush=True)
    assert pending.returncode != 0
    assert (state/'.wake-queue').read_bytes() == before['.wake-queue']
    assert (state/'.main-eligible-rows').read_bytes() == before['.main-eligible-rows']
    assert (state/'.watcher-down').read_bytes() == newer
    record(state,'After racing acknowledgement')
    ack(env,1,newer.decode().strip().split(':')[-1])
    assert len((state/'.wake-queue').read_bytes().splitlines()) == 1
    print('PASS real concurrent generation publication rejects stale consumption and permits current recovery',flush=True)

    print('\nBASELINE RED CASE: same stale partial acknowledgement against the base drain',flush=True)
    oldbin = SCRATCH/'baseline'/'bin'
    oldbin.mkdir(parents=True)
    for path in (ROOT/'bin').iterdir():
        if path.name != 'fm-wake-drain.sh': (oldbin/path.name).symlink_to(path)
    olddrain=oldbin/'fm-wake-drain.sh'
    olddrain.write_bytes(subprocess.check_output(['git','show','417cec2feb4e2976c0acdb2527b87b3ccc71535f:bin/fm-wake-drain.sh']))
    olddrain.chmod(0o755)
    state, env = case('baseline')
    append(env,'signal','earlier','signal: earlier')
    append(env,'signal','later','signal: later')
    generation(run([DRAIN],env))
    before=snapshot(state)
    result=ack(env,1,'stale',required=None,command=olddrain)
    after=snapshot(state)
    assert result.returncode == 0 and before['.wake-queue'] != after['.wake-queue']
    record(state,'Baseline wrongly accepted stale generation and removed earlier row')
    print('CONFIRMED regression red at base, green at candidate.',flush=True)
finally:
    for child in children:
        if child.poll() is None:
            child.terminate()
            try: child.communicate(timeout=5)
            except subprocess.TimeoutExpired: child.kill(); child.communicate()
    shutil.rmtree(SCRATCH)
    print('Removed disposable workspace: ' + str(SCRATCH),flush=True)
