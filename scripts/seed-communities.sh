#!/usr/bin/env bash
# Bash wrapper for the community seed script.
# Usage: ./seed-communities.sh --email admin@test.com --password secret

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

python3 "$SCRIPT_DIR/seed_communities.py" "$@"
