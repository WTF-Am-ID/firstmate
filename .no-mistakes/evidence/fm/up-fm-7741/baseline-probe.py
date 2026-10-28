import os,pathlib,shutil,signal,subprocess,tempfile,time
root=pathlib.Path.cwd()
evid=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M6059VFKV9G8RK8QBEAVXX33')
scratch=pathlib.Path(tempfile.mkdtemp(prefix='.local-test-7741-baseline-',dir=root))
p=None
with (evid/'baseline-probe.log').open('w',buffering=1) as log:
    try:
        baseline=scratch/'baseline'
        shutil.copytree(root/'bin',baseline/'bin',symlinks=True)
        for name in ('fm-watch.sh','fm-classify-lib.sh'):
            content=subprocess.check_output(['git','show','2ba4c455f5c22d467707a8791f3207f3f179668a:bin/'+name],cwd=root)
            (baseline/'bin'/name).write_bytes(content)
        for label,code in [('baseline',baseline),('candidate',root)]:
            home=scratch/(label+'-home')
            subprocess.run(['/bin/bash',str(root/'bin/fm-lab-home.sh'),'create',str(home)],check=True,capture_output=True)
            (home/'state/home-summary.json').touch()
            (home/'config/open-decision-reminders').touch()
            (home/'state/worker.status').write_text(f'needs-decision [at={int(time.time())-100}] [key=api]: missed hand-off\nworking: unrelated progress\n')
            env={k:v for k,v in os.environ.items() if not k.startswith('FM_') and k not in ('TMUX','TMUX_PANE')}
            env.update(FM_HOME=str(home),FM_POLL='1',FM_SIGNAL_GRACE='0',FM_HEARTBEAT='999999',FM_OPEN_DECISION_OVERDUE_SECS='2',FM_OPEN_DECISION_BACKOFF_MAX_SECS='8',FM_PROCEVENT_CLAIM_ROOT=str(home/'claims'))
            subprocess.run(['/bin/bash','-c','. bin/fm-wake-lib.sh; fm_wake_status_mark_current "$FM_HOME/state" "$FM_HOME/state/worker.status"'],cwd=root,env=env,check=True)
            log.write(f'{label} revision '+('2ba4c455f5c22d467707a8791f3207f3f179668a' if label=='baseline' else '87dd6f7296e6487371a0174e8ed019078e5583b8')+'\n')
            log.write(f'$ FM_HOME={home} FM_OPEN_DECISION_OVERDUE_SECS=2 /bin/bash {code}/bin/fm-watch.sh\n')
            p=subprocess.Popen(['/bin/bash',str(code/'bin/fm-watch.sh')],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
            if label=='baseline':
                time.sleep(4)
                assert p.poll() is None, p.communicate()
                assert not (home/'state/.wake-queue').exists()
                os.killpg(p.pid,signal.SIGTERM)
                out,err=p.communicate(timeout=12)
                log.write('After 4s: watcher alive, no reminder or durable wake despite overdue keyed decision. Reported failure reproduced.\n'+out+err+'\n')
            else:
                out,err=p.communicate(timeout=12)
                assert p.returncode==0 and 'check: open decision overdue: worker key=api age=' in out,(out,err)
                log.write('stdout='+out+'stderr='+err+'exit='+str(p.returncode)+'\nDURABLE QUEUE\n'+(home/'state/.wake-queue').read_text())
        log.write('Baseline missed reminder; candidate emitted reminder for equivalent durable input.\n')
    finally:
        if p and p.poll() is None:
            os.killpg(p.pid,signal.SIGTERM); p.communicate(timeout=12)
        shutil.rmtree(scratch)
        log.write('Removed disposable baseline code copy and both lab homes.\n')
print('Baseline failure reproduced; candidate reminder confirmed.')
