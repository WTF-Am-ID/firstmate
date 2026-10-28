import pathlib, time, subprocess
path=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615GR82CTFFPXAXTV2V7AC7/live-landing-round2.py')
code=path.read_text().split('\ntry:\n    scenario(')[0]
code=code.replace("'live-landing-round2.log'","'live-lock-races-round2.log'")
exec(compile(code,str(path),'exec'))
def lock_race(mode):
    c=Case('locked-'+mode); c.ready(); c.approve(); c.advance(); c.git('reset','--hard',c.x,wt=True)
    marker=c.dir/'lock-held'
    holder=subprocess.Popen(['bash','-c','source "$1/bin/fm-wake-lib.sh"; fm_lock_try_acquire "$2" || exit; printf ready > "$3"; read -r release; fm_lock_release "$2"','lock-holder',str(ROOT),str(c.home/'state/.control-local-task.lock'),str(marker)],env=c.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    merger=None
    try:
        deadline=time.monotonic()+15
        while not marker.exists():
            if holder.poll() is not None:raise AssertionError('lock holder exited '+holder.stdout.read())
            if time.monotonic()>deadline:raise AssertionError('lock holder never acquired lock')
            time.sleep(.02)
        real_cat=shutil.which('cat')
        extra=c.shim('cat','case "$*" in\n *".control-local-task.lock"*) printf "landing reached owned control lock\\n" > "$RACE_MARKER";;\nesac\nexec "'+real_cat+'" "$@"\n')
        env=c.env.copy(); env.update(extra)
        args=['bash',str(ROOT/'bin/fm-merge-local.sh'),'local-task']
        emit('$ '+' '.join(args)+' [held-lock interleaving]')
        merger=subprocess.Popen(args,env=env,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        deadline=time.monotonic()+15
        while not (c.dir/'race-observed').exists():
            if merger.poll() is not None:raise AssertionError('landing did not wait '+merger.stdout.read())
            if time.monotonic()>deadline:raise AssertionError('control lock seam not reached')
            time.sleep(.02)
        if mode=='head':
            c.meta.write_text(c.meta.read_text().replace('local_done_head='+c.x,'local_done_head='+c.y))
            c.git('update-ref','refs/heads/fm/local-task',c.y)
        else:c.meta.write_text(c.meta.read_text().replace('spawn_gen=live-1','spawn_gen=live-2'))
        emit('INTERLEAVING changed '+mode+' after landing captured expected identity and waited for control lock')
        holder.stdin.write('release\n'); holder.stdin.flush(); out=holder.communicate(timeout=15)[0]; assert holder.returncode==0,out
        out=merger.communicate(timeout=30)[0]; emit(out+f'exit={merger.returncode}')
        c.clean_refusal(subprocess.CompletedProcess(args,merger.returncode,out))
    finally:
        if holder.poll() is None:holder.stdin.write('release\n'); holder.stdin.flush(); holder.communicate(timeout=15)
        if merger is not None and merger.poll() is None:merger.terminate(); merger.communicate(timeout=15)
try:
    scenario('S8: Replacing a valid approval head while landing waits for its control lock refuses',lambda:lock_race('head'))
    scenario('S9: Replacing the task generation while landing waits for its control lock refuses',lambda:lock_race('generation'))
finally:
    shutil.rmtree(SCRATCH); emit('CLEANUP removed '+str(SCRATCH))
    (EVIDENCE/'live-lock-races-round2-results.json').write_text(json.dumps(results,indent=2)+'\n'); LOG.close()
if any(r['result']=='fail' for r in results):raise SystemExit(1)
