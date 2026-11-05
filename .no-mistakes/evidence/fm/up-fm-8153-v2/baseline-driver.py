import pathlib,subprocess,os,json
r=pathlib.Path.cwd(); w=r/'.validation-8153'; e=pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MNFPC5933VBYSY2D40PSZ9'); b=w/'baseline-bin';b.mkdir()
for f in (r/'bin').iterdir():
 if f.name in ['fm-bearings-snapshot.sh','fm-fleet-snapshot.sh']:
  (b/f.name).write_bytes(subprocess.check_output(['git','show','4bd1e3aa72c85ae4ba7a7c7f69bc3168702b28da:bin/'+f.name])); (b/f.name).chmod(0o755)
 else: (b/f.name).symlink_to(f)
env=os.environ.copy()
for k in list(env):
 if k.startswith(('FM_', 'HERDR_', 'TASKS_AXI_')): env.pop(k)
env.update(FM_HOME=str(w/'parent'),FM_ROOT_OVERRIDE=str(w/'fixture-root'))
p=subprocess.run([str(b/'fm-bearings-snapshot.sh'),'--json'],env=env,capture_output=True,text=True,timeout=60)
(e/'baseline-snapshot.json').write_text(p.stdout)
assert p.returncode==0,p.stderr
base=json.loads(p.stdout);target=json.loads((e/'snapshot-default.json').read_text());oracle=json.loads((e/'live-oracle.json').read_text())
baserow=next(x for x in base['decisions_open'] if x['id']=='scope-call');newrow=next(x for x in target['decisions_open'] if x['id']=='scope-call')
assert 'question' not in baserow and oracle['options'][-1] not in json.dumps(baserow)
assert newrow['summary']==baserow['summary'] and newrow['question']==oracle['expected_questions']['scope-call']
assert [x['id'] for x in base['decisions_open']]==[x['id'] for x in target['decisions_open']]
result={'baseline_revision':'4bd1e3aa72c85ae4ba7a7c7f69bc3168702b28da','target_revision':'4cce427ed353799ea3d71e223b8252727b73a363','baseline':baserow,'target':newrow,'baseline_exit':p.returncode,'regression':'The real baseline snapshot omits the final option and has no full question. The candidate carries every option and preserves the same compact summary and call order.'}
(e/'baseline-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
