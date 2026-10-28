import os, pathlib, shutil, subprocess, sys, time
ROOT=pathlib.Path.cwd()
SCRATCH=ROOT/'.test-7782-tmp/live'
SCRATCH.mkdir()
E=os.environ.copy()
for key in list(E):
    if key.startswith('FM_') or key in ['TASKS_AXI_FILE','TASKS_AXI_BACKEND','GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR']:
        E.pop(key)
E.update(GIT_CONFIG_GLOBAL='/dev/null',GIT_CONFIG_NOSYSTEM='1',GIT_AUTHOR_NAME='Landing Probe',GIT_AUTHOR_EMAIL='probe@example.invalid',GIT_COMMITTER_NAME='Landing Probe',GIT_COMMITTER_EMAIL='probe@example.invalid',TMPDIR=str(ROOT/'.test-7782-tmp'),FM_GUARD_READ_ONLY='1')
GIT=shutil.which('git'); TASKS=shutil.which('tasks-axi')
def run(args,env=None,ok=True):
    p=subprocess.run([str(a) for a in args],env=env or E,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if ok and p.returncode: raise RuntimeError(f'{args}: rc={p.returncode}\n{p.stdout}')
    return p

def setup(name):
    d=SCRATCH/name; d.mkdir(); h=d/'home'
    run(['bash',ROOT/'bin/fm-lab-home.sh','create',h])
    env=E.copy(); env['FM_HOME']=str(h)
    (h/'.tasks.toml').write_text('backend = "markdown"\n[markdown]\npath = "data/backlog.md"\narchive = "data/done-archive.md"\ndone_keep = 10\n')
    p=h/'projects/project'; w=h/'projects/worker'
    run([GIT,'init','-q','-b','main',p]); (p/'content.txt').write_text('base\n')
    run([GIT,'-C',p,'add','.']); run([GIT,'-C',p,'commit','-qm','base'])
    base=run([GIT,'-C',p,'rev-parse','HEAD']).stdout.strip()
    run([GIT,'-C',p,'worktree','add','-qb','fm/local-task',w]); (w/'content.txt').write_text('approved X\n')
    run([GIT,'-C',w,'commit','-qam','X']); x=run([GIT,'-C',w,'rev-parse','HEAD']).stdout.strip()
    m=h/'state/local-task.meta'
    m.write_text(f'kind=ship\nmode=local-only\nharness=codex\nbranch=fm/local-task\nproject={p}\nworktree={w}\nspawn_gen=live-7782\n')
    run(['bash',ROOT/'bin/fm-tasks-axi.sh','add','local-task','Land X','--kind','ship'],env)
    return dict(d=d,h=h,p=p,w=w,m=m,base=base,x=x,env=env)

def accept(c,meta=None):
    return run(['bash','-c','. "$1/bin/fm-dod-lib.sh"; fm_dod_accept_ship_done ship local-only "$2" "$3" "done: ready in branch fm/local-task" "$4/state" local-task "$5"','probe',ROOT,c['w'],c['p'],c['h'],meta or c['m']],c['env'],False)

def land(c,env=None,script=None):
    return run(['bash',script or ROOT/'bin/fm-merge-local.sh','local-task'],env or c['env'],False)

def head(c): return run([GIT,'-C',c['p'],'rev-parse','HEAD']).stdout.strip()
def advance(c):
    (c['w']/'content.txt').write_text('unapproved Y\n'); run([GIT,'-C',c['w'],'commit','-qam','Y'])
    c['y']=run([GIT,'-C',c['w'],'rev-parse','HEAD']).stdout.strip()
def assert_refused(c,p):
    print(f'exit={p.returncode}\n{p.stdout.strip()}\nmain={head(c)} expected_unchanged={c["base"]}',flush=True)
    assert p.returncode != 0 and head(c)==c['base']

def approve(c):
    p=run(['bash',ROOT/'bin/fm-captain-hold.sh','hold','local-task','--reason','Fixture approval pending'],c['env'])
    print(p.stdout.strip())
    p=land(c); assert_refused(c,p)
    decision=c['d']/'decision.txt'; decision.write_text('Approve the reported X for local landing.\n')
    p=run(['bash',ROOT/'bin/fm-captain-hold.sh','answer','local-task','--release','--decision-file',decision],c['env'])
    print(p.stdout.strip())

try:
    print('SCENARIO: approved X refuses moved Y, then restored X lands',flush=True)
    c=setup('closure'); assert accept(c).returncode==0
    print(f'base={c["base"]}\nX={c["x"]}\n'+c['m'].read_text())
    approve(c); advance(c); print('Y='+c['y']); assert_refused(c,land(c))
    stale=accept(c); print(f'reobserving_old_done_exit={stale.returncode}\n{stale.stdout.strip()}'); assert stale.returncode!=0
    run([GIT,'-C',c['w'],'reset','--hard',c['x']]); p=land(c)
    print(f'restored_X_exit={p.returncode}\n{p.stdout.strip()}\nlanded={head(c)}\ncontent='+ (c['p']/'content.txt').read_text())
    assert p.returncode==0 and head(c)==c['x']

    print('SCENARIO: invalid durable identities refuse',flush=True)
    for name,value in [('missing',None),('empty',''),('abbreviated',c['x'][:8]),('expression','refs/heads/fm/local-task'),('nonhex','g'*40),('nonexistent','1'*40),('duplicate',c['x']+'\nlocal_done_head='+c['x'])]:
        t=setup(name)
        if value is not None:
            with t['m'].open('a') as f:f.write('local_done_head='+value+'\n')
        print('case='+name); assert_refused(t,land(t))

    print('SCENARIO: stale task generation cannot acquire a new readiness identity',flush=True)
    t=setup('stale'); captured=t['d']/'captured.meta'; shutil.copyfile(t['m'],captured)
    with t['m'].open('a') as f:f.write('spawn_gen=replacement\n')
    before=t['m'].read_bytes(); p=accept(t,captured)
    print(f'accept_exit={p.returncode}\n{p.stdout.strip()}\nmetadata_unchanged={t["m"].read_bytes()==before}')
    assert p.returncode!=0 and t['m'].read_bytes()==before

    print('SCENARIO: approval identity changes while landing waits for metadata lock',flush=True)
    t=setup('waiting-race'); assert accept(t).returncode==0; advance(t)
    run([GIT,'-C',t['w'],'reset','--hard',t['x']])
    locker=subprocess.Popen(['bash','-c','. "$1/bin/fm-wake-lib.sh"; lock=$(fm_meta_lock_path "$2"); fm_lock_acquire_wait "$lock"; echo LOCKED; read -r done; fm_lock_release "$lock"','lock',str(ROOT),str(t['m'])],env=t['env'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    assert locker.stdout.readline().strip()=='LOCKED'
    pending=subprocess.Popen(['bash',str(ROOT/'bin/fm-merge-local.sh'),'local-task'],env=t['env'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    control=t['h']/'state/.control-local-task.lock'
    for _ in range(300):
        if control.exists():break
        time.sleep(.02)
    assert control.exists() and pending.poll() is None
    t['m'].write_text(t['m'].read_text().replace('local_done_head='+t['x'],'local_done_head='+t['y']))
    print(f'changed_while_waiting={t["x"]} -> {t["y"]}')
    locker.communicate('release\n',timeout=10)
    out=pending.communicate(timeout=30)[0]
    assert_refused(t,subprocess.CompletedProcess([],pending.returncode,out))

    # Scheduling seams forward every call to the installed real consumers.
    # Only an adversarial concurrent mutation is injected; no product response is fabricated.
    shimdir=SCRATCH/'schedule'; shimdir.mkdir()
    shim='''#!/usr/bin/env python3
import os,subprocess,sys,pathlib
e=os.environ
p=subprocess.run([e['REAL_CONSUMER']]+sys.argv[1:])
trigger=(e['SEAM']=='approval' and 'show' in sys.argv[1:]) or (e['SEAM']=='git' and 'merge' in sys.argv[1:])
# For Git, mutate before the actual invocation instead; see separate git shim.
if trigger and not pathlib.Path(e['RACE_MARK']).exists():
 pathlib.Path(e['RACE_MARK']).write_text('triggered')
 if e['RACE']=='branch': subprocess.run([e['REAL_GIT'],'-C',e['RACE_PROJECT'],'update-ref','refs/heads/fm/local-task',e['RACE_Y']],check=True)
 else:
  m=pathlib.Path(e['RACE_META']); m.write_text(m.read_text().replace(e['RACE_X'],e['RACE_Y']))
sys.exit(p.returncode)
'''
    (shimdir/'tasks-axi').write_text(shim); (shimdir/'tasks-axi').chmod(0o755)
    print('SCENARIO: real approval-read races refuse',flush=True)
    for mode in ['branch','approval']:
        t=setup('hold-race-'+mode); assert accept(t).returncode==0; approve(t); advance(t); run([GIT,'-C',t['w'],'reset','--hard',t['x']])
        env=t['env'].copy(); marker=t['d']/'raced'
        env.update(PATH=str(shimdir)+':'+E['PATH'],REAL_CONSUMER=TASKS,REAL_GIT=GIT,SEAM='approval',RACE=mode,RACE_MARK=str(marker),RACE_PROJECT=str(t['p']),RACE_META=str(t['m']),RACE_X=t['x'],RACE_Y=t['y'])
        print('mutation='+mode); assert_refused(t,land(t,env)); assert marker.exists()

    print('SCENARIO: worker tip moves in final Git invocation; only literal X can land',flush=True)
    t=setup('last-race'); assert accept(t).returncode==0; approve(t); advance(t); run([GIT,'-C',t['w'],'reset','--hard',t['x']])
    gitshim=SCRATCH/'git-seam'; gitshim.mkdir()
    (gitshim/'git').write_text('''#!/usr/bin/env python3
import os,subprocess,sys,pathlib
e=os.environ
if 'merge' in sys.argv[1:]:
 pathlib.Path(e['RACE_MARK']).write_text(' '.join(sys.argv[1:]))
 subprocess.run([e['REAL_GIT'],'-C',e['RACE_PROJECT'],'update-ref','refs/heads/fm/local-task',e['RACE_Y']],check=True)
os.execv(e['REAL_GIT'],[e['REAL_GIT']]+sys.argv[1:])
'''); (gitshim/'git').chmod(0o755)
    env=t['env'].copy(); marker=t['d']/'git-args'; env.update(PATH=str(gitshim)+':'+E['PATH'],REAL_GIT=GIT,RACE_MARK=str(marker),RACE_PROJECT=str(t['p']),RACE_Y=t['y'])
    p=land(t,env); print(f'exit={p.returncode}\n{p.stdout.strip()}\nGit invocation={marker.read_text()}\nX={t["x"]}\nY={t["y"]}\nlanded={head(t)}')
    assert p.returncode==0 and head(t)==t['x']
    print('ALL LIVE SCENARIOS PASSED',flush=True)
finally:
    shutil.rmtree(SCRATCH)
    print('Disposable local projects and lab homes removed',flush=True)
