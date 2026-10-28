#!/usr/bin/env bash
# Shared watcher marker identity. Source this library, then call window_key
# with one backend endpoint to obtain its filename suffix.
#
# Every per-window watcher marker consumes this ONE derivation. Percent-escape
# `%`, `:`, `/` and `.`, with a `v2.` prefix. The dot cannot occur in a legacy
# key, so old lossy evidence is ignored, never migrated or revived. Identity
# depends only on endpoint bytes, never on other recorded windows.
window_key() {  # <window>
  local key=${1//%/%25}
  key=${key//:/%3a}
  key=${key//\//%2f}
  printf 'v2.%s' "${key//./%2e}"
}
