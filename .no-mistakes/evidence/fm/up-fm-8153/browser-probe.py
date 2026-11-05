import pathlib,json,re,subprocess
E=pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MMJ0V3K6NAXBAG5VFRYCHH')
x=json.loads((E/'expected.json').read_text())
def run(*args):
 p=subprocess.run(['python3',str(E/'product-command.py'),'chrome-devtools-axi',*args],text=True,capture_output=True,timeout=100)
 assert p.returncode==0,p.stdout+p.stderr
 return p.stdout
s=run('snapshot'); toggle=re.search(r'uid=(\S+) button "Annotate".*pressed',s)
if toggle: s=run('click','@'+toggle.group(1))
checks=[]
for i,expected in enumerate([x['question'],x['question'],'Supplied question: '+x['question'].split(': ',1)[1],'Review report: data/supplied/report.md',x['question']]):
 if i:
  next_button=re.search(r'uid=(\S+) button "Next card"',s)
  assert next_button,s
  s=run('click','@'+next_button.group(1))
 assert expected in s,(i,s)
 (E/f'browser-card-{i+1}.log').write_text(s)
 checks.append({'card':i+1,'expected_text':expected,'exact_text_present':True})
 if i in (1,2,3): run('screenshot',str(E/f'decision-card-{i+1}.png'))
(E/'browser-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
print('LIVE BROWSER PASS: all five rendered cards preserve their exact expected question or report-path text. Local, generated and supplied ledgers traversed with Next card.')
