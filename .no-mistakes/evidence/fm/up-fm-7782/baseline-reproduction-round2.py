import pathlib
path=pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615GR82CTFFPXAXTV2V7AC7/live-landing-round2.py')
code=path.read_text().split('\ntry:\n    scenario(')[0].replace("'live-landing-round2.log'", "'baseline-reproduction-round2.log'")
exec(compile(code,str(path),'exec'))
try:
    scenario('B1: Baseline lands Y after approval at X, reproducing the original defect',baseline)
finally:
    shutil.rmtree(SCRATCH); emit('CLEANUP removed '+str(SCRATCH))
    (EVIDENCE/'baseline-reproduction-round2-results.json').write_text(json.dumps(results,indent=2)+'\n'); LOG.close()
if any(r['result']=='fail' for r in results):raise SystemExit(1)
