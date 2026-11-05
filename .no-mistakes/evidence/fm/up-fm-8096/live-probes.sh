#!/usr/bin/env bash
set -euo pipefail
PRODUCT=${1:?product root}
W=$(mktemp -d /tmp/fm8096-live.XXXXXX)
export FM_PROCEVENT_CLAIM_ROOT="$W/claims"
export FM_PROCEVENT_OWNER_LEASE_SECONDS=2 FM_PROCEVENT_OWNER_CHECK_SECONDS=1
export FM_PROCEVENT_LAUNCH_CONFIRM_SECONDS=4
export FM_ROOT_OVERRIDE="$W/adapters"
mkdir -p "$W/adapters/bin"
homes=()
callers=()
pe() { local h=$1; shift; FM_HOME="$h" "$PRODUCT/bin/fm-procevent.sh" "$@"; }
cleanup() {
  local h p
  for h in "${homes[@]}"; do pe "$h" sweep-home || true; done
  for p in "${callers[@]}"; do kill "$p" 2>/dev/null || true; wait "$p" 2>/dev/null || true; done
  rm -rf -- "$W"
}
trap cleanup EXIT
newhome() { H="$W/$1"; mkdir -p "$H/state"; homes+=("$H"); }
await_file() { local i; for i in $(seq 1 150); do [ ! -f "$1" ] || return 0; sleep .1; done; echo "FAIL missing $1"; return 1; }
stale() {
  local i
  for i in $(seq 1 100); do
    if perl -MTime::HiRes=clock_gettime,CLOCK_MONOTONIC -e 'open my $f,"<",$ARGV[0] or exit 2; my $s=<$f>; my $age=clock_gettime(CLOCK_MONOTONIC)-$s; if ($age>=3) {printf "observed lease age %.3fs, configured lease 2s\n",$age; exit 0} exit 1' "$1/state/procevent/.owner-lease"; then return 0; fi
    sleep .1
  done
  return 1
}
await_dead() {
  local i
  for i in $(seq 1 150); do
    if ! kill -0 "$1" 2>/dev/null; then echo "runner pid=$1 exited without owner renewal"; return 0; fi
    sleep .1
  done
  echo "FAIL runner pid=$1 survived"; return 1
}
cat > "$W/adapters/bin/fm-procevent-plain.sh" <<'SH'
#!/usr/bin/env bash
exit 2
SH
cat > "$W/adapters/bin/fm-procevent-held.sh" <<'SH'
#!/usr/bin/env bash
if [ "${1-}" = silent ]; then
  echo publishing > "$PUBLISH_READY"
  for i in $(seq 1 300); do [ ! -e "$PUBLISH_RELEASE" ] || exit 1; sleep .1; done
fi
exit 2
SH
cat > "$W/source.sh" <<'SH'
#!/usr/bin/env bash
echo "source command started pid=$$" > "$1"
for i in $(seq 1 600); do
  if [ -e "$2" ]; then echo synthetic-payload; exit 0; fi
  sleep .1
done
exit 75
SH
chmod +x "$W/source.sh" "$W/adapters/bin/"*.sh

echo 'SCENARIO delayed reconcile starts the synthetic command'
newhome delayed
pe "$H" register plain delayed-src -- "$W/source.sh" "$W/delayed.started" "$W/delayed.release"
mkdir -p "$H/state/procevent-inbox"
echo previous-payload > "$H/state/procevent-inbox/old.1.result"
echo held > "$H/state/procevent-inbox/old.1.adapter"
chmod 600 "$H/state/procevent-inbox/old.1."*
export PUBLISH_READY="$W/publish.ready" PUBLISH_RELEASE="$W/publish.release"
pe "$H" reconcile > "$W/reconcile.out" 2>&1 &
p=$!; callers+=("$p")
await_file "$PUBLISH_READY"
stale "$H"
touch "$PUBLISH_RELEASE"
set +e
wait "$p"; rc=$?
set -e
cat "$W/reconcile.out"
echo "reconcile exit=$rc"
if [ "${EXPECT_BASELINE:-0}" = 1 ]; then
  [ "$rc" -ne 0 ] && [ ! -e "$W/delayed.started" ]
  echo 'BASELINE reproduced stale-lease launch failure'
  exit 0
fi
[ "$rc" = 0 ]
await_file "$W/delayed.started"; cat "$W/delayed.started"
pe "$H" list
runner=$(cat "$H/state/procevent/delayed-src.runner")
echo 'SCENARIO detached runner stops after its lease is no longer renewed'
await_dead "$runner"

echo 'SCENARIO ensure-listening refreshes a stale caller lease'
newhome ensure
pe "$H" register plain ensure-src -- "$W/source.sh" "$W/ensure.started" "$W/ensure.release"
stale "$H"
pe "$H" ensure-listening ensure-src
await_file "$W/ensure.started"; cat "$W/ensure.started"
pe "$H" list
await_dead "$(cat "$H/state/procevent/ensure-src.runner")"

echo 'SCENARIO an attached start remains healthy past the short lease'
newhome attached
pe "$H" register plain attached-src -- "$W/source.sh" "$W/attached.started" "$W/attached.release"
pe "$H" start attached-src > "$W/attached.out" 2>&1 &
p=$!; callers+=("$p")
await_file "$W/attached.started"
sleep 5
kill -0 "$p"
cat "$W/attached.started"
echo 'attached caller alive after 5s with 2s lease'
touch "$W/attached.release"
wait "$p"
cat "$W/attached.out"
cat "$H/state/procevent-inbox/attached-src.1.result"

echo 'SCENARIO a real runner descendant cannot renew another stale home'
newhome target
target=$H
pe "$target" register plain target-src -- "$W/source.sh" "$W/target.started" "$W/target.release"
stale "$target"
cp "$target/state/procevent/.owner-lease" "$W/lease.before"
cat > "$W/descendant.sh" <<'SH'
#!/usr/bin/env bash
echo "inherited runner marker=${FM_PROCEVENT_IN_RUNNER-unset}"
set +e
FM_HOME="$2" "$1/bin/fm-procevent.sh" ensure-listening target-src
rc=$?
echo "descendant ensure-listening exit=$rc"
exit 0
SH
chmod +x "$W/descendant.sh"
newhome parent
pe "$H" register plain parent-src -- "$W/descendant.sh" "$PRODUCT" "$target"
pe "$H" start parent-src > "$W/parent.out" 2>&1
cat "$W/parent.out"
cat "$H/state/procevent-inbox/parent-src.1.result"
cmp "$W/lease.before" "$target/state/procevent/.owner-lease"
[ ! -e "$W/target.started" ]
echo 'stale target lease unchanged and target source command never started'

echo 'SCENARIO removal of the owning state root stops its runner'
newhome gone
pe "$H" register plain gone-src -- "$W/source.sh" "$W/gone.started" "$W/gone.release"
FM_PROCEVENT_OWNER_LEASE_SECONDS=30 pe "$H" reconcile
await_file "$W/gone.started"; cat "$W/gone.started"
runner=$(cat "$H/state/procevent/gone-src.runner")
mv "$H/state" "$H/saved-state"
echo 'owner state root removed while its 30s lease was fresh'
await_dead "$runner"
mv "$H/saved-state" "$H/state"
echo 'LIVE_PROBES_EXIT=0'
