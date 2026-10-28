from pathlib import Path
import os, json, shutil, subprocess
root=Path.cwd()
scratch=root/'.fm-test-local'
evidence=Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M60Y09K42DWX8883NDZVJ1N7')
base='3fbace9fa861a3a304e1ab6fbf10d019218218ee'
fixture=r'''#!/usr/bin/env bash
set -eu
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cleanup_root=$(fm_test_tmproot fm-test-run-live-cleanup)
printf '%s\n' "$cleanup_root" >"$PROBE_STATE/cleanup-root"
case $PROBE_CLEANUP in
 direct) trap fm_test_cleanup EXIT ;;
 delegated)
  suite_cleanup() {
    printf '%s\n' "$?" >"$PROBE_STATE/cleanup-status"
    printf 'suite-owned cleanup ran\n' >>"$PROBE_STATE/cleanup-calls"
    fm_test_cleanup
  }
  trap suite_cleanup EXIT ;;
esac
test_A() { printf 'A\n' >>"$PROBE_STATE/executed"; pass A; }
test_B() {
 printf 'B\n' >>"$PROBE_STATE/executed"
 case $PROBE_MODE in
  fail) fail B ;;
  errexit) false ;;
  exit) exit 7 ;;
  cleanup) fm_test_cleanup ;;
  subshell) subrc=0; (exit 9) || subrc=$?; [ "$subrc" -eq 9 ] ;;
 esac
 pass B
}
test_C() { printf 'C\n' >>"$PROBE_STATE/executed"; pass C; }
test_D() {
 printf 'D\n' >>"$PROBE_STATE/executed"
 [ "$PROBE_MODE" != last ] || fail D
 pass D
}
fm_test_run test_A test_B test_C test_D
'''
for revision in ('baseline','candidate'):
 repo=scratch/revision
 for file in ('bin/fm-test-run.sh','tests/lib.sh','tests/git-config-helpers.sh'):
  destination=repo/file
  destination.parent.mkdir(parents=True,exist_ok=True)
  data=(root/file).read_bytes() if revision=='candidate' else subprocess.check_output(['git','show',f'{base}:{file}'])
  destination.write_bytes(data)
  if file.startswith('bin/'): destination.chmod(0o755)
 for dependency in ('bin/fm-wake-lib.sh','bin/fm-path-lib.sh'):
  (repo/dependency).write_bytes((root/dependency).read_bytes())
 (repo/'tests/fm-brief.test.sh').write_text(fixture)
cases=[('delegated',m) for m in ('exit','fail','errexit','last','cleanup','green','subshell')]+[('direct','exit'),('default','exit')]
results=[]
for revision in ('baseline','candidate'):
 selected=[('delegated','exit'),('default','fail')] if revision=='baseline' else cases
 for cleanup,mode in selected:
  for jobs in ((1,) if revision=='baseline' else (1,2)):
   key=f'{revision}-{cleanup}-{mode}-jobs{jobs}'
   state=scratch/key
   state.mkdir(exist_ok=True)
   env=os.environ.copy()
   env.update(TMPDIR=str(scratch/'tmp'),FM_TEST_SKIP_ORPHAN_REAP='1',PROBE_STATE=str(state),PROBE_MODE=mode,PROBE_CLEANUP=cleanup)
   timing=evidence/f'{key}.json'
   command=['bash',str(scratch/revision/'bin/fm-test-run.sh'),'--jobs',str(jobs),'--json',str(timing),'tests/fm-brief.test.sh']
   run=subprocess.run(command,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=90)
   (evidence/f'{key}.log').write_text(run.stdout)
   doc=json.loads(timing.read_text()); record,=doc['scripts']
   executed=(state/'executed').read_text().splitlines()
   is_early=mode in ('exit','fail','errexit')
   failed='test_B' if is_early else ('test_D' if mode=='last' else '')
   pending=['test_C','test_D'] if is_early else []
   expected_exit=7 if mode=='exit' else (1 if failed else 0)
   cleaned=not Path((state/'cleanup-root').read_text().strip()).exists()
   end,=[line for line in run.stdout.splitlines() if line.startswith('FM_TEST_END ')]
   errors=[]
   if record['exit']!=expected_exit: errors.append(f'child exit: {record["exit"]} != {expected_exit}')
   if run.returncode!=int(bool(failed)): errors.append(f'runner exit: {run.returncode}')
   if executed!=(['A','B'] if is_early else ['A','B','C','D']): errors.append(f'executed {executed}')
   if not cleaned: errors.append('fixture cleanup did not remove registered root')
   if cleanup=='delegated':
    status=int((state/'cleanup-status').read_text())
    if status!=expected_exit: errors.append(f'cleanup exit status {status} != {expected_exit}')
   expected_marker=f'FM_TEST_ABORT failed={failed} skipped_after_failure={len(pending)} unexecuted={",".join(pending)}'
   if failed and expected_marker not in run.stdout: errors.append('console abort details missing')
   if not failed and 'FM_TEST_ABORT ' in run.stdout: errors.append('false suite abort reported')
   if record.get('failed_invocation')!=failed: errors.append('JSON failed_invocation mismatch')
   if record.get('unexecuted_invocations')!=pending: errors.append('JSON unexecuted_invocations mismatch')
   if record.get('skipped_after_failure')!=len(pending): errors.append('JSON skipped_after_failure mismatch')
   if failed and f'failed_invocation={failed} skipped_after_failure={len(pending)} unexecuted={",".join(pending)}' not in end: errors.append('FM_TEST_END abort details missing')
   if not failed and ('FM_TEST_COMPLETE' not in run.stdout or 'unexecuted=' in end): errors.append('success completion contract mismatch')
   result=dict(case=key,command=command,runner_exit=run.returncode,suite_exit=record['exit'],executed=executed,cleanup_removed_root=cleaned,errors=errors,console=evidence.joinpath(f'{key}.log').name,timing=timing.name)
   results.append(result)
   print(json.dumps(result),flush=True)
(evidence/'live-results.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(not item['errors'] for item in results if item['case'].startswith('candidate')), 'candidate scenario failure'
assert all(item['errors'] for item in results if item['case'].startswith('baseline')), 'baseline unexpectedly satisfies reporting contract'
