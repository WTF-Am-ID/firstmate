#!/bin/bash
set -eu
ROOT=$PWD
EVIDENCE=~/.no-mistakes-upstream-codex/evidence/01M7B9YYY5GC9FBT8PPT0TF9AM
LAB=$ROOT/.phase-test/3103-live/lab
unset FM_ROOT_OVERRIDE FM_STATE_OVERRIDE FM_DATA_OVERRIDE FM_CONFIG_OVERRIDE FM_PROJECTS_OVERRIDE FM_GATE_REFUSE_BYPASS FM_TEST_SEAM TASKS_AXI_FILE TASKS_AXI_BACKEND
export FM_HOME=$LAB
for tool in mkdir chmod date cksum shasum cp mv rm mktemp rmdir sort head id ps sleep; do
  resolved=$(command -v "$tool")
  ln -s "$resolved" "$LAB/tools/$tool"
done
printf '\nS2: invalid or unavailable task-owned destination rejects registration and cannot publish readiness\n'
for shape in missing empty duplicate conflict malformed; do
  meta=$LAB/state/$shape.meta
  printf 'kind=ship\nmode=direct-PR\n' > "$meta"
  case "$shape" in
    missing) ;;
    empty) printf 'expected_base=\n' >> "$meta" ;;
    duplicate) printf 'expected_base=main\nexpected_base=main\n' >> "$meta" ;;
    conflict) printf 'expected_base=main\nbase_branch=release/3103\n' >> "$meta" ;;
    malformed) printf 'expected_base=bad..branch\n' >> "$meta" ;;
  esac
  before=$(shasum -a 256 "$meta")
  rc=0
  output=$(PATH="$LAB/tools" /bin/bash bin/fm-pr-check.sh "$shape" https://github.com/synthetic/fixture/pull/3103 2>&1) || rc=$?
  printf 'shape=%s exit=%s\n%s\n' "$shape" "$rc" "$output"
  [ "$rc" -ne 0 ]
  case "$output" in *'expected PR base is unavailable or inconsistent'*) ;; *) exit 1 ;; esac
  [ "$before" = "$(shasum -a 256 "$meta")" ]
  [ ! -e "$LAB/state/$shape.check.sh" ] && [ ! -e "$LAB/state/$shape.pr-poll" ]
done
# A valid named destination with no forge reader must also refuse rather than assume the default.
printf 'kind=ship\nmode=direct-PR\nexpected_base=release/3103\n' > "$LAB/state/unreadable.meta"
rc=0
output=$(PATH="$LAB/tools" /bin/bash bin/fm-pr-check.sh unreadable https://github.com/synthetic/fixture/pull/3103 2>&1) || rc=$?
printf 'shape=live-base-unreadable exit=%s\n%s\n' "$rc" "$output"
[ "$rc" -ne 0 ]
case "$output" in *'expected PR base release/3103, actual base unavailable'*) ;; *) exit 1 ;; esac
[ ! -e "$LAB/state/unreadable.check.sh" ] && [ ! -e "$LAB/state/unreadable.pr-poll" ]
printf '\nS3: restarted saved poll reports legacy destination recovery and GitLab jq recovery\n'
# This is the product's saved standalone poll contract, executed in a fresh process each time.
cp bin/fm-pr-poll.sh "$LAB/state/legacy.check.sh"
printf 'github\nhttps://github.com/synthetic/fixture/pull/3103\ngithub.com\nsynthetic/fixture\n3103\n' > "$LAB/state/legacy.pr-poll"
printf 'kind=ship\nmode=direct-PR\n' > "$LAB/state/legacy.meta"
for invocation in 1 2; do
  output=$(PATH="$LAB/tools" /bin/bash "$LAB/state/legacy.check.sh")
  printf 'legacy restart=%s\n%s\n' "$invocation" "$output"
  case "$output" in *'merge/readiness refused: expected PR base unavailable.'*) ;; *) exit 1 ;; esac
done
# Delivery acknowledgement belongs to the caller. A delivered notice is suppressed across restarts.
touch "$LAB/state/legacy.pr-base-notified"
output=$(PATH="$LAB/tools" /bin/bash "$LAB/state/legacy.check.sh")
[ -z "$output" ]
printf 'legacy after delivery receipt: no repeated notice and no merged claim\n'
cp bin/fm-pr-poll.sh "$LAB/state/gitlab.check.sh"
printf 'gitlab\nhttps://gitlab.example/synthetic/fixture/-/merge_requests/3103\ngitlab.example\nsynthetic/fixture\n3103\n' > "$LAB/state/gitlab.pr-poll"
for field in base_branch expected_base; do
  printf 'kind=ship\n%s=release/3103\n' "$field" > "$LAB/state/gitlab.meta"
  for invocation in 1 2; do
    output=$(PATH="$LAB/tools" /bin/bash "$LAB/state/gitlab.check.sh")
    printf 'GitLab record=%s restart=%s\n%s\n' "$field" "$invocation" "$output"
    case "$output" in *'GitLab destination proof unavailable without jq; install jq, then re-arm the watch.'*) ;; *) exit 1 ;; esac
  done
done
touch "$LAB/state/gitlab.pr-base-notified"
output=$(PATH="$LAB/tools" /bin/bash "$LAB/state/gitlab.check.sh")
[ -z "$output" ]
printf 'GitLab after delivery receipt: no repeated notice and no merged claim\n'
printf '\nS4-S6 forge-dependent live proof unavailable: prior emulator setup refusal retained, no retry or alternate route attempted.\n'
for tool in gh glab tea gerrit-axi; do
  if resolved=$(command -v "$tool"); then printf '%s available: %s\n' "$tool" "$resolved"; else printf '%s absent from PATH\n' "$tool"; fi
done
printf 'No forge endpoint called. No fake forge executable used. No background child started.\n'
