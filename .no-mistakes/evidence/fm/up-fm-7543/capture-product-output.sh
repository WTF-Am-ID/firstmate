# Observation only: capture executable output and serialized fixture records.
if [ "${0##*/}" = fm-backend-orca.test.sh ]; then
  fm_evidence_capture() {
    local observed=$1 stack=$2 previous=$3
    if [[ "$stack" = *test_teardown_orca_nonzero_removal_requires_force_and_absent_path* && "$observed" = '[ "$scenario" = forced-absent ]' ]]; then
      {
        printf '\n=== scenario: %s ===\nexit: %s\n' "$scenario" "$rc"
        printf '%s\n' "$out"
        if [ -f "$state/$id.meta" ]; then printf 'metadata: retained\n'; else printf 'metadata: absent\n'; fi
        if [ -f "$state/$id.backlog-close" ]; then printf 'pending close marker: present\n'; else printf 'pending close marker: absent\n'; fi
        printf 'backlog after startup replay:\n'
        cat "$data/backlog.md"
        printf '\nOrca calls, arguments separated by |:\n'
        tr '\037' '|' < "$LOG"
      } >> /Users/daddy/.no-mistakes-upstream-codex/evidence/01M61JJANY7ZW7QQQ1A41GCPT9/teardown-product-transcript.log
    fi
    if [[ "$stack" = *test_remove_worktree_preserves_nonzero_stdout_error* && "$observed" = '[ "$rc" -ne 0 ]' ]]; then
      {
        printf '\n=== nonzero helper diagnostic ===\nexit: %s\n%s\n' "$rc" "$out"
      } >> /Users/daddy/.no-mistakes-upstream-codex/evidence/01M61JJANY7ZW7QQQ1A41GCPT9/teardown-product-transcript.log
    fi
    return "$previous"
  }
  set -T
  trap 'fm_evidence_capture "$BASH_COMMAND" "${FUNCNAME[*]}" "$?"' DEBUG
fi
