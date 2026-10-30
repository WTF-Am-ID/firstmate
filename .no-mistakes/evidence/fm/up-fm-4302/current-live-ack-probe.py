import hashlib, os, pathlib, re, shutil, subprocess, tempfile, time
ROOT=pathlib.Path.cwd()
SCRATCH=pathlib.Path(tempfile.mkdtemp(prefix='.ack-live-',dir=ROOT))
LIB=ROOT/'bin/fm-wake-lib.sh'
DRAIN=ROOT/'bin/fm-wake-drain.sh'
GRANT=ROOT/'bin/fm-wake-grant.sh'
children=[]
NAMES=['.wake-queue','.watcher-down','.main-eligible-rows','.branch-eligible-rows','.branch-eligible-owner']
def run(argv,env,expected=0):
    result=subprocess.run([str(a) for a in argv],env=env,text=True,capture_output=True,timeout=30)
    print('$ '+' '.join(str(a).replace(str(ROOT),'.') for a in argv),flush=True)
    print('exit='+str(result.returncode),flush=True)
    if result.stdout: print(result.stdout.rstrip(),flush=True)
    if result.stderr: print(result.stderr.rstrip(),flush=True)
    if expected is not None: assert result.returncode==expected,result
    return result
def case(name):
    home=SCRATCH/name
    for sub in ['state','data','config','projects']: (home/sub).mkdir(parents=True)
    env={k:v for k,v in os.environ.items() if not k.startswith('FM_')}
    env.update(FM_HOME=str(home),FM_ROOT_OVERRIDE=str(home),FM_STATE_OVERRIDE=str(home/'state'),FM_CONFIG_OVERRIDE=str(home/'config'),FM_DATA_OVERRIDE=str(home/'data'),FM_PROJECTS_OVERRIDE=str(home/'projects'),FM_HARNESS='codex')
    return home/'state',env
def library(env,code,*args): return run(['bash','-c','. "$1"; shift; '+code,'_',LIB,*args],env)
def append(env,kind,key,text): return library(env,'fm_wake_append "$1" "$2" "$3"',kind,key,text)
def snapshot(state): return {n:(state/n).read_bytes() if (state/n).exists() else None for n in NAMES}
def record(state,label):
    print(label,flush=True)
    for name,data in snapshot(state).items(): print(name+' = '+repr(data),flush=True)
def gen(state): return (state/'.watcher-down').read_text().strip().split(':')[-1]
def ack(env,cutoff,generation,expected=0,drain=DRAIN): return run(['bash',drain,'--ack-through',str(cutoff),'--recovery-generation',generation],env,expected)
def grant(env,*args): return run(['bash',GRANT,*args],env)
def wait_receipt(pending):
    deadline=time.monotonic()+18
    while time.monotonic()<deadline:
        rows=[line.split(None,2) for line in subprocess.check_output(['ps','-axo','pid=,ppid=,args='],text=True).splitlines()]
        receipts=[r[0] for r in rows if len(r)==3 and r[1]==str(pending.pid) and 'fm-inactive-reconcile.sh acknowledge aa' in r[2]]
        if receipts and any(len(r)==3 and r[1] in receipts and r[2].endswith('sleep 0.1') for r in rows):
            print('Observed real receipt writer blocked on held receipt lock.',flush=True)
            return
        assert pending.poll() is None,'ack exited before lock contention'
        time.sleep(.03)
    raise AssertionError('no receipt lock contention')
def handoff(drain,label,mode,previous,change,baseline=False):
    print('\nSCENARIO '+label,flush=True)
    state,env=case(label)
    (state/'terminal-outcomes').mkdir()
    (state/'terminal-outcomes/aa.pending').write_text('phase=presentation\n')
    append(env,'check','inactive-outcome:aa','inactive receipt')
    append(env,'signal','candidate','unclaimed candidate')
    append(env,'signal','branch','existing branch row')
    append(env,'signal','main','existing main row')
    generation=gen(state)
    grant(env,'activate',str(os.getpid()),'probe')
    if mode=='replay':
        grant(env,'publish','probe','1','2')
        ack(env,2,generation,drain=drain)
        grant(env,'release','probe')
    grant(env,'publish','probe','1','3') if mode=='branch' else grant(env,'publish','probe','3')
    if previous=='existing': (state/'.main-eligible-rows').write_text('4\n')
    if mode in ['presented','branch']: run(['bash',drain],env)
    before=snapshot(state)
    record(state,'Before acknowledgement')
    locker=subprocess.Popen(['bash','-c','. "$1"; fm_lock_acquire_wait "$STATE/.inactive-outcome-reconcile.lock" || exit; printf "READY\\n"; read -r release; fm_lock_release "$STATE/.inactive-outcome-reconcile.lock"','_',str(LIB)],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    children.append(locker)
    assert locker.stdout.readline().strip()=='READY'
    cutoff=8 if change=='arrival' else 3 if mode=='branch' else 2
    ackenv=dict(env,FM_SUPERVISION_ACTOR='branch' if mode=='branch' else 'main')
    pending=subprocess.Popen(['bash',str(drain),'--ack-through',str(cutoff),'--recovery-generation',generation],env=ackenv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    children.append(pending)
    wait_receipt(pending)
    assert not (state/'.wake-queue.lock').exists()
    if change=='moved': library(env,'fm_lock_acquire_wait "$FM_WAKE_QUEUE_LOCK"; fm_recovery_marker_publish "$STATE/.watcher-down" handling; fm_lock_release "$FM_WAKE_QUEUE_LOCK"')
    if change=='arrival':
        (state/'terminal-outcomes/bb.pending').write_text('phase=presentation\n')
        append(env,'check','inactive-outcome:bb','arriving during handoff')
    if change=='grant':
        grant(env,'release','probe')
        grant(env,'publish','probe','2','3')
    newer=(state/'.watcher-down').read_bytes()
    locker.communicate('release\n',timeout=10)
    assert locker.returncode==0
    out,err=pending.communicate(timeout=25)
    print('$ bash '+str(drain).replace(str(ROOT),'.')+' --ack-through '+str(cutoff)+' --recovery-generation '+generation,flush=True)
    print('exit='+str(pending.returncode)+'\n'+out+err,flush=True)
    after=snapshot(state)
    record(state,'After acknowledgement')
    if change=='moved':
        assert pending.returncode!=0 and after['.wake-queue']==before['.wake-queue'] and after['.watcher-down']==newer
        assert after['.branch-eligible-rows']==before['.branch-eligible-rows'] and after['.branch-eligible-owner']==before['.branch-eligible-owner']
        unchanged=after['.main-eligible-rows']==before['.main-eligible-rows']
        later=None
        if mode in ['direct','replay']:
            grant(env,'release','probe')
            later=grant(env,'publish','probe','2') if not baseline else run(['bash',GRANT,'publish','probe','2'],env,None)
        if baseline:
            assert not unchanged and later.returncode!=0
            print('BASELINE RED: refused ack published main claims and blocked later branch grant.',flush=True)
        else:
            assert unchanged
            print('PASS: rejected ack preserves exact prior claims, queue and new marker. Later branch grant succeeds where applicable.',flush=True)
    else:
        assert pending.returncode==0
        removed={1,3} if mode=='branch' else {1} if change=='grant' else {1,2,4} if change=='arrival' else {1,2}
        expected=b''.join(row for row in before['.wake-queue'].splitlines(keepends=True) if int(row.split(b'\t')[1]) not in removed)
        if change=='arrival': expected+=(state/'.wake-queue').read_bytes().splitlines(keepends=True)[-1]
        assert after['.wake-queue']==expected
        assert (state/'terminal-outcomes/aa.presented').exists()
        if mode=='branch': assert after['.main-eligible-rows']==before['.main-eligible-rows']
        if change=='arrival':
            assert (state/'terminal-outcomes/bb.pending').exists()
            grant(env,'release','probe')
            grant(env,'publish','probe','5')
        if change=='grant': assert after['.branch-eligible-rows']==b'2\n3\n'
        print('PASS: current generation consumes only eligible snapshot rows and persists handled receipt.',flush=True)
try:
    print('Revision: '+subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),flush=True)
    print('Worktree: '+str(ROOT),flush=True)
    print('Reviewer: OpenAI Codex, GPT-6; exact backend variant not exposed to this agent.',flush=True)
    for actor in ['main','branch']:
        print('\nSCENARIO '+actor+' stale partial acknowledgement',flush=True)
        state,env=case('partial-'+actor)
        for key in ['other','earlier','later']: append(env,'signal',key,'signal: '+key)
        grant(env,'activate',str(os.getpid()),'probe')
        grant(env,'publish','probe',*(['1'] if actor=='main' else ['2','3']))
        if actor=='branch': run(['bash',DRAIN],env)
        env['FM_SUPERVISION_ACTOR']=actor
        run(['bash',DRAIN],env)
        generation=gen(state)
        before=snapshot(state)
        assert ack(env,2,'stale',None).returncode!=0
        assert snapshot(state)==before
        ack(env,2,generation)
        after=snapshot(state)
        assert after['.wake-queue']==b''.join(row for row in before['.wake-queue'].splitlines(keepends=True) if row.split(b'\t')[1]!=b'2')
        assert after['.watcher-down']==before['.watcher-down']
        other='.branch-eligible-rows' if actor=='main' else '.main-eligible-rows'
        assert after[other]==before[other]
        record(state,'After current partial ack, other actor and later row remain')
        print('PASS stale refusal and matching actor-scoped partial consumption',flush=True)
    state,env=case('empty')
    (state/'.wake-queue').write_bytes(b'')
    library(env,'fm_recovery_marker_publish "$STATE/.watcher-down" handling')
    generation=gen(state)
    before=snapshot(state)
    assert ack(env,0,'stale',None).returncode!=0
    assert snapshot(state)==before
    ack(env,0,generation)
    ack(env,0,generation)
    assert (state/'.watcher-down').read_text().strip()=='acked:handling:'+generation
    record(state,'Empty current ack retires matching marker and can be replayed')
    for mode in ['direct','replay']:
        for previous in ['absent','existing']:
            handoff(DRAIN,'candidate-'+mode+'-'+previous,mode,previous,'moved')
    for mode,change in [('presented','moved'),('presented','stable'),('direct','stable'),('direct','arrival'),('direct','grant'),('branch','moved'),('branch','stable')]:
        handoff(DRAIN,'candidate-'+mode+'-'+change,mode,'existing',change)
    oldbin=SCRATCH/'baseline-bin'
    oldbin.mkdir()
    for path in (ROOT/'bin').iterdir():
        if path.name!='fm-wake-drain.sh': (oldbin/path.name).symlink_to(path)
    olddrain=oldbin/'fm-wake-drain.sh'
    olddrain.write_bytes(subprocess.check_output(['git','show','355ba33b8930f4c29a8d098ca24d7879cfcb2192:bin/fm-wake-drain.sh']))
    print('\nBaseline 355ba33b drain isolated with unchanged production libraries.',flush=True)
    for mode in ['direct','replay']:
        for previous in ['absent','existing']:
            handoff(olddrain,'baseline-'+mode+'-'+previous,mode,previous,'moved',True)
    print('\nALL LIVE PROBES PASSED; all four pre-fix regression cases reproduced.',flush=True)
finally:
    for child in children:
        if child.poll() is None:
            child.terminate()
            try: child.communicate(timeout=5)
            except subprocess.TimeoutExpired: child.kill(); child.communicate()
    shutil.rmtree(SCRATCH)
    print('Removed disposable workspace '+str(SCRATCH),flush=True)
