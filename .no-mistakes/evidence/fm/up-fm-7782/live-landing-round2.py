import os, pathlib, subprocess, shutil, json, tempfile
ROOT=pathlib.Path.cwd()
EVIDENCE=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615GR82CTFFPXAXTV2V7AC7')
SCRATCH=pathlib.Path(tempfile.mkdtemp(prefix='.test-live-7782-',dir=ROOT))
ENV=os.environ.copy()
for key in ['FM_ROOT_OVERRIDE','FM_STATE_OVERRIDE','FM_DATA_OVERRIDE','FM_CONFIG_OVERRIDE','FM_PROJECTS_OVERRIDE','FM_HOME','FM_GATE_REFUSE_BYPASS','FM_TEST_SEAM','FM_TASK_ID','GIT_DIR','GIT_COMMON_DIR','GIT_INDEX_FILE','GIT_WORK_TREE','TASKS_AXI_FILE','TASKS_AXI_BACKEND']:
    ENV.pop(key,None)
ENV.update(GIT_CONFIG_GLOBAL='/dev/null',GIT_CONFIG_NOSYSTEM='1',GIT_AUTHOR_NAME='Local landing validation',GIT_AUTHOR_EMAIL='test@example.invalid',GIT_COMMITTER_NAME='Local landing validation',GIT_COMMITTER_EMAIL='test@example.invalid')
REAL_GIT=shutil.which('git'); REAL_TASKS=shutil.which('tasks-axi')
results=[]
LOG=open(EVIDENCE/'live-landing-round2.log','w',buffering=1)
def emit(s):
    print(s,flush=True); print(s,file=LOG)
def run(args,env=None,cwd=None,check=True,input=None):
    p=subprocess.run([str(a) for a in args],cwd=cwd or ROOT,env=env or ENV,text=True,input=input,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90)
    emit('$ '+' '.join(str(a) for a in args)+'\n'+p.stdout.rstrip()+f'\nexit={p.returncode}')
    if check and p.returncode: raise AssertionError(p.stdout)
    return p
class Case:
    def __init__(self,name):
        self.dir=SCRATCH/name; self.dir.mkdir(); self.home=self.dir/'home'; self.proj=self.dir/'project'; self.wt=self.dir/'worker'
        run(['bash',ROOT/'bin/fm-lab-home.sh','create',self.home])
        self.env=ENV.copy(); self.env.update(FM_HOME=str(self.home))
        (self.home/'.tasks.toml').write_text('backend = "markdown"\n[markdown]\npath = "data/backlog.md"\narchive = "data/done-archive.md"\ndone_keep = 10\n')
        (self.home/'data/backlog.md').write_text('## In flight\n\n## Queued\n\n## Done\n')
        run(['git','init','-q','-b','main',self.proj])
        (self.proj/'base.txt').write_text('base\n'); self.git('add','base.txt'); self.git('commit','-qm','base')
        self.base=self.git('rev-parse','HEAD').stdout.strip()
        self.git('worktree','add','-q','-b','fm/local-task',self.wt)
        (self.wt/'approved.txt').write_text('approved X\n'); self.git('add','approved.txt',wt=True); self.git('commit','-qm','X',wt=True)
        self.x=self.git('rev-parse','HEAD',wt=True).stdout.strip()
        self.meta=self.home/'state/local-task.meta'
        self.meta.write_text(f'kind=ship\nmode=local-only\nbranch=fm/local-task\nproject={self.proj}\nworktree={self.wt}\nspawn_gen=live-1\nharness=codex\n')
        run([REAL_TASKS,'add','local-task','Land approved X','--kind','ship','--start'],env=self.env,cwd=self.home)
    def git(self,*args,wt=False,check=True):
        return run([REAL_GIT,'-C',self.wt if wt else self.proj,*args],check=check)
    def ready(self,check=True,meta=None):
        cmd='source "$1/bin/fm-dod-lib.sh"; fm_dod_accept_ship_done ship local-only "$2" "$3" "done: ready in branch fm/local-task" "$4/state" local-task "$5"'
        return run(['bash','-c',cmd,'live-done',ROOT,self.wt,self.proj,self.home,meta or self.meta],env=self.env,check=check)
    def approve(self):
        run(['bash',ROOT/'bin/fm-captain-hold.sh','hold','local-task','--reason','Local merge approval'],env=self.env)
        (self.home/'approval.txt').write_text('Land exactly the recorded X.\n')
        run(['bash',ROOT/'bin/fm-captain-hold.sh','answer','local-task','--release','--decision-file',self.home/'approval.txt'],env=self.env)
    def land(self,extra=None,script=None):
        env=self.env.copy(); env.update(extra or {})
        return run(['bash',script or ROOT/'bin/fm-merge-local.sh','local-task'],env=env,check=False)
    def advance(self):
        (self.wt/'unapproved.txt').write_text('unapproved Y\n'); self.git('add','unapproved.txt',wt=True); self.git('commit','-qm','Y',wt=True)
        self.y=self.git('rev-parse','HEAD',wt=True).stdout.strip()
    def clean_refusal(self,p):
        assert p.returncode != 0,'landing succeeded unexpectedly'
        assert self.git('rev-parse','main').stdout.strip()==self.base,'main moved'
        assert self.git('status','--porcelain').stdout.strip()=='','checkout dirty'
        assert not (self.proj/'approved.txt').exists(),'approved file left behind'
        emit(f'OBSERVED refusal exit={p.returncode}, main={self.base}, clean checkout, approved.txt absent')
    def shim(self,tool,body):
        bindir=self.dir/'schedule-bin'; bindir.mkdir(exist_ok=True)
        path=bindir/tool; path.write_text('#!/bin/bash\n'+body); path.chmod(0o755)
        return {'PATH':str(bindir)+os.pathsep+ENV['PATH'],'REAL_GIT':REAL_GIT,'REAL_TASKS':REAL_TASKS,'RACE_PROJ':str(self.proj),'RACE_Y':getattr(self,'y',''),'RACE_META':str(self.meta),'RACE_MARKER':str(self.dir/'race-observed')}
def scenario(name,fn):
    emit('\nSCENARIO '+name)
    try:
        fn(); results.append(dict(name=name,result='pass',live=True)); emit('RESULT pass')
    except Exception as ex:
        results.append(dict(name=name,result='fail',live=True,reason=str(ex))); emit('RESULT fail '+repr(ex))
def approved():
    c=Case('approved'); assert c.ready().returncode==0
    assert f'local_done_head={c.x}\n' in c.meta.read_text(); emit('PERSISTED '+c.meta.read_text())
    c.approve(); c.advance(); c.clean_refusal(c.land())
    assert c.ready(check=False).returncode!=0,'old done rebound to Y'
    assert f'local_done_head={c.x}\n' in c.meta.read_text()
    c.git('reset','--hard',c.x,wt=True); p=c.land(); assert p.returncode==0
    assert c.git('rev-parse','main').stdout.strip()==c.x
    assert (c.proj/'approved.txt').read_text()=='approved X\n'
    assert not (c.proj/'unapproved.txt').exists()
    assert c.git('status','--porcelain').stdout.strip()==''
    emit(f'OBSERVED approved X landed exactly: main={c.x}; approved.txt=approved X; no unapproved.txt; clean checkout')
def bad_records():
    for kind in ['missing','empty','abbreviated','expression','duplicate','nonhex']:
        c=Case('invalid-'+kind)
        value={'missing':'','empty':'local_done_head=\n','abbreviated':f'local_done_head={c.x[:8]}\n','expression':'local_done_head=refs/heads/fm/local-task\n','duplicate':f'local_done_head={c.x}\nlocal_done_head={c.x}\n','nonhex':'local_done_head='+'g'*40+'\n'}[kind]
        with c.meta.open('a') as f:f.write(value)
        c.clean_refusal(c.land())
def held():
    c=Case('held'); c.ready()
    run(['bash',ROOT/'bin/fm-captain-hold.sh','hold','local-task','--reason','Approval still pending'],env=c.env)
    c.clean_refusal(c.land())
def approval_races():
    for mode in ['branch','approval']:
        c=Case('approval-race-'+mode); c.ready(); c.approve(); c.advance(); c.git('reset','--hard',c.x,wt=True)
        action='"$REAL_GIT" -C "$RACE_PROJ" update-ref refs/heads/fm/local-task "$RACE_Y"' if mode=='branch' else 'printf "local_done_head=%s\\n" "$RACE_Y" >> "$RACE_META"'
        extra=c.shim('tasks-axi','case " $* " in\n *" show local-task "*)\n'+action+'\nprintf "approval-read seam hit\\n" > "$RACE_MARKER"\n;;\nesac\nexec "$REAL_TASKS" "$@"\n')
        p=c.land(extra); assert (c.dir/'race-observed').exists(),'approval-read seam not reached'; c.clean_refusal(p)
def final_race():
    c=Case('final-race'); c.ready(); c.approve(); c.advance(); c.git('reset','--hard',c.x,wt=True)
    extra=c.shim('git','case " $* " in\n *" update-ref "*" --stdin "|*" merge --ff-only "*)\n "$REAL_GIT" -C "$RACE_PROJ" update-ref refs/heads/fm/local-task "$RACE_Y" || exit $?\n printf "final-invocation seam hit\\n" > "$RACE_MARKER"\n;;\nesac\nexec "$REAL_GIT" "$@"\n')
    p=c.land(extra); assert (c.dir/'race-observed').exists(),'final seam not reached'
    assert c.git('rev-parse','fm/local-task').stdout.strip()==c.y
    c.clean_refusal(p)
def snapshot():
    c=Case('snapshot'); captured=c.dir/'captured.meta'; captured.write_text(c.meta.read_text())
    c.meta.write_text(c.meta.read_text().replace('spawn_gen=live-1','spawn_gen=live-2'))
    assert c.ready(check=False,meta=captured).returncode!=0
    assert 'local_done_head=' not in c.meta.read_text(); emit('OBSERVED replacement generation remains unpinned after stale captured readiness')
def diverged():
    c=Case('diverged'); c.ready(); c.approve(); c.git('commit','--allow-empty','-qm','diverged'); c.base=c.git('rev-parse','HEAD').stdout.strip(); c.clean_refusal(c.land())
def baseline():
    c=Case('baseline'); c.ready(); c.approve(); c.advance()
    baseline_bin=c.dir/'baseline-bin'; shutil.copytree(ROOT/'bin',baseline_bin)
    p=run(['git','show','417cec2feb4e2976c0acdb2527b87b3ccc71535f:bin/fm-merge-local.sh'])
    (baseline_bin/'fm-merge-local.sh').write_text(p.stdout)
    p=c.land(extra={'FM_ROOT_OVERRIDE':str(ROOT)},script=baseline_bin/'fm-merge-local.sh')
    assert p.returncode==0 and c.git('rev-parse','main').stdout.strip()==c.y
    emit(f'BASELINE REPRODUCED defect: approved={c.x}; main landed unapproved Y={c.y}')
try:
    scenario('S1: Approved X persists, advancing to Y refuses, stale readiness refuses, restoring X lands exactly X',approved)
    scenario('S2: Missing, empty, abbreviated, symbolic, duplicate and nonhex approval heads refuse',bad_records)
    scenario('S3: An unreleased captain hold prevents local landing',held)
    scenario('S4: Branch and approval-record changes during the real approval read refuse',approval_races)
    scenario('S5: A branch move inside the final Git invocation refuses and restores the checkout',final_race)
    scenario('S6: Captured readiness cannot pin a replacement task generation',snapshot)
    scenario('S7: Diverged main refuses without changing its checkout',diverged)
    scenario('B1: Baseline lands Y after approval at X, reproducing the original defect',baseline)
finally:
    shutil.rmtree(SCRATCH); emit('CLEANUP removed '+str(SCRATCH))
    (EVIDENCE/'live-landing-round2-results.json').write_text(json.dumps(results,indent=2)+'\n'); LOG.close()
if any(r['result']=='fail' for r in results):raise SystemExit(1)
