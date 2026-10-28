import os, pathlib, shutil, subprocess, sys, time
ROOT=pathlib.Path.cwd()
SCRATCH=ROOT/'.test-7782-tmp/baseline'
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
    print('BASELINE REPRODUCTION: base landing entrypoint with approved X advanced to Y',flush=True)
    c=setup('baseline'); assert accept(c).returncode==0; approve(c); advance(c)
    tools=SCRATCH/'tools'; shutil.copytree(ROOT/'bin',tools/'bin')
    old=run([GIT,'show','417cec2feb4e2976c0acdb2527b87b3ccc71535f:bin/fm-merge-local.sh']).stdout
    script=tools/'bin/fm-merge-local.sh'; script.write_text(old)
    p=land(c,script=script)
    print(f'base_entrypoint_exit={p.returncode}\n{p.stdout.strip()}\napproved_X={c["x"]}\nunapproved_Y={c["y"]}\nlanded={head(c)}\ncontent='+(c['p']/'content.txt').read_text(),flush=True)
    assert p.returncode==0 and head(c)==c['y']
    print('REPRODUCED: baseline lands unapproved Y instead of X',flush=True)
finally:
    shutil.rmtree(SCRATCH)
    print('Baseline disposable local project and home removed',flush=True)
