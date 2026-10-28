import json, os, pathlib, re, shutil, signal, subprocess, tempfile, time, traceback
ROOT = pathlib.Path.cwd()
EVID = pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M6059VFKV9G8RK8QBEAVXX33')
SCRATCH = pathlib.Path(tempfile.mkdtemp(prefix='.local-test-7741-', dir=ROOT))
LOG = (EVID/'live-reminders.log').open('w', buffering=1)
RESULTS=[]
PROCS=[]

def log(s):
    LOG.write(str(s)+'\n')

def env(home, threshold=2, cap=8):
    e={k:v for k,v in os.environ.items() if not k.startswith('FM_') and k not in ('TMUX','TMUX_PANE')}
    e.update(FM_HOME=str(home), FM_POLL='1', FM_SIGNAL_GRACE='0', FM_HEARTBEAT='999999', FM_HOME_SUMMARY_INTERVAL='999999', FM_OPEN_DECISION_OVERDUE_SECS=str(threshold), FM_OPEN_DECISION_BACKOFF_MAX_SECS=str(cap), FM_PROCEVENT_CLAIM_ROOT=str(home/'claims'))
    return e

def run(home, args, **kw):
    p=subprocess.run(args,cwd=ROOT,env=env(home),capture_output=True,text=True,timeout=25,**kw)
    log('$ '+' '.join(map(str,args))+'\n'+p.stdout+p.stderr+'exit='+str(p.returncode))
    assert p.returncode==0, p.stderr
    return p

def home(name, enabled=True):
    h=SCRATCH/name
    run(h,['/bin/bash','bin/fm-lab-home.sh','create',str(h)])
    shutil.copyfile(ROOT/'.tasks.toml',h/'.tasks.toml')
    (h/'data/backlog.md').write_text('## In flight\n\n## Queued\n\n## Done\n')
    (h/'state/home-summary.json').touch()
    if enabled: (h/'config/open-decision-reminders').touch()
    return h

def status(h, task, text, append=False):
    with (h/f'state/{task}.status').open('a' if append else 'w') as f: f.write(text)
    # This product presentation helper marks fixture records as already delivered.
    # The test concerns reminders for a missed hand-off, not the original status signal.
    run(h,['/bin/bash','-c','. bin/fm-wake-lib.sh; fm_wake_status_mark_current "$FM_HOME/state" "$FM_HOME/state/$1.status"','mark',task])
    log('STATUS '+task+' '+repr(text))

def start(h, threshold=2, cap=8):
    log('$ FM_HOME='+str(h)+' FM_OPEN_DECISION_OVERDUE_SECS='+str(threshold)+' FM_OPEN_DECISION_BACKOFF_MAX_SECS='+str(cap)+' /bin/bash bin/fm-watch.sh')
    p=subprocess.Popen(['/bin/bash','bin/fm-watch.sh'],cwd=ROOT,env=env(h,threshold,cap),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
    PROCS.append(p)
    return p

def quiet(h,p,seconds):
    time.sleep(seconds)
    assert p.poll() is None, 'watcher exited during quiet interval: '+repr(p.communicate())
    q=h/'state/.wake-queue'
    assert not q.exists() or not q.read_text().strip(), 'unexpected durable wake: '+q.read_text()
    log(f'Watcher remained alive for {seconds}s; no durable wake queued')

def finish(h,p,timeout=15, task=None, key=None):
    out,err=p.communicate(timeout=timeout)
    log('WATCHER stdout='+out+'stderr='+err+'exit='+str(p.returncode))
    assert p.returncode==0
    assert 'check: open decision overdue:' in out, repr(out)
    if task: assert f'{task} key={key} age=' in out
    rows=(h/'state/.wake-queue').read_text()
    log('DURABLE QUEUE\n'+rows)
    assert len(rows.strip().splitlines())==1
    assert '\tcheck\topen-decision:' in rows
    log('PERSISTED BACKOFF\n'+(h/'state/.open-decision-reminders').read_text())
    return rows.strip().split('\t')

def acknowledge(h):
    p=run(h,['/bin/bash','bin/fm-wake-drain.sh'])
    m=re.search(r'--ack-through (\d+) --recovery-generation (\S+)',p.stderr)
    assert m, p.stderr
    run(h,['/bin/bash','bin/fm-wake-drain.sh','--ack-through',m[1],'--recovery-generation',m[2]])

def stop(p):
    if p.poll() is None:
        os.killpg(p.pid,signal.SIGTERM)
        out,err=p.communicate(timeout=12)
        log('STOPPED private watcher stdout='+out+' stderr='+err+' exit='+str(p.returncode))

def scenario(name,fn):
    log('\nSCENARIO '+name)
    try:
        fn()
        RESULTS.append(dict(name=name,result='pass',live=True))
        log('RESULT pass')
    except Exception as exc:
        RESULTS.append(dict(name=name,result='fail',live=True,error=str(exc)))
        log(traceback.format_exc())
    finally:
        for p in PROCS: stop(p)

def disabled():
    h=home('default-off',False)
    status(h,'worker',f'needs-decision [at={int(time.time())-100}] [key=api]: choose\n')
    p=start(h)
    quiet(h,p,3)
    assert not (h/'state/.worker.open-decisions-cursor.timed').exists()
    (h/'config/open-decision-reminders').touch()
    finish(h,p,task='worker',key='api')

def timing():
    h=home('threshold-backoff')
    opened=int(time.time())
    status(h,'z-old',f'needs-decision [at={opened}] [key=older]: choose\nworking: ongoing work\n')
    status(h,'a-new',f'blocked [at={opened+1}] [key=newer]: help\n')
    p=start(h,4,12)
    quiet(h,p,1)
    row=finish(h,p,task='z-old',key='older')
    assert int(row[0])-opened>=4
    acknowledge(h)
    finish(h,start(h,4,12),task='a-new',key='newer')
    acknowledge(h)
    # Remove only the already-presented second record via its actual resolved event.
    status(h,'a-new',f'resolved [at={int(time.time())}] [key=newer]: answered\n',True)
    for expected_delay in (8,12,12):
        previous=(h/'state/.open-decision-reminders').read_text().splitlines()
        last=int(next(r for r in previous if r.startswith('z-old\t')).split('\t')[3])
        previous_delay=int(next(r for r in previous if r.startswith('z-old\t')).split('\t')[4])
        row=finish(h,start(h,4,12),timeout=20,task='z-old',key='older')
        assert int(row[0])-last>=previous_delay
        new=(h/'state/.open-decision-reminders').read_text().strip().split('\t')
        assert int(new[4])==expected_delay,(new,expected_delay)
        log(f'Wall-clock repeat interval >= {previous_delay}s; next delay={expected_delay}s')
        acknowledge(h)

def resolution():
    h=home('resolve-reopen')
    status(h,'worker',f'blocked [at={int(time.time())-100}] [key=api]: help\n')
    finish(h,start(h),task='worker',key='api')
    acknowledge(h)
    status(h,'worker',f'resolved [at={int(time.time())}] [key=api]: answered\n',True)
    p=start(h)
    quiet(h,p,3)
    assert not (h/'state/.open-decision-reminders').read_text().strip()
    status(h,'worker',f'needs-decision [at={int(time.time())}] [key=api]: new episode\n',True)
    finish(h,p,task='worker',key='api')
    assert (h/'state/.open-decision-reminders').read_text().strip().split('\t')[4]=='2'

def exclusions():
    h=home('paused-transferred-unknown')
    old=int(time.time())-100
    status(h,'paused',f'needs-decision [at={old}] [key=api]: choose\npaused [at={old+1}]: external wait\n')
    status(h,'transferred',f'blocked [at={old}] [key=api]: help\ncaptain-held [at={old+1}] [key=api]: handed to captain\n')
    status(h,'unknown','needs-decision [key=missing]: unstamped\nblocked [at=bad] [key=invalid]: bad time\nblocked [at=1]: keyless\n')
    p=start(h)
    quiet(h,p,3)
    status(h,'paused',f'working [at={int(time.time())}]: resumed\n',True)
    finish(h,p,task='paused',key='api')

def backlog():
    h=home('captain-backlog')
    run(h,['/bin/bash','bin/fm-captain-hold.sh','hold','worker','--title','Disposable decision','--reason','Owner must decide'])
    run(h,['/bin/bash','bin/fm-captain-hold.sh','open','worker','--identity'])
    log('HELD BACKLOG\n'+(h/'data/backlog.md').read_text())
    status(h,'worker',f'needs-decision [at={int(time.time())-100}] [key=api]: choose\nworking: unrelated progress\n')
    p=start(h)
    quiet(h,p,3)
    decision=h/'decision.txt'; decision.write_text('Use the documented default.\n')
    run(h,['/bin/bash','bin/fm-captain-hold.sh','answer','worker','--decision-file',str(decision),'--release'])
    finish(h,p,task='worker',key='api')

def invalid():
    h=home('invalid-settings')
    status(h,'worker',f'blocked [at={int(time.time())-100}] [key=api]: help\n')
    for threshold,cap in [(0,8),(2,1),('02',8),(2,'bad')]:
        p=start(h,threshold,cap)
        out,err=p.communicate(timeout=10)
        log(f'INVALID {threshold}/{cap} stdout={out} stderr={err} exit={p.returncode}')
        assert p.returncode!=0 and 'reminder' in err
        assert not (h/'state/.wake-queue').exists()

try:
    for name,fn in [('Default-off silence and live opt-in',disabled),('Threshold, oldest selection and bounded backoff across watcher restarts',timing),('Resolution stops reminders and reopening starts fresh',resolution),('Paused waits, captain transfers and invalid timestamps remain silent',exclusions),('Real captain-held backlog suppresses reminders until release',backlog),('Invalid reminder settings fail closed',invalid)]: scenario(name,fn)
finally:
    for p in PROCS: stop(p)
    shutil.rmtree(SCRATCH)
    log('Removed disposable lab homes: '+str(SCRATCH))
    (EVID/'live-results.json').write_text(json.dumps(RESULTS,indent=2)+'\n')
    LOG.close()
print(json.dumps(RESULTS,indent=2))
raise SystemExit(any(r['result']!='pass' for r in RESULTS))
