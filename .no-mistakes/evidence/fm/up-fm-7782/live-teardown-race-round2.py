import pathlib, subprocess, time
path=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615GR82CTFFPXAXTV2V7AC7/live-landing-round2.py')
code=path.read_text().split('\ntry:\n    scenario(')[0].replace("'live-landing-round2.log'","'live-teardown-race-round2.log'")
exec(compile(code,str(path),'exec'))
def protected_landing():
    c=Case('teardown-race'); c.ready(); c.approve()
    extra=c.shim('git','if [ "${3:-}" = merge-base ] && [ "${4:-}" = --is-ancestor ]; then\n "$REAL_GIT" "$@" || exit $?\n printf "ancestry validation reached\\n" > "$RACE_MARKER"\n while [ ! -e "$RACE_RELEASE" ]; do sleep 0.02; done\n exit 0\nfi\nexec "$REAL_GIT" "$@"\n')
    release=c.dir/'release'; extra['RACE_RELEASE']=str(release)
    env=c.env.copy(); env.update(extra)
    args=['bash',str(ROOT/'bin/fm-merge-local.sh'),'local-task']
    emit('$ '+' '.join(args)+' [paused after ancestry validation]')
    merger=subprocess.Popen(args,env=env,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    try:
        deadline=time.monotonic()+20
        while not (c.dir/'race-observed').exists():
            if merger.poll() is not None:raise AssertionError('landing never reached ancestry validation: '+merger.stdout.read())
            if time.monotonic()>deadline:raise AssertionError('ancestry-validation seam not reached')
            time.sleep(.02)
        emit('OBSERVED landing paused after ancestry validation with task control lock held')
        p=run(['bash',ROOT/'bin/fm-teardown.sh','local-task','--force'],env=c.env,check=False)
        assert p.returncode!=0,'forced teardown succeeded during landing'
        assert 'another lifecycle action is already running for task local-task' in p.stdout,p.stdout
        assert c.meta.exists(),'teardown retired task metadata'
        assert c.wt.exists(),'teardown discarded worker'
        emit('OBSERVED forced teardown refused; task metadata and worker remain')
    finally:
        release.touch(); out=merger.communicate(timeout=60)[0]; emit(out+f'exit={merger.returncode}')
    assert merger.returncode==0,'landing failed after rejected teardown'
    assert c.git('rev-parse','main').stdout.strip()==c.x
    assert c.git('status','--porcelain').stdout.strip()==''
    assert c.meta.exists(),'landing lost its task metadata'
    emit('OBSERVED exactly approved X landed after forced teardown was rejected')
try:
    scenario('S10: Forced teardown during validated landing refuses, then exactly approved X lands',protected_landing)
finally:
    shutil.rmtree(SCRATCH); emit('CLEANUP removed '+str(SCRATCH))
    (EVIDENCE/'live-teardown-race-round2-results.json').write_text(json.dumps(results,indent=2)+'\n'); LOG.close()
if any(r['result']=='fail' for r in results):raise SystemExit(1)
