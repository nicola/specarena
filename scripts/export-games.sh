#!/usr/bin/env bash
set -euo pipefail

# Export all games, messages, users, and scores from the Arena API into a single JSON file.
# Usage: ./scripts/export-games.sh [BASE_URL] [OUTPUT_FILE]

BASE_URL="${1:-http://localhost:3001}"
OUTPUT="${2:-arena-export.json}"

fetch() { curl -sf "$BASE_URL$1"; }

echo "Exporting from $BASE_URL ..."

challenges_json=$(fetch "/api/challenges")
users_json=$(fetch "/api/users")
scoring_json=$(fetch "/api/scoring" || echo "[]")

# Fetch chat messages for every challenge (both direct and arena channels)
ids=$(echo "$challenges_json" | jq -r '.challenges[].id')
messages_json="{"
first=true
for uuid in $ids; do
  chat=$(fetch "/api/chat/sync?channel=$uuid&index=0" || echo '{"messages":[]}')
  arena=$(fetch "/api/chat/sync?channel=challenge_$uuid&index=0" || echo '{"messages":[]}')
  # Merge both channels into one array
  merged=$(jq -n --argjson c "$chat" --argjson a "$arena" '$c.messages + $a.messages | sort_by(.timestamp)')
  $first && first=false || messages_json+=","
  messages_json+="$(jq -n --arg k "$uuid" --argjson v "$merged" '{($k): $v}'  | sed '1d;$d')"
done
messages_json+="}"

# Assemble final export
jq -n \
  --argjson challenges "$challenges_json" \
  --argjson users "$users_json" \
  --argjson scoring "$scoring_json" \
  --argjson messages "$messages_json" \
  '{
    exportedAt: (now | todate),
    challenges: $challenges.challenges,
    profiles: $challenges.profiles,
    users: $users,
    scoring: $scoring,
    messages: $messages
  }' > "$OUTPUT"

count=$(echo "$challenges_json" | jq '.count')
echo "Exported $count challenges to $OUTPUT"
