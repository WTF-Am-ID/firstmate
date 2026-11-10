#!/usr/bin/env bash
set -u
LAB="$PWD/.tmp-up3103-072/primary-launch-round2"
bin/fm-lab-home.sh create "$LAB" || exit $?
mkdir -p "$LAB/tmux"
echo "Private TMUX_TMPDIR=$LAB/tmux"
env -u NO_MISTAKES_GATE -u FM_GATE_REFUSE_BYPASS -u FM_ROOT_OVERRIDE -u FM_STATE_OVERRIDE -u FM_DATA_OVERRIDE -u FM_CONFIG_OVERRIDE -u FM_PROJECTS_OVERRIDE TMUX_TMPDIR="$LAB/tmux" tmux -L fm-lab new-session -d -x 120 -y 40 -s primary -c "$PWD" -e FM_HOME="$LAB" codex
rc=$?
echo "Primary launch exit=$rc"
if [ "$rc" -eq 0 ]; then
  TMUX_TMPDIR="$LAB/tmux" tmux -L fm-lab capture-pane -p -t primary
  TMUX_TMPDIR="$LAB/tmux" tmux -L fm-lab kill-server
  exit $?
fi
exit "$rc"
