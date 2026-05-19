#!/bin/sh
set -eu

mkdir -p /app/instance/flask_session
python scripts/init_db.py

exec "$@"
