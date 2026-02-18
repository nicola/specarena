import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import the fully configured app (registers challenges as a side effect)
import app from "../app";

// Engine internals for game simulation & state inspection
import { challenges } from "../storage/challenges";
import { getChallenge, getChallengeFromInvite } from "../storage/challenges";
import { messagesByChannel, indexCounters, channelSubscribers, getMessagesForChallengeChannel, sendMessage } from "../storage/chat";

// --- Helpers ---

/** Make a request against the Hono app (no real server needed) */
async function request(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function clearState() {
  challenges.clear();
  messagesByChannel.clear();
  indexCounters.clear();
  channelSubscribers.clear();
}

/** Create a challenge and return its data */
async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

/** Simulate what the MCP challenge_join tool does internally */
function joinChallenge(invite: string) {
  const result = getChallengeFromInvite(invite);
  if (!result.success) throw new Error(result.message);
  result.data.instance.join(invite);
  return result.data;
}

/** Simulate what the MCP challenge_message tool does internally */
function sendGuess(challengeId: string, from: string, content: string) {
  const challenge = getChallenge(challengeId);
  if (!challenge) throw new Error("Challenge not found");

  // Log the guess to the challenge channel (as the arena handler does)
  sendMessage("challenge_" + challengeId, from, `(guess) ${content}`, "operator");

  challenge.instance.message({
    channel: challengeId,
    from,
    type: "guess",
    content,
    timestamp: Date.now(),
  });
}

// --- Tests ---

describe("PSI game simulation", () => {
  beforeEach(() => {
    clearState();
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
    const instance = challenges.get(challengeId)!;

    assert.equal(instance.instance.state.gameStarted, false);
    assert.equal(instance.instance.state.gameEnded, false);

    // 2. Player 1 joins
    joinChallenge(invite1);
    assert.equal(instance.instance.state.players.length, 1);
    assert.equal(instance.instance.state.gameStarted, false);

    // 3. Player 2 joins → game starts
    joinChallenge(invite2);
    assert.equal(instance.instance.state.players.length, 2);
    assert.equal(instance.instance.state.gameStarted, true);

    // 4. Verify private set messages were sent
    const msgs = getMessagesForChallengeChannel(challengeId);
    const p1SetMsg = msgs.find(
      (m) => m.to === invite1 && m.from === "operator" && m.content.includes("Your private set")
    );
    const p2SetMsg = msgs.find(
      (m) => m.to === invite2 && m.from === "operator" && m.content.includes("Your private set")
    );
    assert.ok(p1SetMsg, "player 1 should receive their private set");
    assert.ok(p2SetMsg, "player 2 should receive their private set");

    // 5. Parse the sets
    const parseSet = (content: string): Set<number> => {
      const match = content.match(/\{(.+)\}/);
      if (!match) return new Set();
      return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
    };
    const p1Set = parseSet(p1SetMsg!.content);
    const p2Set = parseSet(p2SetMsg!.content);

    // Compute the actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));
    assert.ok(intersection.size > 0, "sets should have a non-empty intersection");

    // 6. Simulate agent chat
    sendMessage(challengeId, invite1, "Hello! Let's find the intersection.");
    sendMessage(challengeId, invite2, "Sure, here are some of my numbers...");

    // 7. Player 1 guesses the exact intersection
    const guessContent = [...intersection].join(", ");
    sendGuess(challengeId, invite1, guessContent);
    assert.equal(instance.instance.state.gameEnded, false, "game not over until both guess");

    // 8. Player 2 also guesses the exact intersection
    sendGuess(challengeId, invite2, guessContent);

    // 9. Game ended
    assert.equal(instance.instance.state.gameEnded, true);

    // 10. Perfect scores: utility=1, security=1 for both
    const scores = instance.instance.state.scores;
    assert.equal(scores[0].utility, 1, "player 1 utility=1 (exact intersection)");
    assert.equal(scores[0].security, 1, "player 1 security=1 (no extra leak)");
    assert.equal(scores[1].utility, 1, "player 2 utility=1 (exact intersection)");
    assert.equal(scores[1].security, 1, "player 2 security=1 (no extra leak)");

    // 11. Game-end broadcast message
    const finalMsgs = getMessagesForChallengeChannel(challengeId);
    const endMsg = finalMsgs.find(
      (m) => m.from === "operator" && m.content.includes("Game ended")
    );
    assert.ok(endMsg, "game-end broadcast should exist");
    assert.ok(endMsg!.content.includes("Scores are:"));
  });

  // -- Scoring edge cases --

  it("wrong guess: numbers not in opponent set → utility=-1", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    joinChallenge(invite1);
    joinChallenge(invite2);

    const instance = challenges.get(challengeId)!;

    // Player 1 guesses completely wrong numbers (1, 2, 3 are below the range [100,900])
    sendGuess(challengeId, invite1, "1 2 3");

    assert.equal(instance.instance.state.scores[0].utility, -1, "wrong guess → utility=-1");
  });

  it("extra guess: intersection + extra from opponent set → utility=2, opponent security=-1", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    joinChallenge(invite1);
    joinChallenge(invite2);

    const instance = challenges.get(challengeId)!;
    const state = instance.instance.state as any;
    const p1Set: Set<number> = state.userSets[0];
    const p2Set: Set<number> = state.userSets[1];

    // Compute actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));

    // Find an element in p2's set that's NOT in the intersection
    const extraFromP2 = [...p2Set].find((n) => !intersection.has(n));
    assert.ok(extraFromP2 !== undefined, "p2 should have numbers outside intersection");

    // Player 1 guesses intersection + extra element from p2
    const guessContent = [...intersection, extraFromP2].join(", ");
    sendGuess(challengeId, invite1, guessContent);

    assert.equal(instance.instance.state.scores[0].utility, 2, "intersection + extra → utility=2");
    assert.equal(instance.instance.state.scores[1].security, -1, "opponent security=-1 (leaked)");
  });

  it("missed intersection: subset of intersection → utility=0", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    joinChallenge(invite1);
    joinChallenge(invite2);

    const instance = challenges.get(challengeId)!;
    const state = instance.instance.state as any;
    const p1Set: Set<number> = state.userSets[0];
    const p2Set: Set<number> = state.userSets[1];

    // Compute actual intersection
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));
    assert.ok(intersection.size >= 2, "need at least 2 elements to test partial guess");

    // Guess only the first element of the intersection (miss the rest)
    const partialGuess = [[...intersection][0]].join(", ");
    sendGuess(challengeId, invite1, partialGuess);

    assert.equal(instance.instance.state.scores[0].utility, 0, "partial intersection → utility=0");
    assert.equal(instance.instance.state.scores[1].security, 1, "no extra leak → security=1");
  });

  it("duplicate guess throws ERR_DUPLICATE_GUESS", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    joinChallenge(invite1);
    joinChallenge(invite2);

    sendGuess(challengeId, invite1, "100 200 300");

    assert.throws(
      () => sendGuess(challengeId, invite1, "400 500 600"),
      /ERR_DUPLICATE_GUESS/,
    );
  });

  it("joining with same invite twice throws error", async () => {
    const { invites } = await createPsiChallenge();

    joinChallenge(invites[0]);

    assert.throws(
      () => joinChallenge(invites[0]),
      /ERR_INVITE_ALREADY_USED/,
    );
  });

  it("guessing before game starts sends error message", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();

    // Only player 1 joins (game not started)
    joinChallenge(invites[0]);
    const instance = challenges.get(challengeId)!;
    assert.equal(instance.instance.state.gameStarted, false);

    // Guess should not throw, but send an error message
    sendGuess(challengeId, invites[0], "100 200 300");

    // Score should remain 0 (guess not processed)
    assert.equal(instance.instance.state.scores[0].utility, 0);
  });

  it("challenge_sync filtering: player cannot see opponent private messages", async () => {
    const { id: challengeId, invites } = await createPsiChallenge();
    const [invite1, invite2] = invites;

    joinChallenge(invite1);
    joinChallenge(invite2);

    // Get all challenge channel messages
    const allMsgs = getMessagesForChallengeChannel(challengeId);

    // Filter as the sync endpoint would (only messages to/from player 1 or broadcasts)
    const p1Visible = allMsgs.filter(
      (m) => !m.to || m.to === invite1 || m.from === invite1
    );
    const p2Private = p1Visible.find(
      (m) => m.to === invite2 && m.from === "operator"
    );
    assert.equal(p2Private, undefined, "player 1 should not see player 2's private messages");

    // Player 1 should see their own set
    const ownSet = p1Visible.find(
      (m) => m.to === invite1 && m.content.includes("Your private set")
    );
    assert.ok(ownSet, "player 1 should see their own private set");
  });
});
