import live as lab
import os, subprocess, json, time, pathlib, shutil
from live import run, meta, env, SCRATCH, EVIDENCE, STATE, home, log, server, thread, requests

node=None
try:
    run('mint multi-forge lab',['bin/fm-lab-home.sh','create',str(home)])
    env['FM_HOME']=str(home)
    env['XDG_CONFIG_HOME']=str(SCRATCH/'xdg-config')
    env['GLAB_CONFIG_DIR']=str(SCRATCH/'glab-config')
    env['GITLAB_TOKEN']='synthetic-local-only'
    env['GLAB_CHECK_UPDATE']='false'
    env['GITLAB_CA_CERT_FILE']=str(SCRATCH/'cert.pem')
    run('configure isolated emulator CA',['glab','config','set','ca_cert',str(SCRATCH/'cert.pem'),'--host','gitlab.example'])
    run('real glab reads local MR',['glab','mr','view','7','-R','https://gitlab.example/lab/project','-F','json'])
    run('commit synthetic task content',['git','-C',str(SCRATCH/'repo'),'-c','user.name=Lab','-c','user.email=lab@example.invalid','commit','--allow-empty','-qm','synthetic'])
    lab.HEAD=run('read synthetic HEAD',['git','-C',str(SCRATCH/'repo'),'rev-parse','HEAD']).stdout.strip()
    run('record synthetic published branch',['git','-C',str(SCRATCH/'repo'),'update-ref','refs/remotes/origin/main',lab.HEAD])
    tea_config=SCRATCH/'xdg-config/tea'
    tea_config.mkdir(parents=True,exist_ok=True)
    (tea_config/'config.yml').write_text('logins:\n- name: local-forge\n  url: https://forge.example\n  token: synthetic-local-only\n  default: true\n  user: lab\n  version_check: false\n  insecure: true\n')
    run('real tea reads isolated synthetic login',['tea','login','list','--output','json'])
    for forge,url in [('gitlab','https://gitlab.example/lab/project/-/merge_requests/7'),('forgejo','https://forge.example/lab/project/pulls/7')]:
        STATE.update(base='main',state='OPEN',unreadable=False,retarget=False,merges=0)
        meta('expected_base=main\n')
        run(f'{forge} matching registration',['bin/fm-pr-check.sh','task',url])
        for base in ['other','']:
            STATE['base']=base
            run(f'{forge} {base or "absent"} base refuses registration',['bin/fm-pr-check.sh','task',url],1)
            run(f'{forge} {base or "absent"} base refuses merge',['bin/fm-pr-merge.sh','task',url],1)
            assert STATE['merges']==0
        STATE.update(base='main',state='MERGED')
        out=run(f'{forge} matching merged poll',['bash',str(home/'state/task.check.sh')])
        assert out.stdout.strip()=='merged'
        STATE['base']='other'
        out=run(f'{forge} retargeted merged poll silent',['bash',str(home/'state/task.check.sh')])
        assert not out.stdout.strip()
        STATE.update(base='main',state='OPEN',unreadable=True)
        run(f'{forge} unreadable base refuses registration',['bin/fm-pr-check.sh','task',url],1)
        STATE['unreadable']=False
        STATE['retarget']=True; STATE['retarget_reads']=0
        run(f'{forge} retarget after readiness refuses merge',['bin/fm-pr-merge.sh','task',url],1)
        assert STATE['merges']==0
        STATE.update(base='main',retarget=False)
        run(f'{forge} matching destination merge',['bin/fm-pr-merge.sh','task',url])
        assert STATE['merges']==1
        for path in (home/'state').glob('task*'):
            if path.is_file(): path.unlink()

    # A real SSH client and real gerrit-axi consume raw Gerrit query records.
    row=dict(project='lab/project',branch='main',number=7,id='I'+'1'*40,subject='Synthetic change',
             status='NEW',url='https://review.local/c/lab/project/+/7',wip=False,
             currentPatchSet={'number':1,'revision':lab.HEAD,'ref':'refs/changes/07/7/1','approvals':[]},
             submitRecords=[{'status':'OK','labels':[]}])
    def write_row(): (SCRATCH/'gerrit-row.json').write_text(json.dumps(row))
    write_row()
    node=subprocess.Popen(['node',str(SCRATCH/'gerrit-server.cjs'),str(SCRATCH)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env)
    for _ in range(100):
        if (SCRATCH/'ssh-port').exists(): break
        if node.poll() is not None: raise RuntimeError(node.stdout.read().decode())
        time.sleep(.05)
    port=(SCRATCH/'ssh-port').read_text()
    config=SCRATCH/'ssh-config'
    config.write_text(f'Host *\n  HostName 127.0.0.1\n  StrictHostKeyChecking no\n  UserKnownHostsFile {SCRATCH}/known-hosts\n  GlobalKnownHostsFile /dev/null\n  IdentityAgent none\n  IdentitiesOnly yes\n  LogLevel ERROR\n')
    wrapper=SCRATCH/'tools/ssh'
    wrapper.write_text(f'#!/bin/sh\nexec /usr/bin/ssh -F "{config}" "$@"\n');wrapper.chmod(0o755)
    env.update(GERRIT_USER='lab',GERRIT_PORT=port)
    run('real gerrit-axi detail includes branch',['gerrit-axi','show','7','--host','review.local','--json'])
    url='https://review.local/c/lab/project/+/7'
    meta('expected_base=main\n')
    p=home/'state/task.meta';p.write_text(p.read_text().replace('mode=no-mistakes','mode=direct-PR'))
    run('gerrit matching registration',['bin/fm-pr-check.sh','task',url])
    row['status']='MERGED';write_row()
    out=run('gerrit matching merged poll',['bash',str(home/'state/task.check.sh')]);assert out.stdout.strip()=='merged'
    row['branch']='other';write_row()
    out=run('gerrit retargeted merged poll silent',['bash',str(home/'state/task.check.sh')]);assert not out.stdout.strip()
    run('gerrit wrong destination registration refused',['bin/fm-pr-check.sh','task',url],1)
    row.pop('branch');write_row()
    run('gerrit missing destination refused',['bin/fm-pr-check.sh','task',url],1)
    run('gerrit submit remains refused',['bin/fm-pr-merge.sh','task',url],2)
finally:
    if node:
        node.terminate(); node.wait(timeout=10)
    server.shutdown();server.server_close();thread.join()
    (EVIDENCE/'other-forges-live.log').write_text('\n'.join(log))
    (EVIDENCE/'other-forges-api-requests.json').write_text(json.dumps(requests,indent=2))
    if (SCRATCH/'ssh-requests.log').exists(): shutil.copyfile(SCRATCH/'ssh-requests.log',EVIDENCE/'gerrit-ssh-requests.log')
    if home.exists(): shutil.rmtree(home)
