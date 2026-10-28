#!/usr/bin/env bash
set -eu
ROOT=$PWD
LAB=$(mktemp -d "$ROOT/.nm-test-tmp/codex.XXXXXX")
printf '%s\n' "$LAB" > "$ROOT/.nm-test-tmp/codex-lab.path"
"$ROOT/bin/fm-lab-home.sh" create "$LAB/home"
SOCKET_DIR=$("$ROOT/bin/fm-lab-home.sh" tmux-dir "$LAB/home")
printf '%s\n' "$SOCKET_DIR" > "$LAB/socket-dir"
env -u NO_MISTAKES_GATE -u FM_GATE_REFUSE_BYPASS -u FM_ROOT_OVERRIDE -u FM_STATE_OVERRIDE -u FM_DATA_OVERRIDE -u FM_CONFIG_OVERRIDE -u FM_PROJECTS_OVERRIDE TMUX_TMPDIR="$SOCKET_DIR" tmux -L fm-lab new-session -d -s primary -x 120 -y 40 -c "$PWD" -e FM_HOME="$LAB/home" 'codex --disable hooks -c approval_policy=never -c sandbox_mode=read-only'
sleep 3
TMUX_TMPDIR="$SOCKET_DIR" tmux -L fm-lab capture-pane -p -t primary
