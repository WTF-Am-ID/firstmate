import argparse, json, os, pathlib, shutil, signal, subprocess, tempfile, time

parser = argparse.ArgumentParser()
parser.add_argument('--library', default='bin/fm-timeout-lib.sh')
parser.add_argument('--baseline', action='store_true')
args = parser.parse_args()
library = str(pathlib.Path(args.library).absolute())
query = r'''
use strict;
$SIG{$_} = 'IGNORE' for qw(INT HUP TERM);
my $dir = shift;
my $child = fork;
die 'fork failed' unless defined $child;
my $name = $child ? 'command' : 'descendant';
open my $f, '>', "$dir/$name" or die $!;
print $f "$$\n";
close $f;
if ($child) { print "query stdout\n"; $|=1; waitpid $child, 0; }
else { sleep 300; }
'''
caller = r'''
. "$1"
handler_signal=$4
case "$3" in
  exit) trap 'printf "handler %s\n" "$handler_signal"; exit 61' "$4" ;;
  return) trap 'printf "handler %s\n" "$handler_signal"' "$4" ;;
  ignore) trap '' INT HUP TERM ;;
esac
fm_run_timed "$5" perl -e "$6" "$2"
rc=$?
printf 'continued %s\n' "$rc"
exit "$rc"
'''

def exists(pid):
    try: os.kill(pid, 0); return True
    except ProcessLookupError: return False

def kill_owned(pid):
    if pid and abs(pid) > 1:
        try: os.kill(pid, signal.SIGKILL)
        except ProcessLookupError: pass

failures = []
with tempfile.TemporaryDirectory(prefix='.fm4405-live-', dir='.') as work:
    work = pathlib.Path(work).absolute()
    bindir = work / 'bin'
    bindir.mkdir()
    for name in ['perl', 'bash', 'sleep']:
        os.symlink(shutil.which(name), bindir / name)
    env = dict(os.environ, PATH=str(bindir))
    cases = [('INT', 'caller', 'default')] if args.baseline else [
        (sig, target, disposition)
        for sig in ['INT', 'HUP', 'TERM']
        for target in ['caller', 'group']
        for disposition in ['default', 'exit', 'return', 'ignore']
    ] + [('timeout', 'caller', 'default')]
    for sig, target, disposition in cases:
        directory = work / f'{sig}-{target}-{disposition}'
        directory.mkdir()
        proc = subprocess.Popen(['/bin/bash', '-c', caller, '_', library,
            str(directory), disposition, sig, '1' if sig == 'timeout' else '30', query],
            env=env, start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        owned = []
        result = dict(signal=sig, target=target, disposition=disposition)
        try:
            ready_by = time.monotonic() + 5
            for name in ['command', 'descendant']:
                path = directory / name
                while not path.exists() or not path.read_text().strip():
                    if time.monotonic() > ready_by: raise RuntimeError('query did not become ready')
                    time.sleep(.01)
                owned.append(int(path.read_text()))
            started = time.monotonic()
            if sig != 'timeout':
                os.kill(-proc.pid if target == 'group' else proc.pid, getattr(signal, 'SIG'+sig))
            out, err = proc.communicate(timeout=5)
            result.update(status=proc.returncode, elapsed_seconds=round(time.monotonic()-started,3), stdout=out.decode(), pipe_eof=True)
            end = time.monotonic() + 2
            while any(exists(pid) for pid in [*owned, -owned[0]]) and time.monotonic() < end:
                time.sleep(.01)
            result['owned_processes_or_group_alive'] = [pid for pid in [*owned, -owned[0]] if exists(pid)]
            number = getattr(signal, 'SIG'+sig) if sig != 'timeout' else None
            expected = 124 if sig == 'timeout' else 128+number
            if disposition == 'exit': expected = 61
            actual = 128-proc.returncode if proc.returncode < 0 else proc.returncode
            assert actual == expected, f'status {actual}, expected {expected}'
            output = 'query stdout\n'
            if disposition in ['exit','return']: output += f'handler {sig}\n'
            if disposition != 'default' or sig == 'timeout':
                if disposition != 'exit': output += f'continued {expected}\n'
            assert out.decode() == output, f'unexpected stdout {out!r}'
            assert not result['owned_processes_or_group_alive'], 'owned process/group survived'
            result['result'] = 'pass'
        except Exception as exc:
            result.update(result='fail', error=str(exc))
            if isinstance(exc, subprocess.TimeoutExpired):
                result.update(pipe_eof=False, elapsed_seconds=round(time.monotonic()-started,3))
            failures.append(result)
        finally:
            for pid in owned[:1]: kill_owned(-pid)
            for pid in owned: kill_owned(pid)
            kill_owned(-proc.pid)
            kill_owned(proc.pid)
            try: proc.communicate(timeout=2)
            except subprocess.TimeoutExpired: pass
        print(json.dumps(result), flush=True)
print(json.dumps(dict(library=library, baseline=args.baseline, failures=len(failures), fixtures_removed=True)))
raise SystemExit(1 if failures else 0)
