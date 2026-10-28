import os, pathlib, shutil, subprocess, json, hashlib, signal, time, select
root = pathlib.Path.cwd()
scratch = root / '.test-6404'
evidence = pathlib.Path('/Users/daddy/.no-mistakes-upstream-codex/evidence/01M615WTZE3WNR5PSRP781NQD7')
env = os.environ.copy()
env['TMPDIR'] = str(scratch / 'tmp')
records = []
def run(label, command, cwd=root, expected=0):
    t = time.monotonic()
    p = subprocess.run(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    text = '$ ' + ' '.join(command) + '\n' + p.stdout + f'\nexit={p.returncode}\n'
    (evidence / (label + '.log')).write_text(text)
    records.append(dict(label=label, exit=p.returncode, expected=expected, elapsed=round(time.monotonic()-t, 3), command=command))
    print(label, 'exit', p.returncode, 'expected', expected, flush=True)
    assert p.returncode == expected, text

def fixture(name):
    dest = scratch / name
    shutil.copytree(root / 'bin', dest / 'bin')
    (dest / 'tests').mkdir()
    for file in ['lib.sh', 'git-config-helpers.sh', 'fm-remote-delta-read.test.sh']:
        shutil.copy2(root / 'tests' / file, dest / 'tests' / file)
    return dest

# The product executable and normal stat/hash programs run without shims.
# Trace the executable only to synchronize after its first unchanged snapshot.
home = scratch / 'live-home'
(home / 'state').mkdir(parents=True)
log = home / 'state' / 'replies.status'
original = b'alpha\nbeta\n'
replacement = b'OMEGA\nbeta\n'
prefix = hashlib.sha256(original).hexdigest()
live = []
for label, payload in [('later-epoch-rewrite', replacement), ('actual-truncation', b'a\n')]:
    log.write_bytes(original)
    before = log.stat()
    reader_env = env.copy()
    reader_env.update(FM_HOME=str(home), FM_REMOTE_DELTA_POLL_SECONDS='0.05')
    process = subprocess.Popen(['bash', '-x', str(root / 'bin/fm-remote-delta-read.sh'), 'state/replies.status', '11', prefix, '10'], env=reader_env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    trace = bytearray()
    deadline = time.monotonic() + 10
    while b'+ sleep 0.05\n' not in trace:
        assert time.monotonic() < deadline, 'reader failed to reach unchanged wait'
        readable, _, _ = select.select([process.stderr], [], [], .1)
        if readable:
            chunk = os.read(process.stderr.fileno(), 65536)
            assert chunk, bytes(trace).decode()
            trace.extend(chunk)
    # At this point the initial prefix check has finished. Suspend the reader
    # while a real in-place writer holds the file truncated before writing.
    os.kill(process.pid, signal.SIGSTOP)
    try:
        with log.open('wb') as stream:
            time.sleep(.5)
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        after = log.stat()
        os.utime(log, ns=(after.st_atime_ns, before.st_mtime_ns + 2_000_000_000))
        after = log.stat()
    finally:
        os.kill(process.pid, signal.SIGCONT)
    stdout, stderr = process.communicate(timeout=15)
    trace.extend(stderr)
    output = stdout.decode()
    expected_reason = 'prefix-changed' if label == 'later-epoch-rewrite' else 'truncated'
    assert process.returncode == 0, output
    assert 'reason=' + expected_reason + '\n' in output, output
    assert f'to_offset={len(payload)}\n' in output, output
    assert 'to_prefix_sha256=' + hashlib.sha256(payload).hexdigest() + '\n' in output, output
    assert (before.st_dev, before.st_ino) == (after.st_dev, after.st_ino)
    if label == 'later-epoch-rewrite':
        assert before.st_size == after.st_size == 11
    item = dict(scenario=label, before=dict(device=before.st_dev, inode=before.st_ino, size=before.st_size, mtime_ns=before.st_mtime_ns), after=dict(device=after.st_dev, inode=after.st_ino, size=after.st_size, mtime_ns=after.st_mtime_ns), exit=process.returncode, stdout=output)
    live.append(item)
    (evidence / (label + '-trace.log')).write_bytes(trace)
(evidence / 'live-reader.json').write_text(json.dumps(live, indent=2) + '\n')
print('live unshimmed rewrite/truncation passed', flush=True)

for i in [2, 3]:
    run('focused-' + str(i), ['bash', 'bin/fm-test-run.sh', 'tests/fm-remote-delta-read.test.sh'])

delayed = r'''printf() { if [ "$1" = "OMEGA\nbeta\n" ]; then sleep 0.5; fi; builtin printf "$@"; }; export -f printf; bash bin/fm-test-run.sh tests/fm-remote-delta-read.test.sh'''
# Shell quotes above are literal Python raw content. No secrets or shell
# interpolation are involved in these authored fixed commands.
run('candidate-delayed-write', ['bash', '-c', delayed])
base = fixture('baseline')
(base / 'tests/fm-remote-delta-read.test.sh').write_bytes(subprocess.check_output(['git', 'show', '417cec2feb4e2976c0acdb2527b87b3ccc71535f:tests/fm-remote-delta-read.test.sh'], cwd=root))
run('baseline-delayed-write', ['bash', '-c', delayed], cwd=base, expected=1)
assert 'reason=truncated' in (evidence / 'baseline-delayed-write.log').read_text()

mutated = fixture('mutation-prefix')
reader = mutated / 'bin/fm-remote-delta-read.sh'
source = reader.read_text()
needle = 'if [ "$ACTUAL" != "$PREFIX" ]; then'
assert source.count(needle) == 1
reader.write_text(source.replace(needle, 'if false; then'))
run('mutation-prefix', ['bash', 'bin/fm-test-run.sh', 'tests/fm-remote-delta-read.test.sh'], cwd=mutated, expected=1)
assert 'not ok - the rewritten read did not exit 0' in (evidence / 'mutation-prefix.log').read_text()

mutated_stat = fixture('mutation-stat')
reader = mutated_stat / 'bin/fm-remote-delta-read.sh'
source = reader.read_text()
needle = 'delta_subsecond "$mtime" && delta_subsecond "$ctime" || KEY='
assert source.count(needle) == 1
# Simulate loss of both timestamp fields from the identity key. Keep the
# real device, inode, size fields, so growth/truncation behavior is unchanged.
reader.write_text(source.replace(needle, needle + '\n  KEY="${KEY%%:*}:${rest#*:}"'))
run('mutation-stat', ['bash', 'bin/fm-test-run.sh', 'tests/fm-remote-delta-read.test.sh'], cwd=mutated_stat, expected=1)
assert 'not ok - the rewritten read did not exit 0' in (evidence / 'mutation-stat.log').read_text()
(evidence / 'verification-runs.json').write_text(json.dumps(records, indent=2) + '\n')
print('all planned verification complete', flush=True)
