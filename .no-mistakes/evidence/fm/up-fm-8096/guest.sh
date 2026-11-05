#!/usr/bin/env bash
set -euo pipefail
echo 'Preparation: complete the disclosed Debian dependency installation'
dpkg --configure -a
dpkg -i /root/debs/*.deb
dpkg-query -W git perl jq gawk
id fm8096test >/dev/null 2>&1 || useradd -m -s /bin/bash fm8096test
chown -R fm8096test:fm8096test /opt/src
chmod +x /opt/src/.test-phase/live-probes.sh
echo 'Exact candidate: 0eac5de85c81452a5f538bef0eb5283153268a44, freshly cloned and checked clean on host before .git-free archive'
echo 'Live command: runuser -u fm8096test -- bash /opt/src/.test-phase/live-probes.sh /opt/src'
runuser -u fm8096test -- bash /opt/src/.test-phase/live-probes.sh /opt/src
echo 'Closure command: bin/fm-test-run.sh tests/fm-procevent.test.sh'
cd /opt/src
runuser -u fm8096test -- bash -c 'cd /opt/src && bin/fm-test-run.sh tests/fm-procevent.test.sh'
echo 'CLOSURE_EXIT=0'
