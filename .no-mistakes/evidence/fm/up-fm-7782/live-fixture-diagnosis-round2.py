import pathlib, subprocess, time
path=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615GR82CTFFPXAXTV2V7AC7/live-landing-round2.py')
code=path.read_text().split('\ntry:\n    scenario(')[0].replace("'live-landing-round2.log'","'live-fixture-diagnosis-round2.log'")
exec(compile(code,str(path),'exec'))
try:
    c=Case('old-fixture-checkpoint'); c.ready(); c.approve()
    release=c.dir/'release'
    extra=c.shim('git','if [ "${3:-}" = rev-parse ] && [ "${4:-}" = --short ] && [ "${5:-}" = main ]; then\n output=$("$REAL_GIT" "$@") || exit $?\n printf "old fixture checkpoint reached\\n" > "$RACE_MARKER"\n while [ ! -e "$RACE_RELEASE" ]; do sleep 0.02; done\n printf "%s\\n" "$output"\n exit 0\nfi\nexec "$REAL_GIT" "$@"\n')
    extra['RACE_RELEASE']=str(release); env=c.env.copy(); env.update(extra)
    merger=subprocess.Popen(['bash',str(ROOT/'bin/fm-merge-local.sh'),'local-task'],env=env,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    try:
        deadline=time.monotonic()+20
        while not (c.dir/'race-observed').exists():
            if merger.poll() is not None:raise AssertionError('old checkpoint never reached '+merger.stdout.read())
            if time.monotonic()>deadline:raise AssertionError('old checkpoint timed out')
            time.sleep(.02)
        assert c.git('rev-parse','main').stdout.strip()==c.x,'old checkpoint still precedes landing'
        lock=c.home/'state/.control-local-task.lock'
        assert not lock.exists() and not lock.is_symlink(),'old checkpoint still holds task control lock'
        emit('OBSERVED at old fixture checkpoint: main already equals approved X and control lock is released; this is after the protected landing operation')
    finally:
        release.touch(); out=merger.communicate(timeout=30)[0]; emit(out+f'exit={merger.returncode}')
    assert merger.returncode==0
finally:
    shutil.rmtree(SCRATCH); emit('CLEANUP removed '+str(SCRATCH)); LOG.close()
