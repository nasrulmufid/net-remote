#!/bin/sh
set -e

# The container starts as root so it can fix ownership of the bind-mounted
# data directory, then drops privileges to the unprivileged `node` user.
#
# Why: ./data is bind-mounted from the host. On a Linux/VPS host that directory
# is typically owned by root (or another uid), so the `node` user cannot create
# or open the SQLite file and better-sqlite3 fails with:
#   SqliteError: unable to open database file (SQLITE_CANTOPEN)

DB_DIR="$(dirname "${DB_PATH:-/app/data/netremote.db}")"
mkdir -p "$DB_DIR"

if [ "$(id -u)" = "0" ]; then
  # Best-effort: some filesystems (NFS, rootless Docker) reject chown.
  chown -R node:node "$DB_DIR" 2>/dev/null || true

  if ! setpriv --reuid=node --regid=node --init-groups -- test -w "$DB_DIR" 2>/dev/null; then
    echo "ERROR: data directory '$DB_DIR' is not writable by the 'node' user." >&2
    echo "Fix it on the host, e.g.: sudo chown -R 1000:1000 ./data" >&2
    exit 1
  fi

  exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi

exec "$@"