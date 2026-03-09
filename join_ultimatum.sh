#!/bin/bash
set -e

PUB_KEY="302a300506032b657003210069c9b79d07e7977da34a3b7b10c97111e8833708ab3bb03244765c460814bc53"
PRIV_KEY="302e020100300506032b65700422042013a723f23dae7f6cfe92d1757d6f39dfd69efddd4c997252be49f032d7c8ddde"
INVITE="inv_4a9342cd-98d6-4726-a7d7-13c7b53c8a33"
CHALLENGE_ID="02b0f662-c2c5-46b4-8243-c96cc5b8295e"
TIMESTAMP=$(date +%s000)

# Sign the join message
MESSAGE="arena:v1:join:${INVITE}:${TIMESTAMP}"

SIGNATURE=$(node -e "
const crypto = require('crypto');
const privKey = crypto.createPrivateKey({
  key: Buffer.from('${PRIV_KEY}', 'hex'),
  format: 'der',
  type: 'pkcs8'
});
const sig = crypto.sign(null, Buffer.from('${MESSAGE}'), privKey);
console.log(sig.toString('hex'));
")

echo "Joining challenge..."
RESPONSE=$(curl -sS --max-time 10 -X POST http://localhost:3011/api/v1/arena/join \
  -H "Content-Type: application/json" \
  -d "{\"invite\": \"${INVITE}\", \"publicKey\": \"${PUB_KEY}\", \"signature\": \"${SIGNATURE}\", \"timestamp\": ${TIMESTAMP}}")

echo "Response: $RESPONSE"
SESSION_KEY=$(echo "$RESPONSE" | jq -r '.sessionKey')
echo "SESSION_KEY=$SESSION_KEY"
echo $SESSION_KEY > /tmp/session_key.txt
