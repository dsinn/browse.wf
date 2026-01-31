#!/bin/bash

# Script to update all mock API responses with current data from oracle.browse.wf

set -e

MOCKS_DIR="$(dirname "$0")/__mocks__"

echo "Updating mock API responses..."

curl -s "https://oracle.browse.wf/min" > "$MOCKS_DIR/min.json"
echo "✓ Updated min.json"

curl -s "https://oracle.browse.wf/bounty-cycle" > "$MOCKS_DIR/bounty-cycle.json"
echo "✓ Updated bounty-cycle.json"

curl -s "https://oracle.browse.wf/worldState.json" > "$MOCKS_DIR/worldState.json"
echo "✓ Updated worldState.json"

curl -s "https://oracle.browse.wf/invasions" > "$MOCKS_DIR/invasions.json"
echo "✓ Updated invasions.json"

curl -s "https://browse.wf/arbys.txt" > "$MOCKS_DIR/arbys.txt"
echo "✓ Updated arbys.txt"

echo ""
echo "All mocks updated successfully!"
echo "Run 'npm test' to verify tests still pass with new data."
