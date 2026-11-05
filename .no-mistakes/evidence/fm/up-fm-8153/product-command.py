import os,sys,json,pathlib,subprocess
E=pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MMJ0V3K6NAXBAG5VFRYCHH')
env=os.environ.copy()
for k in list(env):
    if k.startswith(('FM_','HERDR_','TASKS_AXI_')): env.pop(k,None)
env.update(json.loads((E/'live-env.json').read_text()))
env.update(FM_HOME=str(E/'live-homes/parent'),PATH=str(pathlib.Path.cwd()/'.validation-8153-tools/node_modules/.bin')+':'+env['PATH'],TMPDIR=str(E/'tooltmp'),CHROME_DEVTOOLS_AXI_SESSION='fm8153-01M6MMJ0',CHROME_DEVTOOLS_AXI_USER_DATA_DIR=str(E/'chrome-profile'),CHROME_DEVTOOLS_AXI_IDLE_TIMEOUT_MS='120000')
p=subprocess.run(sys.argv[1:],env=env,text=True,capture_output=True,timeout=100)
with (E/'presentation-transcript.log').open('a') as f: f.write('$ '+' '.join(sys.argv[1:])+'\nexit='+str(p.returncode)+'\n'+p.stdout+p.stderr+'\n')
print(p.stdout,end='');print(p.stderr,end='',file=sys.stderr)
sys.exit(p.returncode)
