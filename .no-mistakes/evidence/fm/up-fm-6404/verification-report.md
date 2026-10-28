# Issue 6404 focused verification

Candidate: `d85b4d839c3fadadc2df30cb26c047baf41e9e2c`. Baseline fixture: `417cec2feb4e2976c0acdb2527b87b3ccc71535f`.

The candidate changes only the test. No permanent source or test edits were made during this phase. No LLM, fleet, or Herdr lifecycle was invoked.

## Real reader checks

`bash -x bin/fm-remote-delta-read.sh state/replies.status 11 <original-prefix-sha256> 10` ran against a private home inside the worktree with the real stat, shasum, Perl snapshot, and filesystem. Trace output synchronized the writer after the first unchanged snapshot. The reader was suspended during a real 0.5-second truncate-before-write gap, then resumed after writing and moving mtime forward two seconds. No dependency shims were used for these checks.

- Same device, same inode, size 11: output `reason=prefix-changed`, `to_offset=11`, and the SHA-256 of `OMEGA\nbeta\n`.
- Genuine shrink to size 2: output `reason=truncated`, `to_offset=2`, and the SHA-256 of the remaining bytes.

See `live-reader.json` for actual identities, timestamps, exit statuses and complete product responses. Trace logs retain the execution details.

## Focused fixture checks

`TMPDIR="$PWD/.test-6404/tmp" bash bin/fm-test-run.sh tests/fm-remote-delta-read.test.sh` passed three times. Each run covered the later-epoch rewrite, unchanged same-second fractional-stat regression, device/inode/size assertion, rewritten offset/hash, and surrounding delta-reader cases.

The exported Bash printf delay reproduced the baseline fixture's truncate-before-write failure: exit 1, `reason=truncated`, `to_offset=0`. The same command on the candidate passed. This reproduces the remaining writer gap, not the previously fixed same-ctime race.

The fixture's synthetic stat/hash boundaries make these focused and mutation checks controlled regression evidence rather than additional unshimmed live scenarios.

## Mutation checks

Disposable copies used the candidate runner and dependencies. Both mutations exited 1 at `not ok - the rewritten read did not exit 0` after the preceding four cases passed:

- Prefix-integrity comparison replaced with `if false; then`.
- Both timestamps removed from the poll identity key while retaining size, inode and device.

These failures are expected mutation kills. They are not candidate failures. Complete commands, elapsed times, exit statuses and expected statuses are recorded in `verification-runs.json`. Reproduction driver: `verification-driver.py`. To reproduce from the repository root, first create `.test-6404/tmp` and run `python3 <path-to-verification-driver.py>`. The driver creates disposable copies under `.test-6404`, which must be removed afterwards.

No lint, static analysis, full suite, publication, or other pipeline phase ran. CLI-only change: visual evidence is inapplicable. All disposable copies and private test data were removed after recording evidence.
