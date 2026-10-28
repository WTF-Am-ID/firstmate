# Issue 6548 live product evidence

Candidate: `537bb44784c73d5cb2772d344c15b275bb950558`.

The real extension host and process-event CLI ran against disposable homes and a trusted fixture adapter. Each failure was injected before adapter entry. No agent harness, fleet session, credentials, or remote host was used.

Commands:

```text
FM_TEST_SKIP_ORPHAN_REAP=1 bash bin/fm-test-run.sh --jobs 1 tests/fm-procevent-extension-errors.test.sh
FM_TEST_SKIP_ORPHAN_REAP=1 bash bin/fm-test-run.sh --jobs 1 tests/fm-extension-binding.test.sh
```

The closure test asserts one unhandled result after each of two starts and three reconciles, no adapter entry during host failures, initial wake visibility, restored polling despite unhandled evidence, and distinct changed errors. It also exercises identical genuine results, first host-error visibility despite identical genuine bytes, and fresh evidence after explicit handling.

## Captured CLI output and durable evidence

### package

`host-error-package/1.out`

```text
not-autohandled: host-error-package (left for the handler; still unacknowledged)
captured: ./host-error-package.1.result
```

`host-error-package/2.out`

```text
no-result: host-error-package (exit 0)
```

`host-error-package/3.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-package/4.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-package/5.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-package/changed.out`

```text
not-autohandled: host-error-package (left for the handler; still unacknowledged)
captured: ./host-error-package.2.result
```

`host-error-package/healthy.out`

```text
no-result: host-error-package (exit 0)
```

`host-error-package/home/state/extensions/org.example.package/request-ids`

```text
sha256:660d0dd68cf24fdc379d6fdfcb0e89a6a11b3ce7e9e17addf517ad4af5288ba3
sha256:f783a1937b3e29c4bb87b0c0cbdf34439b10a9cc7fb6b77d5af68b0c9cd3273a
```

`host-error-package/home/state/procevent-inbox/host-error-package.1.result`

```text
{"code":"package-missing","extension_id":"org.example.package","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`host-error-package/home/state/procevent-inbox/host-error-package.2.result`

```text
{"code":"adapter-unbound","extension_id":"org.example.package","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`host-error-package/recovery.out`

```text
no-result: host-error-package (exit 0)
```

### conflict

`host-error-conflict/1.out`

```text
not-autohandled: host-error-conflict (left for the handler; still unacknowledged)
captured: ./host-error-conflict.1.result
```

`host-error-conflict/2.out`

```text
no-result: host-error-conflict (exit 0)
```

`host-error-conflict/3.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-conflict/4.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-conflict/5.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-conflict/changed.out`

```text
not-autohandled: host-error-conflict (left for the handler; still unacknowledged)
captured: ./host-error-conflict.2.result
```

`host-error-conflict/healthy.out`

```text
no-result: host-error-conflict (exit 0)
```

`host-error-conflict/home/state/extensions/org.example.conflict/request-ids`

```text
sha256:1daa589d296e702d66f09622a311d40ce10dab2fa89c2494baae4d1bddcfc734
sha256:58e68d94cddb40dcfe6694de4bead8c54223ce6300449d02c22d4617dffd652e
```

`host-error-conflict/home/state/procevent-inbox/host-error-conflict.1.result`

```text
{"code":"adapter-conflict","extension_id":"org.example.conflict","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`host-error-conflict/home/state/procevent-inbox/host-error-conflict.2.result`

```text
{"code":"adapter-unbound","extension_id":"org.example.conflict","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`host-error-conflict/recovery.out`

```text
no-result: host-error-conflict (exit 0)
```

### barrier

`host-error-barrier/1.out`

```text
not-autohandled: host-error-barrier (left for the handler; still unacknowledged)
captured: ./host-error-barrier.1.result
```

`host-error-barrier/2.out`

```text
no-result: host-error-barrier (exit 0)
```

`host-error-barrier/3.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-barrier/4.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-barrier/5.out`

```text
reconciled: published=1 started=1 stopped=0 uncertain=0 failed=0
```

`host-error-barrier/changed.out`

```text
not-autohandled: host-error-barrier (left for the handler; still unacknowledged)
captured: ./host-error-barrier.2.result
```

`host-error-barrier/healthy.out`

```text
no-result: host-error-barrier (exit 0)
```

`host-error-barrier/home/state/extensions/org.example.barrier/request-ids`

```text
sha256:66c0bf71aa8ba9b357a751fe8d9224ced4b6e5123ba36e2cd694afb6cc3f8a15
sha256:ac400e5a5180c4789c257111513c2cd52884774ec1f61d64e13455d250244873
```

`host-error-barrier/home/state/procevent-inbox/host-error-barrier.1.result`

```text
{"code":"timeout","extension_id":"org.example.barrier","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`host-error-barrier/home/state/procevent-inbox/host-error-barrier.2.result`

```text
{"code":"adapter-unbound","extension_id":"org.example.barrier","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`host-error-barrier/recovery.out`

```text
no-result: host-error-barrier (exit 0)
```

### Genuine results and explicit handling

`homes/identical/state/procevent-inbox/identical-source.1.result`

```text
{"code":"package-missing","extension_id":"org.example.identical","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`homes/identical/state/procevent-inbox/identical-source.2.result`

```text
{"code":"package-missing","extension_id":"org.example.identical","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`homes/identical/state/procevent-inbox/identical-source.3.handled`

```text

```

`homes/identical/state/procevent-inbox/identical-source.3.result`

```text
{"code":"package-missing","extension_id":"org.example.identical","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

`homes/identical/state/procevent-inbox/identical-source.4.result`

```text
{"code":"package-missing","extension_id":"org.example.identical","operation":"source.poll","schema":"firstmate.process-event-extension-error.v1"}
```

## Regression reproduction

The baseline probe used the production capture file from base `4a67799d8a8670d6ea1a55250b67d8474b070a09` in a disposable code copy, with the candidate closure fixture and other candidate files. It was not a full base checkout.

```text
FM_TEST_SKIP_ORPHAN_REAP=1 bash .test-6548/baseline/bin/fm-test-run.sh --jobs 1 tests/fm-procevent-extension-errors.test.sh
FM_TEST_BEGIN 2026-10-28T16:55:20Z tests/fm-procevent-extension-errors.test.sh family=standalone expected_gate_skip=none
not ok - package retry 2 allocated 2 distinct errors
FM_TEST_END 2026-10-28T16:55:32Z tests/fm-procevent-extension-errors.test.sh exit=1 duration_ms=11245 gate_skip=false
FM_TEST_SUMMARY total=1 failed=1 skipped_gate=0 duration_ms=11307
FM_TEST_SUMMARY_FAMILY family=standalone count=1 duration_ms=11245 failed=1
FM_TEST_SLOWEST rank=1 script=tests/fm-procevent-extension-errors.test.sh duration_ms=11245
```

## Setup and cleanup

The first attempt placed fixture packages under the worktree and was refused by the package-location guard. The successful run used the test toolchain’s normal temporary directory. Unrelated orphan reaping was disabled. Product guards were unchanged. Tests removed their disposable homes and runners. The local disposable code copy and observer were removed after verification.
