#!/bin/sh
# Hosts such as Fly.io mount the data volume owned by root, and bind mounts usually are too, but the
# app must not run as root. Fix ownership of the database folder, then drop to the node user.
set -e
if [ "$(id -u)" = "0" ]; then
  dir="$(dirname "${DATABASE_PATH:-/data/mandela.db}")"
  mkdir -p "$dir"
  chown -R node:node "$dir"
  # setpriv execs directly (no fork), so the server is PID 1 and receives SIGTERM from the host.
  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
exec "$@"
