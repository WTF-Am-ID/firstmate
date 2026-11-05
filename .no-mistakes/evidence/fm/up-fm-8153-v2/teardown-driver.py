import os,pathlib,json,subprocess,socket,time
r=pathlib.Path.cwd();w=r/'.validation-8153';e=pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MNFPC5933VBYSY2D40PSZ9')
env=os.environ.copy()
for k in list(env):
 if k.startswith(('FM_','HERDR_','TASKS_AXI_')):env.pop(k)
env.update({'LAVISH_AXI_STATE_DIR':str(w/'lavish-state'),'LAVISH_AXI_PORT':'49183','LAVISH_AXI_HOST':'127.0.0.1','LAVISH_AXI_NO_OPEN':'1','PATH':str(w/'node_modules/.bin')+':'+os.environ['PATH']})
with (e/'teardown.log').open('w') as log:
 for h in json.loads((w/'boardhomes.json').read_text()):
  env['FM_HOME']=h
  cmd=[str(r/'bin/fm-procevent-lavish.sh'),'retire',h+'/.lavish/bearings-board.html']
  p=subprocess.run(cmd,env=env,capture_output=True,text=True,timeout=40);log.write(f'{cmd}\nEXIT {p.returncode}\n{p.stdout}{p.stderr}\n');assert p.returncode==0
  p=subprocess.run([str(r/'bin/fm-procevent.sh'),'list'],env=env,capture_output=True,text=True,timeout=20);log.write(f'LIST EXIT {p.returncode}\n{p.stdout}{p.stderr}\n');assert p.returncode==0
 p=subprocess.run([str(w/'node_modules/.bin/lavish-axi'),'stop'],env=env,capture_output=True,text=True,timeout=40);log.write(f'LAVISH STOP EXIT {p.returncode}\n{p.stdout}{p.stderr}\n');assert p.returncode==0
 for i in range(50):
  s=socket.socket();s.settimeout(.2);status=s.connect_ex(('127.0.0.1',49183));s.close()
  if status!=0:break
  time.sleep(.1)
 assert status!=0,'Disposable Lavish port still listening'
 log.write('Disposable Lavish TCP port 49183 is closed. All three board registrations retired.\n')
print((e/'teardown.log').read_text())
