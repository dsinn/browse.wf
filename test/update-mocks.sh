#!/bin/bash

# Script to update all mock API responses with current data from oracle.browse.wf

set -e

MOCKS_DIR="$(dirname "$0")/__mocks__"

echo "Updating mock API responses..."

curl -s "https://oracle.browse.wf/bounty-cycle" > "$MOCKS_DIR/bounty-cycle.json"
echo "✓ Updated bounty-cycle.json"

if [ -z "$WARFRAME_API_FRONT_PROXY_TOKEN" ]; then
  echo "Error: WARFRAME_API_FRONT_PROXY_TOKEN is not set"
  exit 1
fi
FRONT_PROXY_BASE_URL="${WARFRAME_API_FRONT_PROXY_BASE_URL:-https://warframe-api-front-proxy.dsinn69.workers.dev}"
curl -s -H "X-Warframe-API-Front-Proxy-Token: $WARFRAME_API_FRONT_PROXY_TOKEN" \
  "$FRONT_PROXY_BASE_URL/worldState" > "$MOCKS_DIR/worldState.json"
echo "✓ Updated worldState.json"

curl -s "https://oracle.browse.wf/dicts/en.json" > "$MOCKS_DIR/dicts/en.json"
echo "✓ Updated dicts/en.json"

curl -s "https://oracle.browse.wf/redtext.json" > "$MOCKS_DIR/redtext.json"
echo "✓ Updated redtext.json"

echo ""
echo "All mocks updated successfully!"
echo "Run 'npm test' to verify tests still pass with new data."
