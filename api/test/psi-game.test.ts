import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createTestAppFromEnv, type TestApp } from "./helpers/create-app";
let app: TestApp["app"];
let engine: TestApp["engine"];

// Engine actions — shared by REST + MCP
const challengeJoin = (invite: string, userId?: string) => engine.challengeJoin(invite, userId);
const challengeMessage = (challengeId: string, from: string, messageType: string, content: string) =>
  engine.challengeMessage(challengeId, from, messageType, content);
const challengeSync = (channel: string, from: string, index: number) => engine.challengeSync(channel, from, index);
const chatSend = (channel: string, from: string, content: string, to?: string | null) =>
  engine.chat.chatSend(channel, from, content, to);

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
  await engine.clearRuntimeState();
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
  const challenge = await engine.getChallenge(challengeId);
  assert.ok(challenge, `Challenge ${challengeId} should exist`);
  return challenge;
}

// --- Tests ---

describe("PSI game simulation", () => {
  before(async () => { ({ app, engine } = await createTestAppFromEnv()); });
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

  // -- Full game flow --

  it("full game: create → join → chat → guess → scores", async () => {
    // 1. Create challenge
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;
    let challenge = await getChallengeOrThrow(challengeId);

    assert.equal(challenge.state.gameStarted, false);
    assert.equal(challenge.state.gameEnded, false);

    // 2. Player 1 joins
    await challengeJoin(invite1);
    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.players.length, 1);
    assert.equal(challenge.state.gameStarted, false);

    // 3. Player 2 joins → game starts
    await challengeJoin(invite2);
    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.players.length, 2);
    assert.equal(challenge.state.gameStarted, true);

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
    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.gameEnded, false, "game not over until both guess");

    // 8. Player 2 also guesses the exact intersection
    await challengeMessage(challengeId, invite2, "guess", guessContent);

    // 9. Game ended
    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.gameEnded, true);

    // 10. Perfect scores: utility=1, security=1 for both
    const scores = challenge.state.scores;
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

    await getChallengeOrThrow(challengeId);

    // Player 1 guesses completely wrong numbers (1, 2, 3 are below the range [100,900])
    await challengeMessage(challengeId, invite1, "guess", "1 2 3");

    const challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.scores[0].utility, -1, "wrong guess → utility=-1");
  });

  it("extra guess: intersection + extra from opponent set → utility=1, opponent security=-1", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    let challenge = await getChallengeOrThrow(challengeId);
    const gameState = challenge.gameState as { userSets: number[][] };
    const p1Set = new Set(gameState.userSets[0]);
    const p2Set = new Set(gameState.userSets[1]);

    // Compute actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));

    // Find an element in p2's set that's NOT in the intersection
    const extraFromP2 = [...p2Set].find((n) => !intersection.has(n));
    assert.ok(extraFromP2 !== undefined, "p2 should have numbers outside intersection");

    // Player 1 guesses intersection + extra element from p2
    const guessContent = [...intersection, extraFromP2].join(", ");
    await challengeMessage(challengeId, invite1, "guess", guessContent);

    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.scores[0].utility, 1, "intersection + extra → utility=1");
    assert.equal(challenge.state.scores[1].security, -1, "opponent security=-1 (leaked)");
  });

  it("missed intersection: subset of intersection → utility=0", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    let challenge = await getChallengeOrThrow(challengeId);
    const gameState = challenge.gameState as { userSets: number[][] };
    const p1Set = new Set(gameState.userSets[0]);
    const p2Set = new Set(gameState.userSets[1]);

    // Compute actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));
    assert.ok(intersection.size >= 2, "need at least 2 elements to test partial guess");

    // Guess only the first element of the intersection (miss the rest)
    const partialGuess = [[...intersection][0]].join(", ");
    await challengeMessage(challengeId, invite1, "guess", partialGuess);

    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.scores[0].utility, 0, "partial intersection → utility=0");
    assert.equal(challenge.state.scores[1].security, 1, "no extra leak → security=1");
  });

  it("duplicate guess returns DUPLICATE_GUESS error code", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    await challengeMessage(challengeId, invite1, "guess", "100 200 300");

    // Second guess returns error (not throw — actions don't throw)
    const result = await challengeMessage(challengeId, invite1, "guess", "400 500 600");
    assert.ok("error" in result);
    assert.equal((result as any).code, "DUPLICATE_GUESS");
  });

  it("joining with same invite twice returns INVITE_ALREADY_USED error code", async () => {
    const { invites } = await createPsiChallenge();

    await challengeJoin(invites[0]);

    // Second join returns error
    const result = await challengeJoin(invites[0]);
    assert.ok("error" in result);
    assert.equal((result as any).code, "INVITE_ALREADY_USED");
  });

  it("guessing before game starts sends error message", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();

    // Only player 1 joins (game not started)
    await challengeJoin(invites[0]);
    const challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.gameStarted, false);

    // Guess — game not running, operator sends error via challenge channel
    await challengeMessage(challengeId, invites[0], "guess", "100 200 300");

    // Score should remain 0 (guess not processed)
    assert.equal(challenge.state.scores[0].utility, 0);
  });

  it("challenge_sync filtering: player cannot see opponent private messages", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    // Sync as player 1 — should only see own messages and broadcasts
    const p1Sync = await challengeSync(challengeId, invite1, 0);
    const p2Private = p1Sync.messages.find(
      (m: any) => m.to === invite2 && m.from === "operator"
    );
    assert.ok(p2Private?.redacted, "player 1 should see player 2's private messages as redacted");

    // Player 1 should see their own set
    const ownSet = p1Sync.messages.find(
      (m) => m.to === invite1 && m.content.includes("Your private set")
    );
    assert.ok(ownSet, "player 1 should see their own private set");
  });

  it("after game ends, challengeSync returns all messages unredacted", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    await challengeJoin(invite1);
    await challengeJoin(invite2);

    let challenge = await getChallengeOrThrow(challengeId);

    // During game: null viewer sees DMs as redacted
    const midGameSync = await challengeSync(challengeId, null, 0);
    const redactedDMs = midGameSync.messages.filter((m) => m.redacted);
    assert.ok(redactedDMs.length > 0, "before game ends, DMs should be redacted for null viewer");

    // Play to completion
    const gameState = challenge.gameState as { userSets: number[][] };
    const p1Set = new Set(gameState.userSets[0]);
    const p2Set = new Set(gameState.userSets[1]);
    const intersection = [...p1Set].filter((n) => p2Set.has(n));
    const guessContent = intersection.join(", ");

    await challengeMessage(challengeId, invite1, "guess", guessContent);
    await challengeMessage(challengeId, invite2, "guess", guessContent);
    challenge = await getChallengeOrThrow(challengeId);
    assert.equal(challenge.state.gameEnded, true);

    // After game ends: null viewer sees everything unredacted
    const postGameSync = await challengeSync(challengeId, null, 0);
    const stillRedacted = postGameSync.messages.filter((m) => m.redacted);
    assert.equal(stillRedacted.length, 0, "after game ends, no messages should be redacted");

    // Verify DM content is actually visible
    const p1SetMsg = postGameSync.messages.find(
      (m) => m.to === invite1 && m.content.includes("Your private set")
    );
    const p2SetMsg = postGameSync.messages.find(
      (m) => m.to === invite2 && m.content.includes("Your private set")
    );
    assert.ok(p1SetMsg, "player 1's private set should be visible to everyone");
    assert.ok(p2SetMsg, "player 2's private set should be visible to everyone");
  });

  // -- Game category classification --

  async function playFullGame(challengeId: string, invites: string[], userIds?: [string, string]) {
    const [invite1, invite2] = invites;
    await challengeJoin(invite1, userIds?.[0]);
    await challengeJoin(invite2, userIds?.[1]);

    const challenge = await getChallengeOrThrow(challengeId);
    const gameState = challenge.gameState as { userSets: number[][] };
    const intersection = gameState.userSets[0].filter((n) => gameState.userSets[1].includes(n));
    const guessContent = intersection.join(", ");

    await challengeMessage(challengeId, invite1, "guess", guessContent);
    await challengeMessage(challengeId, invite2, "guess", guessContent);

    return getChallengeOrThrow(challengeId);
  }

  it("gameCategory defaults to 'train' for regular players", async () => {
    const { id, invites } = await createPsiChallenge();
    const challenge = await playFullGame(id, invites);
    assert.equal(challenge.gameCategory, "train");
  });

  it("gameCategory is 'benchmark' when all players are benchmark", async () => {
    const userA = "bench-user-a";
    const userB = "bench-user-b";
    await engine.users.setUser(userA, { username: "BenchA", isBenchmark: true });
    await engine.users.setUser(userB, { username: "BenchB", isBenchmark: true });

    const { id, invites } = await createPsiChallenge();
    const challenge = await playFullGame(id, invites, [userA, userB]);
    assert.equal(challenge.gameCategory, "benchmark");
  });

  it("gameCategory is 'test' when all but one player are benchmark", async () => {
    const benchUser = "bench-user-test";
    const humanUser = "human-user-test";
    await engine.users.setUser(benchUser, { username: "BenchModel", isBenchmark: true });
    await engine.users.setUser(humanUser, { username: "Human" });

    const { id, invites } = await createPsiChallenge();
    const challenge = await playFullGame(id, invites, [benchUser, humanUser]);
    assert.equal(challenge.gameCategory, "test");
  });

  it("gameCategory is 'train' when multiple non-benchmark players", async () => {
    const userA = "regular-a";
    const userB = "regular-b";
    await engine.users.setUser(userA, { username: "RegularA" });
    await engine.users.setUser(userB, { username: "RegularB" });

    const { id, invites } = await createPsiChallenge();
    const challenge = await playFullGame(id, invites, [userA, userB]);
    assert.equal(challenge.gameCategory, "train");
  });

  it("gameCategory is 'train' when players have no user profiles", async () => {
    const { id, invites } = await createPsiChallenge();
    // Join without userIds — no profiles exist
    const challenge = await playFullGame(id, invites);
    assert.equal(challenge.gameCategory, "train");
  });
});
