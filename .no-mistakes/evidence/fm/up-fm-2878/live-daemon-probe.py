import os,subprocess,pathlib,time,shutil,json,hashlib
root=pathlib.Path.cwd(); E=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M61FZB6TD49YFXWTGJTG14SG')
log=(E/'live-daemon-probe.log').open('w',buffering=1)
def record(s): print(s,flush=True);log.write(s+'\n')
env=dict(os.environ)
for k in ['NO_MISTAKES_GATE','FM_GATE_REFUSE_BYPASS','FM_ROOT_OVERRIDE','FM_STATE_OVERRIDE','FM_DATA_OVERRIDE','FM_CONFIG_OVERRIDE','FM_PROJECTS_OVERRIDE','TMUX','TMUX_PANE','FM_HOME','FM_CREW_STATE_BIN','FM_TEST_SEAM','REX_SESSION','REX_BLOCK']:
 env.pop(k,None)
lab=pathlib.Path(subprocess.check_output(['mktemp','-d','/tmp/fm-lab.XXXXXX'],text=True).strip());state=lab/'state';children=[]
env.update(FM_HOME=str(lab),TMUX_TMPDIR=str(lab/'tmux'),TERM='xterm-256color',FM_BACKEND='tmux')
def tm(*args,check=True):
 r=subprocess.run(['tmux','-L','fm-lab',*args],env=env,text=True,capture_output=True)
 if check and r.returncode: raise RuntimeError(r.stderr)
 return r.stdout

def waitfor(predicate,label,seconds=20):
 deadline=time.time()+seconds
 while time.time()<deadline:
  if predicate():record('PASS '+label);return
  time.sleep(.2)
 raise RuntimeError('timeout '+label)

def snap(label):
 data={p.name:p.read_text(errors='replace') for p in state.iterdir() if p.is_file() and p.name.startswith(('.paused-','.stale-','.wedge-','.subsuper-','.wake-queue','.hash-','.churn-since-'))}
 (E/(label+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2));record(label+' '+json.dumps(data,ensure_ascii=False))
try:
 subprocess.run(['bin/fm-lab-home.sh','create',str(lab)],check=True,env=env,capture_output=True);(lab/'tmux').mkdir()
 tm('new-session','-d','-s','primary','-x','120','-y','35','-c',str(root),'-e','FM_HOME='+str(lab),'codex')
 tm('set-option','-g','automatic-rename','off');tm('set-option','-g','allow-rename','off');tm('rename-window','-t','primary:0','a/b')
 env['TMUX']=tm('display-message','-p','-t','primary','#{socket_path},#{pid},#{session_id}').strip().replace(',$',',')
 time.sleep(6);record('REAL CODEX TUI\n'+tm('capture-pane','-p','-t','primary:a/b'))
 k=subprocess.check_output(['bash','-c','. bin/fm-watch-key-lib.sh; window_key primary:a/b'],text=True,env=env)
 # Duplicate task records must never let one pane's prior hash suppress a turn-end.
 meta='window=primary:a/b\nkind=ship\nharness=codex\nbackend=tmux\n'
 (state/'first.meta').write_text(meta);(state/'second.meta').write_text(meta)
 (lab/'config'/'turnend-churn-absorb').touch()
 (state/('.hash-'+k)).write_text(hashlib.md5(b'older quiet Codex screen').hexdigest())
 (state/('.count-'+k)).write_text('0\n');(state/'first.turn-ended').touch()
 with (E/'duplicate-live-turn-end.txt').open('w') as out:
  p=subprocess.Popen(['bin/fm-watch.sh'],env=dict(env,FM_POLL='1',FM_SIGNAL_GRACE='1',FM_CHECK_INTERVAL='999999',FM_HEARTBEAT='999999',FM_WATCH_HANDLING_SUCCESSOR='1'),stdout=out,stderr=subprocess.STDOUT);children.append(p);rc=p.wait(timeout=30)
 output=(E/'duplicate-live-turn-end.txt').read_text();record(output)
 assert rc==0 and 'signal: '+str(state/'first.turn-ended') in output
 assert not (state/('.churn-since-'+k)).exists()
 snap('duplicate-live-state');record('PASS duplicate endpoint records surface live turn-end instead of absorbing ambiguous progress')
 # Begin independent daemon lifecycle from a clean, still-disposable state.
 for pth in state.iterdir():
  if pth.is_file():pth.unlink()
 (state/'first.meta').write_text(meta)
 (state/'first.status').write_text('paused: awaiting disposable probe reset\n')
 for prefix in ['.paused-','.stale-','.stale-since-','.wedge-escalations-','.writing-since-']:(state/(prefix+k)).write_text('3\n')
 denv=dict(env,FM_DAEMON_PRIMARY_HARNESS='codex',FM_SUPERVISOR_BACKEND='tmux',FM_SUPERVISOR_TARGET='primary:a/b',FM_POLL='30',FM_SIGNAL_GRACE='1',FM_HOUSEKEEPING_TICK='1',FM_ESCALATE_BATCH_SECS='999999',FM_HEARTBEAT_SCAN_SECS='999999',FM_CHECK_INTERVAL='999999',FM_HEARTBEAT='999999',FM_SECONDMATE_LIVENESS_SECS='99999999')
 with (E/'daemon-process-output.txt').open('w') as out:
  daemon=subprocess.Popen(['bin/fm-supervise-daemon.sh'],env=denv,stdout=out,stderr=subprocess.STDOUT);children.append(daemon)
  waitfor(lambda:(state/'.subsuper-paused-first').exists(),'executed daemon migrates watcher pause into task-key marker')
  assert daemon.poll() is None
  snap('daemon-paused-live-state')
  assert not (state/('.subsuper-paused-'+k)).exists()
  (state/'first.status').write_text('working: resumed disposable probe\n')
  prefixes=['.paused-','.stale-','.stale-since-','.wedge-escalations-','.writing-since-']
  waitfor(lambda:not (state/'.subsuper-paused-first').exists() and all(not (state/(prefix+k)).exists() for prefix in prefixes),'executed daemon reconciles resumed status and removes v2 watcher tracking')
  snap('daemon-resumed-live-state')
  assert daemon.poll() is None
  daemon.terminate();daemon.wait(timeout=20)
  if (state/'.supervise-daemon.log').exists():(E/'daemon-runtime.log').write_text((state/'.supervise-daemon.log').read_text())
  record('DAEMON exit='+str(daemon.returncode))
 record('RESULT PASS')
finally:
 for p in children:
  if p.poll() is None:
   p.terminate()
   try:p.wait(timeout=20)
   except subprocess.TimeoutExpired:p.kill();p.wait()
 tm('kill-server',check=False);shutil.rmtree(lab);record('CLEANED '+str(lab));log.close()
