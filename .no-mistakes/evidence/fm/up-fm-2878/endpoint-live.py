import os, subprocess, pathlib, time, hashlib, json, shutil, re, signal
ROOT=pathlib.Path.cwd()
E=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M65BBAJGNPDVJZG917JA4X8V')
report={'revision':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'scenarios':[],'optional_authenticated_codex':'unrun, outside the accepted endpoint-fixture contract'}
base=os.environ.copy()
for k in list(base):
    if k.startswith('FM_') or k in ('TMUX','TMUX_PANE','HERDR_ENV','HERDR_SESSION','REX_SESSION','REX_BLOCK','TASKS_AXI_FILE','TASKS_AXI_BACKEND'):
        base.pop(k,None)
procs=[]; labs=[]; sockets=[]
def run(args,env=None,check=True):
    r=subprocess.run([str(x) for x in args],cwd=ROOT,env=env or base,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if check and r.returncode: raise RuntimeError(f'{args}: exit {r.returncode}: {r.stderr}')
    return r

def lab(name):
    p=E/('lab-'+name)
    run(['bash','bin/fm-lab-home.sh','create',p]); labs.append(p)
    env=base.copy(); env.update(FM_HOME=str(p),FM_BACKEND='tmux',FM_POLL='1',FM_SIGNAL_GRACE='1',FM_CHECK_INTERVAL='999999',FM_HEARTBEAT='999999',FM_SECONDMATE_LIVENESS_SECS='99999999',FM_WATCH_HANDLING_SUCCESSOR='1')
    return p,env

p,env=lab('endpoints')
sockdir=run(['bash','bin/fm-lab-home.sh','tmux-dir',p]).stdout.strip(); sockets.append((p,sockdir))
env['TMUX_TMPDIR']=sockdir

def tm(*args):return run(['tmux','-L','fm-lab',*args],env)
def pane(session,name,new_session=False):
    windowname='a' if name=='a.0' else name
    args=['new-session' if new_session else 'new-window','-d','-s' if new_session else '-t',session,'-n',windowname]
    if new_session: args+=['-x','120','-y','40']
    args+=['-c',str(ROOT),'cat']
    tm(*args)
    target=session+':'+name
    tm('send-keys','-t',target,'-l','quiet endpoint '+target)
    tm('send-keys','-t',target,'Enter')
    return target

def capture(endpoint): return tm('capture-pane','-p','-t',endpoint,'-S','-40').stdout.rstrip('\n')
def key(endpoint): return 'v3.'+hashlib.sha256(endpoint.encode()).hexdigest()
def md(text):return hashlib.md5(text.encode()).hexdigest()
def meta(home,task,endpoint):
    (home/'state'/f'{task}.meta').write_text(f'window={endpoint}\nkind=ship\nharness=codex\nbackend=tmux\n')
def start(home,envv,label,daemon=False):
    out=E/(label+'.out'); err=E/(label+'.err')
    with out.open('w') as a,err.open('w') as b:
        proc=subprocess.Popen(['bash','bin/fm-supervise-daemon.sh' if daemon else 'bin/fm-watch.sh'],cwd=ROOT,env=envv,stdout=a,stderr=b,start_new_session=True)
    procs.append(proc)
    return proc,out,err

def stop(proc):
    if proc.poll() is None:
        proc.terminate()
        try: proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid,signal.SIGTERM); proc.wait(timeout=10)

def until(pred,seconds=45):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        if pred(): return
        time.sleep(.15)
    raise AssertionError('timed out waiting for observable state')
def finished(proc,out,err):
    try: rc=proc.wait(timeout=45)
    except subprocess.TimeoutExpired:
        stop(proc); raise AssertionError(f'watcher did not exit: {out.read_text()} {err.read_text()}')
    assert rc==0,(rc,out.read_text(),err.read_text())
    return out.read_text().strip()
def ack(envv):
    r=run(['bash','bin/fm-wake-drain.sh'],envv)
    m=re.search(r'--ack-through ([0-9]+) --recovery-generation ([A-Za-z0-9._-]+)',r.stderr)
    assert m,repr(r.stderr)
    run(['bash','bin/fm-wake-drain.sh','--ack-through',m[1],'--recovery-generation',m[2]],envv)
    return r.stdout

def markers(home,endpoints):
    s=home/'state'; records=[]
    for ep in endpoints:
        k=key(ep)
        vals={x:(s/f'.{x}-{k}').read_text().strip() for x in ('hash','count','stale')}
        assert vals['hash']==md(capture(ep)),(ep,vals,capture(ep))
        assert int(vals['count'])>=2,(ep,vals)
        assert vals['stale']==vals['hash'],(ep,vals)
        records.append({'endpoint':ep,'key':k,**vals,'filename_bytes':{x:len(f'.{x}-{k}'.encode()) for x in vals}})
    return records

def passed(name,**evidence):
    report['scenarios'].append({'name':name,'result':'pass',**evidence})
    (E/'live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('PASS '+name,flush=True)
try:
    first=pane('s','a.0',True); second=pane('s','a_0')
    socket=tm('display-message','-p','#{socket_path}').stdout.strip()
    env['TMUX']=socket+','+tm('display-message','-p','#{pid}').stdout.strip()+',0'
    env['TMUX_PANE']=tm('display-message','-p','-t',first,'#{pane_id}').stdout.strip()
    meta(p,'first',first); meta(p,'second',second)
    state=p/'state'
    (state/'.hash-s_a_0').write_text(md(capture(first)))
    (state/'.stale-s_a_0').write_text(md(capture(first)))
    (state/'.count-s_a_0').write_text('99\n')
    wakes=[]; queues=[]
    for label in ('collision-first','collision-second'):
        proc,out,err=start(p,env,label)
        wakes.append(finished(proc,out,err)); queues.append(ack(env))
    assert set(wakes)=={'stale: '+first,'stale: '+second},wakes
    histories=markers(p,[first,second])
    assert histories[0]['hash']!=histories[1]['hash']
    assert (state/'.count-s_a_0').read_text()=='99\n'
    passed('S1 independent histories and wakes ignore ambiguous legacy evidence',wakes=wakes,queues=queues,histories=histories)
    saved={x:(state/f'.{x}-{key(first)}').read_text() for x in ('hash','stale')}
    for label,remove in [('sibling-removed',True),('sibling-restored',False)]:
        a,b=(state/'second.meta',p/'second.meta') if remove else (p/'second.meta',state/'second.meta')
        a.rename(b)
        n=int((state/f'.count-{key(first)}').read_text())
        proc,out,err=start(p,env,label)
        until(lambda:int((state/f'.count-{key(first)}').read_text() or '0')>=n+2 or proc.poll() is not None)
        assert proc.poll() is None,(out.read_text(),err.read_text())
        stop(proc)
        assert out.read_text()=='',out.read_text()
        assert all((state/f'.{x}-{key(first)}').read_text()==val for x,val in saved.items())
    passed('S2 sibling removal and restoration preserve identity without replay',histories=markers(p,[first,second]),legacy_count=(state/'.count-s_a_0').read_text().strip())
    q,qenv=lab('bytes'); qenv.update({k:env[k] for k in ('TMUX','TMUX_PANE','TMUX_TMPDIR')})
    names=['a.0','a_0','a/b','a%2fb','a%2eb','a%25b','a%b','a-b','a b','a!b','船员','船_员']
    endpoints=[first,second]+[pane('s',n) for n in names[2:]]
    for i,ep in enumerate(endpoints):
        meta(q,'bytes'+str(i),ep)
        (q/'state'/('.stale-'+key(ep))).write_text(md(capture(ep)))
    proc,out,err=start(q,qenv,'supported-bytes')
    until(lambda: all((q/'state'/('.count-'+key(ep))).exists() and int((q/'state'/('.count-'+key(ep))).read_text() or '0')>=2 for ep in endpoints) or proc.poll() is not None,90)
    assert proc.poll() is None,(out.read_text(),err.read_text())
    stop(proc)
    values=markers(q,endpoints)
    assert len(set(v['key'] for v in values))==len(endpoints)
    actual=run(['bash','-c','. bin/fm-watch-key-lib.sh; for ep in "$@"; do window_key "$ep"; printf "\\n"; done','_',*endpoints],qenv).stdout.splitlines()
    assert actual==[key(ep) for ep in endpoints]
    extra=['s:a.b','s:a_b','s:a/b','s:a:b','s:a%2fb','s:a%2eb','s:a%25b','s:a%b','s:a-b','s:a b','s:a!b','s:船.员','s:船_员']
    extra_actual=run(['bash','-c','. bin/fm-watch-key-lib.sh; for ep in \"$@\"; do window_key \"$ep\"; printf \"\\n\"; done','_',*extra],qenv).stdout.splitlines()
    assert extra_actual==[key(ep) for ep in extra]
    assert len(set(extra_actual))==len(extra)
    passed('S3 punctuation Unicode percent slash and underscore remain distinct',histories=values,additional_endpoint_keys=dict(zip(extra,extra_actual)))
    longsession='s'*180; longtask='t'*64
    long=pane(longsession,'fm-'+longtask,True)
    assert len(long.encode())==248
    l,lenv=lab('long'); lenv.update({k:env[k] for k in ('TMUX','TMUX_PANE','TMUX_TMPDIR')}); meta(l,longtask,long)
    proc,out,err=start(l,lenv,'long-endpoint'); wake=finished(proc,out,err)
    assert wake=='stale: '+long,wake
    queue=ack(lenv); history=markers(l,[long])
    assert all(n<=255 for n in history[0]['filename_bytes'].values())
    passed('S4 248-byte endpoint persists bounded history and wakes',wake=wake,queue=queue,histories=history)
    d,denv=lab('duplicates'); denv.update({k:env[k] for k in ('TMUX','TMUX_PANE','TMUX_TMPDIR')})
    ep=pane('s','fm-shared'); meta(d,'first',ep);meta(d,'second',ep)
    (d/'config'/'turnend-churn-absorb').touch()
    (d/'state'/'first.turn-ended').touch()
    (d/'state'/('.hash-'+key(ep))).write_text(md('the previous render'))
    (d/'state'/('.count-'+key(ep))).write_text('0\n')
    proc,out,err=start(d,denv,'duplicate-endpoint'); wake=finished(proc,out,err)
    assert 'signal: '+str(d/'state'/'first.turn-ended') in wake,wake
    queue=ack(denv)
    assert not (d/'state'/('.churn-since-'+key(ep))).exists()
    passed('S5 duplicate endpoint records surface changed-pane turn end',wake=wake,queue=queue,churn_deferral_created=False)
    h,henv=lab('daemon'); henv.update({k:env[k] for k in ('TMUX','TMUX_PANE','TMUX_TMPDIR')})
    hep=pane('s','fm-pause');meta(h,'held.task',hep)
    hs=h/'state'; wk=key(hep); tk='held_task'
    (hs/'held.task.status').write_text('paused: waiting for local test release\n')
    proc,out,err=start(h,henv,'watcher-initial-pause')
    initial_pause=finished(proc,out,err)
    assert 'signal: '+str(hs/'held.task.status') in initial_pause,initial_pause
    ack(henv)
    proc,out,err=start(h,henv,'watcher-paused-history')
    until(lambda:(hs/('.paused-'+wk)).exists() or proc.poll() is not None)
    assert proc.poll() is None,(out.read_text(),err.read_text())
    pause_history=markers(h,[hep])
    stop(proc)
    henv.update(FM_SUPERVISOR_BACKEND='tmux',FM_SUPERVISOR_TARGET=second,FM_DAEMON_PRIMARY_HARNESS='codex',FM_HOUSEKEEPING_TICK='1')
    proc,out,err=start(h,henv,'daemon-pause',True)
    until(lambda:(hs/('.subsuper-paused-'+tk)).exists() or proc.poll() is not None)
    assert proc.poll() is None,(out.read_text(),err.read_text())
    adoption={'task_marker':'.subsuper-paused-'+tk,'endpoint_marker':'.paused-'+wk,'task_marker_value':(hs/('.subsuper-paused-'+tk)).read_text().strip(),'watcher_created_pause':True,'watcher_pause_histories':pause_history}
    assert not (hs/('.subsuper-paused-'+wk)).exists()
    (hs/'held.task.status').write_text('working: resumed from the local pause\n')
    until(lambda:not(hs/('.subsuper-paused-'+tk)).exists() and not(hs/('.paused-'+wk)).exists())
    stop(proc)
    resumed=not(hs/('.paused-'+wk)).exists() and not(hs/('.subsuper-paused-'+tk)).exists()
    for name in ('.subsuper-paused-'+tk,'.subsuper-stale-'+tk,'.paused-'+wk,'.stale-'+wk,'.wedge-escalations-'+wk): (hs/name).write_text(str(int(time.time())))
    (hs/'held.task.status').write_text('done: local endpoint fixture completed\n')
    proc,out,err=start(h,henv,'daemon-terminal',True)
    pending=lambda:any((hs/n).exists() for n in ('.subsuper-paused-'+tk,'.subsuper-stale-'+tk,'.paused-'+wk,'.stale-'+wk,'.wedge-escalations-'+wk))
    until(lambda:not pending() or proc.poll() is not None)
    assert proc.poll() is None and not pending(),(out.read_text(),err.read_text())
    stop(proc)
    log=(hs/'.supervise-daemon.log').read_text()
    (E/'daemon-runtime.log').write_text(log)
    passed('S6 real daemon adopts pauses and clears resumed terminal tracking with separate task keys',adoption=adoption,resumed_cleanup=resumed,terminal_cleanup=not pending(),log=log)
finally:
    for proc in procs: stop(proc)
    for home,sd in sockets:
        run(['tmux','-L','fm-lab','kill-server'],{**base,'TMUX_TMPDIR':sd},check=False)
        run(['bash','bin/fm-lab-home.sh','teardown',home])
    for home in labs: shutil.rmtree(home)
    report['cleanup']={'labs_removed':all(not x.exists() for x in labs),'private_socket_directories_removed':all(not pathlib.Path(x[1]).exists() for x in sockets),'processes_reaped':all(x.poll() is not None for x in procs)}
    (E/'live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report['cleanup']),flush=True)
