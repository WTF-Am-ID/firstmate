import os,json,pathlib,subprocess,hashlib,time
R=pathlib.Path.cwd(); W=R/'.validation-8153'; E=pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MNFPC5933VBYSY2D40PSZ9')
baseenv=os.environ.copy()
for k in list(baseenv):
 if k.startswith(('FM_', 'HERDR_', 'TASKS_AXI_')): baseenv.pop(k)
baseenv.update({'LAVISH_AXI_STATE_DIR':str(W/'lavish-state'),'LAVISH_AXI_PORT':'49183','LAVISH_AXI_HOST':'127.0.0.1','LAVISH_AXI_NO_OPEN':'1','PATH':str(W/'node_modules/.bin')+':'+os.environ['PATH']})
def run(argv,home=None,root=False,out=None):
 env=baseenv.copy()
 if home: env['FM_HOME']=str(home)
 if root: env['FM_ROOT_OVERRIDE']=str(W/'fixture-root')
 p=subprocess.run([str(x) for x in argv],env=env,capture_output=True,text=True,timeout=90)
 if out: (E/out).write_text(p.stdout)
 with (E/'live-cli.log').open('a') as f: f.write(f'COMMAND {argv} FM_HOME={home} fixture-root={root}\nEXIT {p.returncode}\n{p.stdout}\n{p.stderr}\n')
 if p.returncode: raise RuntimeError(f'{argv}: exit {p.returncode}: {p.stderr[-2000:]}')
 return p.stdout
(W/'fixture-root').mkdir(exist_ok=True)
main=W/'parent'; generated=W/'generated'; supplied=W/'supplied'
for h in [main,generated,supplied]:
 run([R/'bin/fm-lab-home.sh','create',h])
 (h/'.tasks.toml').write_text('backend = "markdown"\n[markdown]\npath = "data/backlog.md"\narchive = "data/done-archive.md"\ndone_keep = 10\n')
for h,id in [(generated,'generated'),(supplied,'supplied')]:
 (h/'.fm-secondmate-home').write_text(id+'\n'); (h/'bin').mkdir(); (h/'AGENTS.md').write_bytes((R/'AGENTS.md').read_bytes())
T='Choose the release route while preserving the current workflow and its recorded alternatives through the final review and the complete approval record'
options=['A: retain the supported workflow until every dependency completes its staged verification and the full downstream contract remains available for review.', 'B: defer the independent migration through its observation period while retaining the rollback route and every currently supported integration.', 'C: wait for the final café / 東京 / 🚢 approval and preserve the complete late option.']
reason='Which route should proceed? '+' '.join(options)
question=T+': '+reason
assert len(T)>90 and question.index(options[-1])>200
backlog=f'''## In flight\n\n## Queued\n- [ ] scope-call - {T} (repo: sample) (kind: captain) (hold: {reason}) (hold-kind: captain)\n- [ ] dated-call - {T} (repo: sample) (kind: captain) (hold: {reason}) (hold-kind: captain) (hold-until: 2099-01-01)\n- [ ] report-call - Review proposal (repo: sample) (kind: captain) (hold: data/proposal/report.md) (hold-kind: captain)\n\n## Done\n- [x] answered-call - Answered question (repo: sample) (kind: captain) (done 2026-10-01)\n'''
for h in [main,generated,supplied]: (h/'data/backlog.md').write_text(backlog)
(main/'data/secondmates.md').write_text(''.join(f'- {id} - disposable validation (home: {h}; scope: validation; projects: sample; added 2026-11-04)\n' for id,h in [('generated',generated),('supplied',supplied)]))
for h in [generated,supplied]:
 summary=json.loads(run([R/'bin/fm-fleet-snapshot.sh','--secondmate-home-summary'],h,True,out=h.name+'-summary.json'))
 if h==supplied:
  summary['decisions_open']=[{'id':'legacy','key':'legacy','verb':'captain-hold','source':'backlog','hold_bucket':'live','summary':'Supplied legacy question','reason':reason},{'id':'minimal','verb':'captain-hold','source':'backlog','hold_bucket':'live'},{'id':'report','key':'report','verb':'captain-hold','source':'backlog','hold_bucket':'live','summary':'Review supplied report','reason':'data/supplied/report.md'},{'id':'explicit','key':'explicit','verb':'captain-hold','source':'backlog','hold_bucket':'live','summary':'Compact supplied summary','reason':'Compact supplied reason','question':question}]
  summary['queued']=[{'id':'deferred','title':'Supplied deferred question','hold_kind':'captain','hold_bucket':'dated','hold_until':'2099-01-01','hold_reason':reason}]
  summary['counts']['decisions_open']=4; summary['counts']['queued']=1
 (h/'state/home-summary.json').write_text(json.dumps(summary,ensure_ascii=False))
 (E/(h.name+'-ledger-input.json')).write_text(json.dumps(summary,ensure_ascii=False,indent=2))
before={str(h):hashlib.sha256((h/'data/backlog.md').read_bytes()).hexdigest() for h in [main,generated,supplied]}
snapshot=json.loads(run([R/'bin/fm-bearings-snapshot.sh','--json'],main,True,out='snapshot-default.json'))
expanded=json.loads(run([R/'bin/fm-bearings-snapshot.sh','--json','--all-decisions'],main,True,out='snapshot-expanded.json'))
toon=run([R/'bin/fm-bearings-snapshot.sh','--all-decisions'],main,True,out='snapshot.toon')
expected={'scope-call':question,'report-call':'Review proposal: data/proposal/report.md','generated/scope-call':question,'generated/report-call':'Review proposal: data/proposal/report.md','supplied/legacy':'Supplied legacy question: '+reason,'supplied/minimal':'minimal: captain decision pending','supplied/report':'Review supplied report: data/supplied/report.md','supplied/explicit':question}
assert [x['id'] for x in snapshot['decisions_open']]==list(expected),snapshot['decisions_open']
for row in snapshot['decisions_open']:
 assert row['question']==expected[row['id']],row
 assert len(row['summary'])<=91
 assert row['question'] in toon
expanded_by={x['id']:x for x in expanded['decisions_open']}
for id in ['dated-call','generated/dated-call']: assert expanded_by[id]['question']==question
assert expanded_by['supplied/deferred']['question']=='Supplied deferred question: '+reason
s=json.loads((generated/'state/home-summary.json').read_text())
assert all(len(x['summary'])<=161 and len(x['reason'])<=161 for x in s['decisions_open'])
assert all(len(x['title'])<=121 and len(x['hold_reason'])<=161 for x in s['queued'])
# The composer transports the emitted question verbatim, with explicit option labels.
# Options are test-authored choices, never inferred from recorded prose.
boardhomes=[]
for category,rows in [('local',[x for x in snapshot['decisions_open'] if '/' not in x['id']]),('generated',[x for x in snapshot['decisions_open'] if x['id'].startswith('generated/')]),('supplied',[x for x in snapshot['decisions_open'] if x['id'].startswith('supplied/')])]:
 h=W/('board-'+category); run([R/'bin/fm-lab-home.sh','create',h]); boardhomes.append(str(h))
 (h/'data/backlog.md').write_text('## In flight\n\n## Queued\n\n## Done\n')
 calls=[{'key':x['id'].replace('/','.'),'type':'decision','repo':'sample','title':x['id'],'decide':x['question'],'allow_freeform':True,'options':[{'value':'retain','label':'Retain workflow'},{'value':'defer','label':'Defer migration'},{'value':'wait','label':'Wait for final review'}]} for x in rows]
 payload={'schema':'fm-bearings-board.v1','home':'8153-'+category,'generated':snapshot['generated'],'prs_live':False,'captains_call':calls,'underway':[],'landed':[],'charted':[]}
 p=h/'payload.json';p.write_text(json.dumps(payload,ensure_ascii=False)); (E/(category+'-board-payload.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2))
 run([R/'bin/fm-bearings-board.sh','build',p],h,out=category+'-board-build.log')
 (E/(category+'-board.html')).write_bytes((h/'.lavish/bearings-board.html').read_bytes())
 for x in rows: assert x['question'] in expected.values()
(W/'boardhomes.json').write_text(json.dumps(boardhomes))
after={str(h):hashlib.sha256((h/'data/backlog.md').read_bytes()).hexdigest() for h in [main,generated,supplied]}
assert before==after
(E/'live-oracle.json').write_text(json.dumps({'revision':run(['git','rev-parse','HEAD']).strip(),'title':T,'reason':reason,'options':options,'expected_default_order':list(expected),'expected_questions':expected,'backlog_hashes_before':before,'backlog_hashes_after':after,'assertions':'exact full text, late option after 200, Unicode, report-only text, missing fields fallback, explicit supplied question, compact bounds, default order and dated reveal, no backlog mutations'},ensure_ascii=False,indent=2))
print('Live snapshots and three real board builds completed. All independent text/order/bounds/lifecycle assertions passed.')
