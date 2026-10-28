import os, subprocess, pathlib, time, json, shutil, re, signal, hashlib
ROOT=pathlib.Path.cwd()
E=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M61FZB6TD49YFXWTGJTG14SG')
log=(E/'live-watch-probe.log').open('w',buffering=1)
def record(s):
 print(s,flush=True); log.write(s+'\n')
env=dict(os.environ)
for k in ['NO_MISTAKES_GATE','FM_GATE_REFUSE_BYPASS','FM_ROOT_OVERRIDE','FM_STATE_OVERRIDE','FM_DATA_OVERRIDE','FM_CONFIG_OVERRIDE','FM_PROJECTS_OVERRIDE','TMUX','TMUX_PANE','FM_HOME','FM_CREW_STATE_BIN','FM_TEST_SEAM','REX_SESSION','REX_BLOCK']:
 env.pop(k,None)
lab=pathlib.Path(subprocess.check_output(['mktemp','-d','/tmp/fm-lab.XXXXXX'],text=True).strip())
env.update(FM_HOME=str(lab),TMUX_TMPDIR=str(lab/'tmux'),TERM='xterm-256color',FM_BACKEND='tmux')
watchers=[]
def tm(*args,check=True):
 r=subprocess.run(['tmux','-L','fm-lab',*args],env=env,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if check and r.returncode: raise RuntimeError('tmux '+str(args)+': '+r.stderr)
 return r.stdout

def cap(target): return tm('capture-pane','-p','-t',target)

def key(endpoint):
 return subprocess.check_output(['bash','-c','. bin/fm-watch-key-lib.sh; window_key "$1"','_',endpoint],env=env,text=True)

def file(name): return lab/'state'/name

def snapshot(label):
 rows={p.name:p.read_text(errors='replace') for p in (lab/'state').iterdir() if p.is_file() and p.name.startswith(('.hash-','.count-','.stale-','.wake-queue','.churn-since-'))}
 (E/(label+'.json')).write_text(json.dumps(rows,indent=2,ensure_ascii=False))
 record(label+' '+json.dumps(rows,ensure_ascii=False))

def runwatch(label,seconds=35,expect_exit=True):
 out=(E/(label+'.txt')).open('w')
 wenv=dict(env,FM_POLL='1',FM_SIGNAL_GRACE='1',FM_CHECK_INTERVAL='999999',FM_HEARTBEAT='999999',FM_SECONDMATE_LIVENESS_SECS='99999999',FM_WATCH_HANDLING_SUCCESSOR='1')
 socket=tm('display-message','-p','-t','primary','#{socket_path},#{pid},#{session_id}').strip().replace(',$',',')
 wenv['TMUX']=socket
 p=subprocess.Popen(['bin/fm-watch.sh'],env=wenv,stdout=out,stderr=subprocess.STDOUT,cwd=ROOT)
 watchers.append(p)
 try:
  if expect_exit:
   rc=p.wait(timeout=seconds)
   record(label+' exit='+str(rc))
  else:
   start=time.time(); seen=None; advances=0
   while time.time()-start<seconds:
    if p.poll() is not None: raise RuntimeError(label+' unexpectedly exited '+str(p.returncode))
    beat=file('.last-watcher-beat')
    m=beat.stat().st_mtime_ns if beat.exists() else None
    if m and m!=seen: advances+=1; seen=m
    if advances>=4: break
    time.sleep(.2)
   else: raise RuntimeError(label+' did not complete live polling cycles')
   p.terminate(); p.wait(timeout=15)
   record(label+' remained alive across '+str(advances)+' beacon updates')
 finally:
  if p.poll() is None: p.terminate(); p.wait(timeout=15)
  out.close()
 text=(E/(label+'.txt')).read_text()
 record(label+' product output:\n'+text)
 snapshot(label+'-state')
 return text

def ack():
 r=subprocess.run(['bin/fm-wake-drain.sh'],env=env,text=True,capture_output=True)
 record('DRAIN '+r.stdout+'\n'+r.stderr)
 m=re.search(r'--ack-through (\d+) --recovery-generation ([A-Za-z0-9._-]+)',r.stderr)
 if not m: raise RuntimeError('no drain acknowledgement token')
 r=subprocess.run(['bin/fm-wake-drain.sh','--ack-through',m[1],'--recovery-generation',m[2]],env=env,text=True,capture_output=True)
 record('ACK exit='+str(r.returncode)+' '+r.stdout+r.stderr)
 if r.returncode: raise RuntimeError('ack failed')

try:
 subprocess.run(['bin/fm-lab-home.sh','create',str(lab)],check=True,env=env,capture_output=True,text=True)
 (lab/'tmux').mkdir()
 record('LAB '+str(lab)+' revision='+subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip())
 tm('new-session','-d','-s','primary','-x','120','-y','35','-c',str(ROOT),'-e','FM_HOME='+str(lab),'codex')
 tm('set-option','-g','automatic-rename','off')
 tm('set-option','-g','allow-rename','off')
 tm('rename-window','-t','primary:0','a/b')
 tm('new-window','-d','-t','primary:','-n','a_b','-c',str(ROOT),'-e','FM_HOME='+str(lab),'codex')
 time.sleep(6)
 for target in ['primary:a/b','primary:a_b']:
  screen=cap(target); record('INITIAL '+target+'\n'+screen)
  if 'Hooks need review' in screen:
   if target.endswith('a/b'):
    tm('send-keys','-t',target,'Enter'); time.sleep(2)
   record('Using quiet Codex hook-review UI without accepting or disabling hooks')
  elif 'Sign in' in screen:
   raise RuntimeError('normal Codex login unavailable')
  else:
   tm('send-keys','-t',target,'-l','Unsubmitted isolation probe '+target)
 time.sleep(3)
 screens=[]
 for target in ['primary:a/b','primary:a_b']:
  screen=cap(target); screens.append(screen)
  (E/('codex-'+target.split(':')[1].replace('/','_')+'-'+str(len(screens))+'.txt')).write_text(screen)
  record('READY '+target+'\n'+screen)
 assert screens[0]!=screens[1], 'quiet pane displays must differ'
 for task,endpoint in [('first','primary:a/b'),('second','primary:a_b')]:
  file(task+'.meta').write_text('window='+endpoint+'\nkind=ship\nharness=codex\nbackend=tmux\n')
 legacy='primary_a_b'
 for marker,value in [('hash',hashlib.md5(b'the other endpoint prior pane').hexdigest()),('stale',hashlib.md5(b'the other endpoint prior pane').hexdigest()),('count','99\n'),('churn-since','1\n')]: file('.'+marker+'-'+legacy).write_text(value)
 a=key('primary:a/b'); b=key('primary:a_b'); assert a!=b
 record('KEYS '+json.dumps({'primary:a/b':a,'primary:a_b':b}))
 output=runwatch('collision-round1'); assert 'stale: primary:a/b' in output
 ack()
 output=runwatch('collision-round2'); assert 'stale: primary:a_b' in output
 ack()
 for k in [a,b]:
  assert file('.hash-'+k).read_text()==file('.stale-'+k).read_text()
  assert int(file('.count-'+k).read_text())>=2
 assert file('.hash-'+a).read_text()!=file('.hash-'+b).read_text()
 saved=file('second.meta').read_text(); file('second.meta').unlink()
 assert key('primary:a/b')==a
 runwatch('sibling-removed',expect_exit=False)
 file('second.meta').write_text(saved)
 assert key('primary:a/b')==a
 runwatch('sibling-restored',expect_exit=False)
 assert file('.count-'+legacy).read_text()=='99\n'
 record('PASS independent live Codex stale histories, wake delivery, sibling churn, and ignored legacy markers')
 # A legacy hash must never establish current churn evidence for a turn-end.
 for p in (lab/'state').glob('.hash-v2.*'): p.unlink()
 file('second.meta').unlink()
 (lab/'config'/'turnend-churn-absorb').touch()
 file('first.turn-ended').touch()
 output=runwatch('legacy-turn-end'); assert 'signal: '+str(file('first.turn-ended')) in output
 assert not file('.churn-since-'+a).exists()
 record('PASS legacy marker cannot absorb a live Codex turn-end')
 ack()
 # Reuse the two real Codex endpoints under supported Unicode/percent/slash names.
 file('first.turn-ended').unlink()
 names=['船/员%2f','船_员%2f']
 tm('rename-window','-t','primary:a/b',names[0])
 tm('rename-window','-t','primary:a_b',names[1])
 for task,name in zip(['first','second'],names):
  file(task+'.meta').write_text('window=primary:'+name+'\nkind=ship\nharness=codex\nbackend=tmux\n')
 for label,name in zip(['unicode-round1','unicode-round2'],names):
  output=runwatch(label)
  assert 'stale: primary:'+name in output
  k=key('primary:'+name)
  assert file('.hash-'+k).exists() and file('.stale-'+k).exists()
  assert '/' not in k
  ack()
 record('PASS real watcher persists distinct stable keys for Unicode, literal percent escapes, slash, underscore and colon')
 # Restore original endpoint names for the independent daemon handoff scenario.
 tm('rename-window','-t','primary:'+names[0],'a/b')
 tm('rename-window','-t','primary:'+names[1],'a_b')
 file('first.meta').write_text('window=primary:a/b\nkind=ship\nharness=codex\nbackend=tmux\n')
 file('second.meta').unlink()
 # Runtime daemon handoff uses the identical real watcher marker namespace.
 file('first.status').write_text('paused: awaiting disposable probe reset\n')
 file('.paused-'+a).touch(); file('.stale-'+a).touch(); file('.wedge-escalations-'+a).write_text('3\n')
 cmd='. bin/fm-supervise-daemon.sh; migrate_watcher_pause_markers "$FM_HOME/state"; test -e "$FM_HOME/state/.subsuper-paused-first" || exit 91; ls -a "$FM_HOME/state"; printf "done: probe complete\\n" > "$FM_HOME/state/first.status"; clear_pause_tracking primary:a/b "$FM_HOME/state"; ls -a "$FM_HOME/state"'
 r=subprocess.run(['bash','-c',cmd],env=env,cwd=ROOT,text=True,capture_output=True)
 (E/'daemon-live-handoff.txt').write_text(r.stdout+r.stderr)
 assert r.returncode==0,r.stderr
 assert not file('.paused-'+a).exists() and not file('.stale-'+a).exists() and not file('.wedge-escalations-'+a).exists()
 assert not file('.subsuper-paused-first').exists()
 record('PASS production daemon handoff and cleanup consumed live watcher v2 markers; task key stayed first')
 record('RESULT PASS')
except Exception as e:
 record('RESULT ERROR '+repr(e)); raise
finally:
 for p in watchers:
  if p.poll() is None:
   p.terminate()
   try:p.wait(timeout=15)
   except subprocess.TimeoutExpired:p.kill();p.wait()
 tm('kill-server',check=False)
 shutil.rmtree(lab)
 record('CLEANED disposable lab '+str(lab))
 log.close()
