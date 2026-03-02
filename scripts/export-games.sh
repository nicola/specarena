#!/usr/bin/env bash
set -euo pipefail

# Export all games, messages, users, and scores from the Arena API into a single JSON file.
# Usage: ./scripts/export-games.sh [BASE_URL] [OUTPUT_FILE]

BASE_URL="${1:-http://localhost:3001}"
OUTPUT="${2:-arena-export.json}"

fetch() { curl -sf "$BASE_URL$1"; }

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Exporting from $BASE_URL ..."

fetch "/api/challenges" > "$TMPDIR/challenges.json"
fetch "/api/users"      > "$TMPDIR/users.json"
fetch "/api/scoring"    > "$TMPDIR/scoring.json" 2>/dev/null || echo "[]" > "$TMPDIR/scoring.json"

# Fetch chat messages for every challenge (both direct and arena channels)
ids=$(jq -r '.challenges[].id' "$TMPDIR/challenges.json")
echo '{}' > "$TMPDIR/messages.json"

for uuid in $ids; do
  chat=$(fetch "/api/chat/sync?channel=$uuid&index=0" || echo '{"messages":[]}')
  arena=$(fetch "/api/chat/sync?channel=challenge_$uuid&index=0" || echo '{"messages":[]}')
  # Merge both channels, sort by timestamp, and add to messages object
  jq -n --argjson c "$chat" --argjson a "$arena" \
    '$c.messages + $a.messages | sort_by(.timestamp)' > "$TMPDIR/ch_$uuid.json"
  jq --arg k "$uuid" --slurpfile v "$TMPDIR/ch_$uuid.json" \
    '. + {($k): $v[0]}' "$TMPDIR/messages.json" > "$TMPDIR/messages_tmp.json"
  mv "$TMPDIR/messages_tmp.json" "$TMPDIR/messages.json"
done

# Assemble final export
jq -n \
  --slurpfile challenges "$TMPDIR/challenges.json" \
  --slurpfile users      "$TMPDIR/users.json" \
  --slurpfile scoring    "$TMPDIR/scoring.json" \
  --slurpfile messages   "$TMPDIR/messages.json" \
  '{
    exportedAt: (now | todate),
    challenges: $challenges[0].challenges,
    profiles: $challenges[0].profiles,
    users: $users[0],
    scoring: $scoring[0],
    messages: $messages[0]
  }' > "$OUTPUT"

count=$(jq '.count' "$TMPDIR/challenges.json")
echo "Exported $count challenges to $OUTPUT"
