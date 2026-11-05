import live as lab
import json, shutil
from live import run, meta, env, SCRATCH, EVIDENCE, STATE, home, log, server, thread, requests
try:
    run('mint head and legacy lab',['bin/fm-lab-home.sh','create',str(home)])
    env.update(FM_HOME=str(home),GLAB_CONFIG_DIR=str(SCRATCH/'glab-config'),GITLAB_TOKEN='synthetic-local-only',GLAB_CHECK_UPDATE='false')
    lab.HEAD=run('read synthetic repository head',['git','-C',str(SCRATCH/'repo'),'rev-parse','HEAD']).stdout.strip()
    for forge,url in [('github','https://github.com/lab/project/pull/7'),('gitlab','https://gitlab.example/lab/project/-/merge_requests/7'),('forgejo','https://forge.example/lab/project/pulls/7')]:
        STATE.update(base='integration/release',state='OPEN',unreadable=False,retarget=False,merges=0)
        meta('expected_base=integration/release\nbase_branch=integration/release\n')
        run(f'{forge} matching named integration base registration',['bin/fm-pr-check.sh','task',url])
        run(f'{forge} moved head refuses merge',['bin/fm-pr-merge.sh','task',url,'--expected-head','b'*40],1)
        assert STATE['merges']==0
        log.append(f'{forge}: supplied old head refused; zero merge mutations.\n')
        for p in (home/'state').glob('task*'):
            if p.is_file(): p.unlink()
    STATE.update(base='main',state='OPEN')
    meta('')
    run('legacy default without destination proof refuses registration',['bin/fm-pr-check.sh','task','https://github.com/lab/project/pull/7'],1)
    meta('expected_base=main\n')
    run('legacy destination restored from authorized synthetic launch evidence registers',['bin/fm-pr-check.sh','task','https://github.com/lab/project/pull/7'])
finally:
    server.shutdown();server.server_close();thread.join()
    (EVIDENCE/'heads-legacy-live.log').write_text('\n'.join(log))
    (EVIDENCE/'heads-legacy-api-requests.json').write_text(json.dumps(requests,indent=2))
    if home.exists(): shutil.rmtree(home)
