#!/usr/bin/env bash
# Shared watcher marker identity. Source this library, then call window_key
# with one backend endpoint to obtain its filename suffix.
#
# Every per-window watcher marker consumes this ONE derivation. SHA-256 of the
# endpoint bytes with a `v3.` prefix bounds the suffix to 67 ASCII bytes, leaving
# room for marker prefixes within a 255-byte filename. The dot cannot occur in a
# legacy key; legacy and v2 evidence is ignored, never migrated or revived.
# Identity depends only on endpoint bytes, never on other recorded windows.
window_key() {  # <window>
  local digest
  if command -v shasum >/dev/null 2>&1; then
    digest=$(printf '%s' "$1" | shasum -a 256)
  else
    digest=$(printf '%s' "$1" | sha256sum)
  fi
  printf 'v3.%s' "${digest%% *}"
}
