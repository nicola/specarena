import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import the fully configured app (registers challenges as a side effect)
import app from "../server/index";
import { defaultEngine } from "../engine";
import { generateKeyPair, sign, createSessionKey } from "../auth";

// Engine actions — shared by REST + MCP
const challengeJoin = (invite: string, publicKey?: string) => defaultEngine.challengeJoin(invite, publicKey);
const challengeMessage = (challengeId: string, from: string, messageType: string, content: string) =>
  defaultEngine.challengeMessage(challengeId, from, messageType, content);
const challengeSync = (channel: string, from: string, index: number) => defaultEngine.challengeSync(channel, from, index);
const chatSend = (channel: string, from: string, content: string, to?: string | null) =>
  defaultEngine.chat.chatSend(channel, from, content, to);

// --- Helpers ---

/** Make a request against the Hono app (no real server needed) */
async function request(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

/** Create a challenge via REST and return its data */
async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

/** Parse a private set message like "Your private set is: {1, 2, 3}." */
function parseSet(content: string): Set<number> {
  const match = content.match(/\{(.+)\}/);
  if (!match) return new Set();
  return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
}

async function getChallengeOrThrow(challengeId: string) {
  const challenge = await defaultEngine.getChallenge(challengeId);
  assert.ok(challenge, `Challenge ${challengeId} should exist`);
  return challenge;
}

// --- Tests ---
// These tests use the engine directly (not REST), so no session keys needed.

describe("PSI game simulation", () => {
  beforeEach(async () => {
    await clearState();
  });

  // -- Metadata endpoints --

  it("GET /api/metadata returns psi metadata", async () => {
    const res = await request("GET", "/api/metadata");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.psi, "psi metadata should exist");
    assert.equal(data.psi.name, "Private Set Intersection");
  });

  it("GET /api/metadata/psi returns single challenge metadata", async () => {
    const res = await request("GET", "/api/metadata/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, "Private Set Intersection");
  });

  it("GET /api/metadata/nonexistent returns 404", async () => {
    const res = await request("GET", "/api/metadata/nonexistent");
    assert.equal(res.status, 404);
  });

  // -- Challenge CRUD --

  it("POST /api/challenges/psi creates a challenge with 2 invites", async () => {
    const data = await createPsiChallenge();
    assert.ok(data.id);
    assert.equal(data.challengeType, "psi");
    assert.equal(data.invites.length, 2);
    assert.ok(data.invites[0].startsWith("inv_"));
    assert.ok(data.invites[1].startsWith("inv_"));
  });

  it("GET /api/challenges/psi lists created challenges", async () => {
    const c = await createPsiChallenge();
    const res = await request("GET", "/api/challenges/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.challenges.some((ch: any) => ch.id === c.id));
  });

  // -- Full game flow (engine-direct, no REST auth needed) --

  it("full game: create → join → chat → guess → scores", async () => {
    // 1. Create challenge
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;
    const challenge = await getChallengeOrThrow(challengeId);

    assert.equal(challenge.instance.state.gameStarted, false);
    assert.equal(challenge.instance.state.gameEnded, false);

    // 2. Player 1 joins
    await challengeJoin(invite1);
    assert.equal(challenge.instance.state.players.length, 1);
    assert.equal(challenge.instance.state.gameStarted, false);

    // 3. Player 2 joins → game starts
    await challengeJoin(invite2);
    assert.equal(challenge.instance.state.players.length, 2);
    assert.equal(challenge.instance.state.gameStarted, true);

    // 4. Sync to get private sets
    const sync1 = await challengeSync(challengeId, invite1, 0);
    const p1SetMsg = sync1.messages.find(
      (m) => m.to === invite1 && m.from === "operator" && m.content.includes("Your private set")
    );
    const sync2 = await challengeSync(challengeId, invite2, 0);
    const p2SetMsg = sync2.messages.find(
      (m) => m.to === invite2 && m.from === "operator" && m.content.includes("Your private set")
    );
    assert.ok(p1SetMsg, "player 1 should receive their private set");
    assert.ok(p2SetMsg, "player 2 should receive their private set");

    // 5. Parse the sets
    const p1Set = parseSet(p1SetMsg!.content);
    const p2Set = parseSet(p2SetMsg!.content);

    // Compute the actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));
    assert.ok(intersection.size > 0, "sets should have a non-empty intersection");

    // 6. Simulate agent chat
    await chatSend(challengeId, invite1, "Hello! Let's find the intersection.");
    await chatSend(challengeId, invite2, "Sure, here are some of my numbers...");

    // 7. Player 1 guesses the exact intersection
    const guessContent = [...intersection].join(", ");
    await challengeMessage(challengeId, invite1, "guess", guessContent);
    assert.equal(challenge.instance.state.gameEnded, false, "game not over until both guess");

    // 8. Player 2 also guesses the exact intersection
    await challengeMessage(challengeId, invite2, "guess", guessContent);

    // 9. Game ended
    assert.equal(challenge.instance.state.gameEnded, true);

    // 10. Perfect scores: utility=1, security=1 for both
    const scores = challenge.instance.state.scores;
    assert.equal(scores[0].utility, 1, "player 1 utility=1 (exact intersection)");
    assert.equal(scores[0].security, 1, "player 1 security=1 (no extra leak)");
    assert.equal(scores[1].utility, 1, "player 2 utility=1 (exact intersection)");
    assert.equal(scores[1].security, 1, "player 2 security=1 (no extra leak)");

    // 11. Game-end broadcast message
    const finalSync = await challengeSync(challengeId, invite1, 0);
    const endMsg = finalSync.messages.find(
      (m) => m.from === "operator" && m.content.includes("Game ended")
    );
    assert.ok(endMsg, "game-end broadcast should exist");
    assert.ok(endMsg!.content.includes("Scores are:"));
  });

  // -- Scoring edge cases --

  it("wrong guess: numbers not in opponent set → utility=-1", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    const challenge = await getChallengeOrThrow(challengeId);

    // Player 1 guesses completely wrong numbers (1, 2, 3 are below the range [100,900])
    await challengeMessage(challengeId, invite1, "guess", "1 2 3");

    assert.equal(challenge.instance.state.scores[0].utility, -1, "wrong guess → utility=-1");
  });

  it("extra guess: intersection + extra from opponent set → utility=2, opponent security=-1", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    const challenge = await getChallengeOrThrow(challengeId);
    const gameState = (challenge.instance as any).gameState;
    const p1Set: Set<number> = gameState.userSets[0];
    const p2Set: Set<number> = gameState.userSets[1];

    // Compute actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));

    // Find an element in p2's set that's NOT in the intersection
    const extraFromP2 = [...p2Set].find((n) => !intersection.has(n));
    assert.ok(extraFromP2 !== undefined, "p2 should have numbers outside intersection");

    // Player 1 guesses intersection + extra element from p2
    const guessContent = [...intersection, extraFromP2].join(", ");
    await challengeMessage(challengeId, invite1, "guess", guessContent);

    assert.equal(challenge.instance.state.scores[0].utility, 2, "intersection + extra → utility=2");
    assert.equal(challenge.instance.state.scores[1].security, -1, "opponent security=-1 (leaked)");
  });

  it("missed intersection: subset of intersection → utility=0", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    const challenge = await getChallengeOrThrow(challengeId);
    const gameState = (challenge.instance as any).gameState;
    const p1Set: Set<number> = gameState.userSets[0];
    const p2Set: Set<number> = gameState.userSets[1];

    // Compute actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));
    assert.ok(intersection.size >= 2, "need at least 2 elements to test partial guess");

    // Guess only the first element of the intersection (miss the rest)
    const partialGuess = [[...intersection][0]].join(", ");
    await challengeMessage(challengeId, invite1, "guess", partialGuess);

    assert.equal(challenge.instance.state.scores[0].utility, 0, "partial intersection → utility=0");
    assert.equal(challenge.instance.state.scores[1].security, 1, "no extra leak → security=1");
  });

  it("duplicate guess throws ERR_DUPLICATE_GUESS", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    await challengeMessage(challengeId, invite1, "guess", "100 200 300");

    // Second guess returns error (not throw — actions don't throw)
    const result = await challengeMessage(challengeId, invite1, "guess", "400 500 600");
    assert.ok("error" in result);
    assert.ok(result.error!.includes("ERR_DUPLICATE_GUESS"));
  });

  it("joining with same invite twice returns error", async () => {
    const { invites } = await createPsiChallenge();

    await challengeJoin(invites[0]);

    // Second join returns error
    const result = await challengeJoin(invites[0]);
    assert.ok("error" in result);
    assert.ok(result.error!.includes("ERR_INVITE_ALREADY_USED"));
  });

  it("guessing before game starts sends error message", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();

    // Only player 1 joins (game not started)
    await challengeJoin(invites[0]);
    const challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.instance.state.gameStarted, false);

    // Guess — game not running, operator sends error via challenge channel
    await challengeMessage(challengeId, invites[0], "guess", "100 200 300");

    // Score should remain 0 (guess not processed)
    assert.equal(challenge.instance.state.scores[0].utility, 0);
  });

  it("challenge_sync filtering: player cannot see opponent private messages", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    // Sync as player 1 — should only see own messages and broadcasts
    const p1Sync = await challengeSync(challengeId, invite1, 0);
    const p2Private = p1Sync.messages.find(
      (m) => m.to === invite2 && m.from === "operator"
    );
    assert.equal(p2Private, undefined, "player 1 should not see player 2's private messages");

    // Player 1 should see their own set
    const ownSet = p1Sync.messages.find(
      (m) => m.to === invite1 && m.content.includes("Your private set")
    );
    assert.ok(ownSet, "player 1 should see their own private set");
  });
});
