#!/usr/bin/env bash
set -euo pipefail

# ── BSCAN Frontend Deploy ────────────────────────────
# Builds SvelteKit, uploads to server, purges Cloudflare.
# Usage: ./deploy.sh

SERVER="deploy@165.22.126.190"
REMOTE_DIR="/home/deploy/bscan-repo/build"
CF_TOKEN="cfut_Ck4g5vLARUzEojSSdgC5FDWzwLqMtgw2tc143ci0929059fb"
CF_ZONES=(
    "3e701cee11835e9eff6947ddb2f5c5e7"   # wisrs.com
    "a0b9acaac123b22ab72a22e48c26b0b1"   # wisrs.co.uk
)

cd "$(dirname "$0")"

echo "▸ Building frontend..."
npm run build

echo "▸ Cleaning old build..."
ssh "$SERVER" "rm -rf $REMOTE_DIR/_app"

echo "▸ Uploading build to server..."
scp -r build/* "$SERVER:$REMOTE_DIR/"

echo "▸ Purging Cloudflare cache..."
for zone in "${CF_ZONES[@]}"; do
    status=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
        "https://api.cloudflare.com/client/v4/zones/$zone/purge_cache" \
        -H "Authorization: Bearer $CF_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"purge_everything":true}')
    echo "  Zone $zone → $status"
done

echo "✓ Frontend deployed."
