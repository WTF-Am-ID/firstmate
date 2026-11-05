import os,json,pathlib,subprocess,hashlib,shutil
R=pathlib.Path.cwd()
E=pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MMJ0V3K6NAXBAG5VFRYCHH')
H=E/'live-homes'
H.mkdir(exist_ok=True)
env=os.environ.copy()
for k in list(env):
    if k.startswith(('FM_', 'HERDR_', 'TASKS_AXI_')) or k in ('NO_MISTAKES_GATE',): env.pop(k,None)
env.update(TMPDIR=str(E/'tooltmp'),FM_BACKEND='tmux',LAVISH_AXI_HOST='127.0.0.1',LAVISH_AXI_PORT='49353',LAVISH_AXI_STATE_DIR=str(E/'lavish-state'),LAVISH_AXI_NO_OPEN='1',FM_PROCEVENT_CLAIM_ROOT=str(E/'claims'),PATH=str(R/'.validation-8153-tools/node_modules/.bin')+':'+env['PATH'])
(E/'live-env.json').write_text(json.dumps({k:v for k,v in env.items() if k.startswith(('FM_', 'LAVISH_'))}))
def cmd(args,home=None,file=None,ok=True):
    en=env.copy()
    if home: en['FM_HOME']=str(home)
    p=subprocess.run(args,cwd=R,env=en,text=True,capture_output=True,timeout=100)
    with (E/'live-transcript.log').open('a') as f:
        f.write('$ '+ ' '.join(map(str,args))+'\nFM_HOME='+str(home)+'\nexit='+str(p.returncode)+'\n'+p.stdout+p.stderr+'\n')
    if file: (E/file).write_text(p.stdout)
    if ok: assert p.returncode==0,(args,p.returncode,p.stderr)
    return p
for name in ('parent','generated','supplied'):
    home=H/name
    cmd(['bin/fm-lab-home.sh','create',str(home)])
    (home/'config/crew-harness').write_text('codex\n')
parent=H/'parent'; mate=H/'generated'; supplied=H/'supplied'
# These are disposable product input fixtures. Existing agent instructions are copied verbatim.
for name,home in [('generated',mate),('supplied',supplied)]:
    shutil.copyfile(R/'AGENTS.md',home/'AGENTS.md')
    (home/'bin').mkdir(exist_ok=True)
    (home/'.fm-secondmate-home').write_text(name+'\n')
(parent/'data/secondmates.md').write_text(''.join(f'- {name} - Synthetic question transport (home: {H/name}; scope: validation; projects: sample; added 2026-11-04)\n' for name in ('generated','supplied')))
title='Choose the release scope after every integration owner has completed the staged checks and recorded the result for the operator to review'
options=[
'A: retain the current workflow through the complete staged verification and preserve every supported integration until its owner has reported the outcome.',
'B: postpone the independent migration until the remaining review finishes while preserving the complete fallback route and its observation period.',
'C: choose the final café / 東京 alternative only after the report is reviewed, keeping literal <script>example</script> text intact.'
]
reason='Which route should proceed? '+' '.join(options)
question=title+': '+reason
assert len(title)>90 and question.index(options[-1])>200
backlog=f'''## In flight

## Queued
- [ ] full-call - {title} (repo: sample) (kind: captain) (hold: {reason}) (hold-kind: captain)
- [ ] deferred - {title} (repo: sample) (kind: captain) (hold: {reason}) (hold-kind: captain) (hold-until: 2099-01-01)
- [ ] report-call - Review the proposal (repo: sample) (kind: captain) (hold: data/proposal/report.md) (hold-kind: captain)
- [ ] minimal - Minimal choice (hold: Keep or defer?) (hold-kind: captain)

## Done
- [x] answered - Previously answered call (repo: sample) (kind: captain) (done 2026-11-01)
'''
for home in (parent,mate):
    (home/'data/backlog.md').write_text(backlog)
    (home/'data/proposal').mkdir()
    (home/'data/proposal/report.md').write_text('REPORT CONTENT MUST NOT BECOME THE QUESTION OR OPTIONS.\n')
(supplied/'data/backlog.md').write_text('## In flight\n\n## Queued\n\n## Done\n')
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for h in (parent,mate,supplied) for p in h.rglob('backlog.md')}
ledger=json.loads(cmd(['bin/fm-fleet-snapshot.sh','--secondmate-home-summary'],mate,'generated-summary.json').stdout)
(mate/'state/home-summary.json').write_text(json.dumps(ledger))
assert any(d['question']==question and len(d['summary'])<=161 and len(d['reason'])<=161 for d in ledger['decisions_open'])
assert any(d['id']=='deferred' and d['question']==question and len(d['title'])<=121 and len(d['hold_reason'])<=161 for d in ledger['queued'])
legacy=dict(ledger)
legacy.update(home=str(supplied),decisions_open=[
{'id':'legacy','key':'legacy','verb':'captain-hold','source':'backlog','hold_bucket':'live','summary':'Supplied question','reason':reason},
{'id':'minimal','verb':'captain-hold','source':'backlog','hold_bucket':'live'},
{'id':'report','key':'report','verb':'captain-hold','source':'backlog','hold_bucket':'live','summary':'Review report','reason':'data/supplied/report.md'},
{'id':'explicit','key':'explicit','verb':'captain-hold','source':'backlog','hold_bucket':'live','summary':'Bounded overview','reason':'Bounded reason','question':question}],
queued=[{'id':'queued-only','title':'Deferred supplied question','hold_kind':'captain','hold_bucket':'dated','hold_until':'2099-01-01','hold_reason':reason}],active_children=[],holds=[],landed=[],endpoints=[],counts={'active_children':0,'decisions_open':4,'holds':0,'queued':1,'landed':0,'endpoints':0})
(supplied/'state/home-summary.json').write_text(json.dumps(legacy))
(E/'supplied-ledger.json').write_text(json.dumps(legacy,ensure_ascii=False,indent=2))
def snapshot(args,name): return json.loads(cmd(['bin/fm-bearings-snapshot.sh','--json']+args,parent,name).stdout)
a=snapshot([],'snapshot-default.json'); b=snapshot(['--all-decisions'],'snapshot-expanded.json')
expected_ids=['full-call','report-call','minimal','generated/full-call','generated/report-call','generated/minimal','supplied/legacy','supplied/minimal','supplied/report','supplied/explicit']
assert [d['id'] for d in a['decisions_open']]==expected_ids,[d['id'] for d in a['decisions_open']]
by={d['id']:d for d in b['decisions_open']}
for id in ('full-call','deferred','generated/full-call','generated/deferred','supplied/explicit'): assert by[id]['question']==question,id
assert by['supplied/legacy']['question']=='Supplied question: '+reason
assert by['supplied/minimal']['question']=='minimal: captain decision pending'
assert by['supplied/report']['question']=='Review report: data/supplied/report.md'
assert by['supplied/queued-only']['question']=='Deferred supplied question: '+reason
assert by['report-call']['question']=='Review the proposal: data/proposal/report.md'
assert by['minimal']['question']=='Minimal choice: Keep or defer?'
assert all(len(d['summary'])<=91 for d in b['decisions_open'])
assert not any(d['id']=='answered' for d in b['decisions_open'])
toon=cmd(['bin/fm-bearings-snapshot.sh','--all-decisions'],parent,'snapshot.toon').stdout
assert question in toon
assert before=={str(p):hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in before}
(E/'expected.json').write_text(json.dumps({'question':question,'options':options,'default_order':expected_ids,'backlog_hashes':before},ensure_ascii=False,indent=2))
# Explicitly authored board options, never parsed from the stored question.
payload={'schema':'fm-bearings-board.v1','home':'Synthetic validation home','generated':a['generated'],'prs_live':False,'captains_call':[{'key':d['key'] or d['id'],'type':'decision','repo':'sample','title':d['id'],'decide':d['question'],'options':[{'value':'retain','label':'Retain the workflow'},{'value':'defer','label':'Defer the migration'},{'value':'final','label':'Choose the final alternative'}]} for d in a['decisions_open'] if d['id'] in ('full-call','generated/full-call','supplied/legacy','supplied/report','supplied/explicit')],'underway':[],'landed':[],'charted':[]}
# Slash is not legal in board keys. Preserve transport text, with explicit local presentation keys.
for i,c in enumerate(payload['captains_call']): c['key']='probe-'+str(i)
(E/'board-payload.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
print('LIVE SNAPSHOT PASS: exact full question, late options, Unicode, literal markup, local/generated/supplied ledgers, defaults, bounded overview, ordering, deferred reveal and unchanged backlog.')
print('Question characters:',len(question))
