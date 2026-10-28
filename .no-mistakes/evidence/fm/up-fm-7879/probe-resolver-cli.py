#!/usr/bin/env python3
"""Independent public CLI probes. No credential retrieval or HTTP execution.
Run from the gate worktree using python3 <this-file>.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path.cwd()
evidence = Path(__file__).parent
bash = shutil.which('bash')
report = {'revision':subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip(),
          'method':'Public CLI using disposable homes and installed jq/bash. No substitute product, credential retrieval, HTTP request, or model session.',
          'blocked_probe':'Additional loopback HTTP probe rejected before execution by PreToolUse: System service modification not allowed. No retry or bypass.',
          'calls':[], 'scenarios':[], 'before_fix':[]}
lab = Path(tempfile.mkdtemp(prefix='.resolver-cli-probe-', dir=root))
try:
    home = lab/'home'
    home.mkdir()
    config = home/'config'
    config.mkdir()
    brief = lab/'brief.md'
    brief.write_text('Fix the pager.\n')
    restricted = lab/'restricted-bin'
    restricted.mkdir()
    for name in ['bash','chmod','cp','dirname','jq','mktemp','rm']:
        os.symlink(shutil.which(name), restricted/name)
    sources = config/'dispatch-credential-sources.json'
    candidate = lab/'candidate.json'
    valid = {'typesafe':{'type':'macos-keychain','service':'not-retrieved'},'openrouter':{'type':'macos-keychain','service':'also-not-retrieved','account':'optional'}}
    candidate.write_text(json.dumps(valid))
    env = {k:v for k,v in os.environ.items() if not k.startswith(('FM_','TYPESAFE_','OPENROUTER_','DISPATCH_')) and k not in ['BASH_ENV','ENV']}
    env.update({'FM_HOME':str(home), 'TMPDIR':str(lab), 'PATH':str(restricted)})
    def run(label,args=None,extra=None,tool=None):
        command=[bash,str(tool or root/'bin/fm-dispatch-resolve.sh')]+(args if args is not None else [str(brief)])
        proc=subprocess.run(command,env={**env,**(extra or {})},capture_output=True,text=True,timeout=10)
        report['calls'].append({'label':label,'argv':command,'environment_overrides':extra or {},'exit':proc.returncode,'stdout':proc.stdout,'stderr':proc.stderr})
        return proc
    def passed(name):
        report['scenarios'].append({'name':name,'result':'pass','live':True})
    def off(p):
        assert p.returncode==0 and p.stdout=='' and p.stderr.startswith('dispatch-resolve: off'), p
    # The actual product must not read .env in either inspection mode.
    os.mkfifo(home/'.env')
    initial=hashlib.sha256(candidate.read_bytes()).hexdigest()
    for path,expected in [(os.environ['PATH'],None),(str(restricted),False)]:
        p=run('inspect adapter availability',['--credential-capabilities'],{'PATH':path})
        assert p.returncode==0, p
        supported=json.loads(p.stdout)['sources']['macos-keychain']['supported']
        assert isinstance(supported,bool)
        if expected is not None:
            assert supported is expected
        p=run('validate supplied candidate without writing home',['--validate-credential-sources',str(candidate)],{'PATH':path})
        assert p.returncode==0 and json.loads(p.stdout)=={'supported':supported}, p
    assert initial==hashlib.sha256(candidate.read_bytes()).hexdigest()
    assert list(config.iterdir())==[]
    (home/'.env').unlink()
    passed('Capability and candidate inspection finish without reading a FIFO .env or changing candidate/home config; absent executable reports unsupported')
    for provider in ['typesafe','openrouter']:
        extra={'FM_DISPATCH_PROVIDER':provider,'FM_DISPATCH_MODEL':'local-fixture'}
        off(run(provider+' absent declaration remains off',extra=extra))
        sources.write_text('{}')
        off(run(provider+' empty declaration remains off',extra=extra))
        other='openrouter' if provider=='typesafe' else 'typesafe'
        sources.write_text(json.dumps({other:valid[other]}))
        off(run(provider+' other provider declaration stays off',extra=extra))
        sources.unlink()
    # Foreign provider key alone never enables default dispatch.
    off(run('OpenRouter key alone does not opt into that provider',extra={'OPENROUTER_API_KEY':'synthetic-unused'}))
    passed('Absent, empty, and other-provider declarations stay off for both provider selections; OpenRouter key alone does not select OpenRouter')
    invalid = ['null','[]','{',json.dumps({'typesafe':None}),json.dumps({'typesafe':{'type':'unknown','service':'do-not-echo'}}),json.dumps({'typesafe':{'type':'macos-keychain','service':''}})]
    invalid += [json.dumps({provider+'\n':{'type':'macos-keychain','service':'do-not-echo'}}) for provider in ['typesafe','openrouter']]
    for index,value in enumerate(invalid):
        sources.write_text(value)
        for args,extra,label in [(['--validate-credential-sources',str(sources)],{},'candidate'),(None,{'FM_DISPATCH_PROVIDER':'typesafe'},'Typesafe runtime'),(None,{'FM_DISPATCH_PROVIDER':'openrouter','FM_DISPATCH_MODEL':'local-fixture'},'OpenRouter runtime')]:
            p=run('invalid declaration '+str(index)+' '+label,args,extra)
            assert p.returncode==2 and p.stdout=='' and 'invalid credential sources' in p.stderr and 'do-not-echo' not in p.stderr, p
    passed('Malformed configuration and both trailing-newline provider IDs return actionable exit 2 in candidate validation and both runtime selections')
    sources.write_text(json.dumps(valid))
    for provider in ['typesafe','openrouter']:
        p=run(provider+' unavailable credential adapter',extra={'FM_DISPATCH_PROVIDER':provider,'FM_DISPATCH_MODEL':'local-fixture'})
        assert p.returncode==0 and '  status: error\n' in p.stdout and 'credential source unavailable for '+provider in p.stdout, p
    passed('Missing credential adapter produces sanitized structured error rather than off for either provider')
    otherhome=lab/'other-home'
    otherhome.mkdir()
    off(run('different effective home does not consume original declaration',extra={'FM_HOME':str(otherhome)}))
    otherconfig=lab/'other-config'
    otherconfig.mkdir()
    off(run('different effective config does not consume original declaration',extra={'FM_CONFIG_OVERRIDE':str(otherconfig)}))
    passed('Different effective home and config directory cannot consume the original declaration')
    # Materialize the prior resolver only in disposable scratch to reproduce
    # the recorded trailing-newline regression without changing the candidate.
    oldbin=lab/'old-bin'
    oldbin.mkdir()
    oldtool=oldbin/'fm-dispatch-resolve.sh'
    oldtool.write_bytes(subprocess.check_output(['git','show','4649545:bin/fm-dispatch-resolve.sh']))
    for name in ['fm-quota-axi-lib.sh','fm-control-lib.sh','fm-env-lib.sh','fm-timing-lib.sh','fm-brief-heading-lib.sh']:
        os.symlink(root/'bin'/name,oldbin/name)
    for provider in ['typesafe','openrouter']:
        sources.write_text(json.dumps({provider+'\n':{'type':'macos-keychain','service':'not-retrieved'}}))
        for args,mode in [(['--validate-credential-sources',str(sources)],'candidate'),(None,'runtime')]:
            p=run('previous revision '+provider+' trailing newline '+mode,args,{'FM_DISPATCH_PROVIDER':provider,'FM_DISPATCH_MODEL':'local-fixture'},oldtool)
            assert p.returncode==0, p
            if mode=='candidate':
                assert json.loads(p.stdout)=={'supported':False}, p
            else:
                off(p)
            report['before_fix'].append({'revision':'4649545','provider':provider,'mode':mode,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})
finally:
    shutil.rmtree(lab)
    report['scratch_removed']=not lab.exists()
    (evidence/'resolver-cli-transcript.json').write_text(json.dumps(report,indent=2)+'\n')
for scenario in report['scenarios']:
    print('PASS '+scenario['name'])
print('Trailing-newline defect reproduced on previous revision 4649545 for both provider IDs and both modes.')
print('Disposable files removed.')
