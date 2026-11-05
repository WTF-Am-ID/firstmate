import os, sys, ssl, json, subprocess, threading, pathlib, http.server, shutil

ROOT = pathlib.Path.cwd()
SCRATCH = ROOT / '.validation-3103'
EVIDENCE = pathlib.Path('~/.no-mistakes-upstream-codex/evidence/01M6MWKH6MN5A6C7BJ2SC0KNQM')
HEAD = 'a' * 40
STATE = dict(base='main', state='OPEN', unreadable=False, retarget=False, merges=0)
requests = []
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(SCRATCH/'cert.pem', SCRATCH/'key.pem')

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_CONNECT(self):
        self.send_response(200); self.end_headers()
        self.connection = ctx.wrap_socket(self.connection, server_side=True)
        self.rfile = self.connection.makefile('rb')
        self.wfile = self.connection.makefile('wb')
        self.close_connection = True
        self.handle_one_request()
    def respond(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Connection','close')
        self.end_headers(); self.wfile.write(data)
    def do_GET(self): self.route()
    def do_POST(self): self.route()
    def do_PUT(self): self.route()
    def route(self):
        body = self.rfile.read(int(self.headers.get('Content-Length',0)))
        try: payload=json.loads(body) if body else {}
        except ValueError: payload={}
        query=payload.get('query','')
        requests.append(dict(method=self.command,path=self.path,query=query,variables=payload.get('variables',{})))
        if STATE['unreadable']:
            return self.respond({'message':'synthetic forge unavailable'},503)
        pr = dict(id='PR_local',number=7,title='Synthetic destination check',url='https://github.com/lab/project/pull/7',
                  state=STATE['state'],baseRefName=STATE['base'],headRefOid=HEAD,headRefName='fm/lab',
                  isDraft=False,mergeable='MERGEABLE',mergeStateStatus='CLEAN',reviewDecision='APPROVED',
                  merged=STATE['state']=='MERGED',mergedAt='2026-11-04T00:00:00Z' if STATE['state']=='MERGED' else None,
                  author={'login':'lab'},statusCheckRollup={'nodes':[{'commit':{'statusCheckRollup':{'contexts':{'nodes':[{'__typename':'CheckRun','name':'ci','status':'COMPLETED','conclusion':'SUCCESS'}]}}}}]},
                  commits={'nodes':[{'commit':{'oid':HEAD,'statusCheckRollup':{'contexts':{'nodes':[]}}}}]},
                  baseRepository={'id':'R_local','name':'project','nameWithOwner':'lab/project','owner':{'login':'lab'}},
                  headRepository={'id':'R_local','name':'project','nameWithOwner':'lab/project','owner':{'login':'lab'}},isCrossRepository=False,
                  autoMergeRequest=None,mergeQueueEntry=None,isInMergeQueue=False)
        repo=dict(id='R_local',name='project',nameWithOwner='lab/project',owner={'login':'lab'},
                  defaultBranchRef={'name':'main'},viewerPermission='WRITE',mergeCommitAllowed=True,
                  squashMergeAllowed=True,rebaseMergeAllowed=True,pullRequest=pr)
        if 'query PullRequest_fields2' in query:
            return self.respond({'data':{'WorkflowRun':{'fields':[{'name':'workflow'}]}}})
        if 'query PullRequest_fields' in query:
            return self.respond({'data':{'PullRequest':{'fields':[{'name':'isInMergeQueue'}]},'StatusCheckRollupContextConnection':{'fields':[{'name':'nodes'}]}}})
        if 'mergePullRequest' in query:
            STATE['merges'] += 1; STATE['state']='MERGED'; pr['state']='MERGED'; pr['merged']=True
            return self.respond({'data':{'mergePullRequest':{'clientMutationId':None}}})
        if 'graphql' in self.path:
            response={'data':{'repository':repo,'viewer':{'login':'lab'}}}
            if STATE['retarget'] and 'statusCheckRollup' in query:
                STATE['base']='other'
            return self.respond(response)
        if '/api/v4/' in self.path:
            if self.path.endswith('/merge') and self.command=='PUT':
                STATE['merges']+=1; STATE['state']='MERGED'
            mr=dict(id=7,iid=7,project_id=1,title='Synthetic destination check',description='',
                    state='merged' if STATE['state']=='MERGED' else 'opened',target_branch=STATE['base'],source_branch='fm/lab',
                    web_url='https://gitlab.example/lab/project/-/merge_requests/7',sha=HEAD,draft=False,work_in_progress=False,
                    merge_status='can_be_merged',detailed_merge_status='mergeable',has_conflicts=False,
                    blocking_discussions_resolved=True,head_pipeline={'id':1,'sha':HEAD,'status':'success'},
                    author={'id':1,'username':'lab','name':'Lab'},user={'can_merge':True},labels=[],assignees=[],reviewers=[])
            if STATE['retarget'] and '/merge_requests/7' in self.path and self.command=='GET':
                STATE['retarget_reads']=STATE.get('retarget_reads',0)+1
                if STATE['retarget_reads']==3: STATE['base']='other'
            if '/merge_requests/' in self.path: return self.respond(mr)
            return self.respond({'id':1,'name':'project','path_with_namespace':'lab/project','web_url':'https://gitlab.example/lab/project','default_branch':'main'})
        if '/api/v1/' in self.path:
            if self.path.endswith('/merge') and self.command=='POST':
                STATE['merges']+=1; STATE['state']='MERGED'; return self.respond({},200)
            if '/status' in self.path: return self.respond({'state':'success','sha':HEAD,'total_count':1,'statuses':[] if 'page=2' in self.path else [{'id':1,'context':'ci','status':'success','state':'success'}]})
            if '/pulls/' in self.path:
                result=dict(id=7,number=7,state='open' if STATE['state']=='OPEN' else 'closed',merged=STATE['state']=='MERGED',
                            base={'ref':STATE['base']},head={'sha':HEAD},draft=False,mergeable=True,user={'login':'lab'},title='Synthetic destination check')
                if STATE['retarget']:
                    STATE['retarget_reads']=STATE.get('retarget_reads',0)+1
                    if STATE['retarget_reads']==3: STATE['base']='other'
                return self.respond(result)
            return self.respond({'id':1,'name':'project','full_name':'lab/project','default_branch':'main','default_merge_style':'squash','login':'lab','username':'lab'})
        if '/rules/branches/' in self.path: return self.respond([])
        if '/branches/' in self.path: return self.respond({'name':'main','protected':False})
        if '/check-runs' in self.path: return self.respond({'total_count':0,'check_runs':[]})
        if '/statuses' in self.path or '/reviews' in self.path or '/comments' in self.path: return self.respond([])
        if '/pulls/' in self.path:
            return self.respond(dict(state=STATE['state'].lower(),draft=False,merged=STATE['state']=='MERGED',
                                     base={'ref':STATE['base']},head={'sha':HEAD},user={'login':'lab'},mergeable=True,merged_at=pr['mergedAt']))
        return self.respond({'permissions':{'push':True},'default_branch':'main','name':'project','owner':{'login':'lab'}})

server = http.server.ThreadingHTTPServer(('127.0.0.1',0), Handler)
thread = threading.Thread(target=server.serve_forever)
thread.start()
env = {k:v for k,v in os.environ.items() if k not in ('FM_HOME','FM_ROOT_OVERRIDE','FM_STATE_OVERRIDE','FM_DATA_OVERRIDE','FM_CONFIG_OVERRIDE','FM_PROJECTS_OVERRIDE','FM_GATE_REFUSE_BYPASS','GH_HOST','GH_TOKEN','GH_ENTERPRISE_TOKEN','GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE')}
env.update(GH_TOKEN='synthetic-local-only',GH_ENTERPRISE_TOKEN='synthetic-local-only',GH_CONFIG_DIR=str(SCRATCH/'gh-config'),
           XDG_CONFIG_HOME=str(SCRATCH/'xdg-config'), XDG_CACHE_HOME=str(SCRATCH/'xdg-cache'), GH_PROMPT_DISABLED='1', GH_NO_UPDATE_NOTIFIER='1', GH_TELEMETRY='0',
           HTTPS_PROXY=f'http://127.0.0.1:{server.server_port}',HTTP_PROXY=f'http://127.0.0.1:{server.server_port}',NO_PROXY='',
           SSL_CERT_FILE=str(SCRATCH/'cert.pem'), GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1',
           TMPDIR=str(SCRATCH/'tmp'),PATH=str(SCRATCH/'tools')+':'+os.environ['PATH'])
home=SCRATCH/'live-home'
log=[]
def run(name, args, expected=0, **kw):
    result=subprocess.run(args,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=90,**kw)
    entry=f'CASE {name}\nCOMMAND {" ".join(args)}\nEXIT {result.returncode}\n{result.stdout}\n'
    log.append(entry); print(entry,flush=True)
    if expected is not None and result.returncode != expected: raise RuntimeError(f'{name}: expected exit {expected}')
    return result
def meta(text):
    (home/'state/task.meta').write_text(f'kind=ship\nmode=no-mistakes\nworktree={SCRATCH}/repo\nproject={SCRATCH}/repo\nbranch=fm/lab\n'+text)
def ready(name, expected):
    return run(name,['bash','-c', '. bin/fm-dod-lib.sh; fm_dod_accept_ship_done ship no-mistakes "$1" "$1" "done: PR https://github.com/lab/project/pull/7 checks green" "$2/state" task "$2/state/task.meta"', 'bash',str(SCRATCH/'repo'),str(home)],expected)

if __name__ == '__main__':
    try:
        run('mint isolated lab',['bin/fm-lab-home.sh','create',str(home)])
        env['FM_HOME']=str(home)
        (SCRATCH/'repo').mkdir(exist_ok=True)
        run('initialize synthetic task repository',['git','-C',str(SCRATCH/'repo'),'init','-q','-b','fm/lab'])
        run('real gh reads local GraphQL',['gh','pr','view','https://github.com/lab/project/pull/7','--json','baseRefName,headRefOid','-q','[.baseRefName,.headRefOid] | @tsv'])
        meta('expected_base=main\n')
        run('matching registration',['bin/fm-pr-check.sh','task','https://github.com/lab/project/pull/7'])
        log.append('PERSISTED TASK METADATA\n'+(home/'state/task.meta').read_text())
        ready('matching readiness',0)
        STATE['base']='other'
        ready('retargeted readiness',1)
        run('mismatching registration',['bin/fm-pr-check.sh','task','https://github.com/lab/project/pull/7'],1)
        STATE['state']='MERGED'
        out=run('wrong destination merged poll remains silent',['bash',str(home/'state/task.check.sh')])
        assert not out.stdout.strip()
        STATE['base']='main'
        out=run('matching merged poll emits merged',['bash',str(home/'state/task.check.sh')])
        assert out.stdout.strip()=='merged'
        STATE['state']='OPEN'
        STATE['unreadable']=True
        ready('unreadable forge readiness',1)
        run('unreadable forge registration',['bin/fm-pr-check.sh','task','https://github.com/lab/project/pull/7'],1)
        STATE['unreadable']=False; STATE['base']=''
        ready('absent actual base readiness',1)
        STATE['base']='main'; meta('')
        ready('missing task destination',1)
        meta('base_branch=main\n')
        run('legacy named base registration',['bin/fm-pr-check.sh','task','https://github.com/lab/project/pull/7'])
        meta('expected_base=main\nexpected_base=main\n')
        ready('duplicate expected destination',1)
        meta('expected_base=main\nbase_branch=other\n')
        ready('conflicting destination metadata',1)
        meta('expected_base=main\n')
        STATE['retarget']=True
        run('retarget during merge verification',['bin/fm-pr-merge.sh','task','https://github.com/lab/project/pull/7'],1)
        assert STATE['base']=='other', 'retarget trigger was never reached'
        assert STATE['merges']==0, 'wrong base reached forge mutation'
        log.append('RETARGET ASSERTION: forge changed destination during verification; zero merge mutations observed.\n')
        STATE['base']='main'; STATE['retarget']=False
        run('matching destination merge',['bin/fm-pr-merge.sh','task','https://github.com/lab/project/pull/7'])
        assert STATE['merges']==1, 'matching destination did not reach forge mutation'
    finally:
        server.shutdown(); server.server_close(); thread.join()
        (EVIDENCE/'github-live.log').write_text('\n'.join(log))
        (EVIDENCE/'github-api-requests.json').write_text(json.dumps(requests,indent=2))
        if home.exists(): shutil.rmtree(home)
