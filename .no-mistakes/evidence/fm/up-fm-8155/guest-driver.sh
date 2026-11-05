#!/usr/bin/env bash
set -euo pipefail
cd /opt/src
git clone candidate.bundle candidate
cd candidate
test "$(git rev-parse HEAD)" = 7d3965b5c5d3b222b0478e26edb657ffe89970c2
printf 'EXACT_CANDIDATE=%s\n' "$(git rev-parse HEAD)"
id
node --version
npm install --prefix /opt/src/deps tasks-axi@0.2.6
export PATH="/opt/src/deps/node_modules/.bin:$PATH"
tasks-axi --version
bash /opt/src/live.sh
set +e
bash bin/fm-test-run.sh tests/fm-send-resolve-key.test.sh tests/fm-captain-hold-lifecycle.test.sh
rc=$?
set -e
printf 'FOCUSED_EXIT=%s\n' "$rc"
exit "$rc"
