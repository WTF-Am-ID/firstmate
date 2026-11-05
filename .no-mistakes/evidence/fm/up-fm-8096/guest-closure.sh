#!/usr/bin/env bash
set -euo pipefail
echo 'Preparation: configure dependencies and repeat dpkg after predependencies exist'
dpkg --configure -a
dpkg -i /root/debs/*.deb
dpkg-query -W git perl jq gawk nodejs
node --version
id fm8096test >/dev/null 2>&1 || useradd -m -s /bin/bash fm8096test
chown -R fm8096test:fm8096test /opt/src
echo 'Exact candidate: 0eac5de85c81452a5f538bef0eb5283153268a44, freshly cloned and checked clean on host before .git-free archive'
echo 'Closure command: bin/fm-test-run.sh tests/fm-procevent.test.sh'
cd /opt/src
runuser -u fm8096test -- bash -c 'cd /opt/src && bin/fm-test-run.sh tests/fm-procevent.test.sh'
echo 'CLOSURE_EXIT=0'
