#!/usr/bin/env bash
set -e

export CLIENTE_ID=51
export DISPLAY=:99
export NODE_ENV=production

exec xvfb-run -a \
  --server-args="-screen 0 1280x720x24" \
  bash -lc "npm start"

