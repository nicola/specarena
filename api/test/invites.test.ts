import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../index";
import { defaultEngine } from "@arena/engine/engine";

// --- Helpers ---

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

async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

// --- Tests ---

describe("Invites REST API", () => {
  beforeEach(async () => {
    await clearState();
  });

  // -- GET /api/invites/:inviteId --

  it("GET /api/invites/:inviteId returns challenge for valid unclaimed invite", async () => {
    const { invites } = await createPsiChallenge();

    const res = await request("GET", `/api/invites/${invites[0]}`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.id, "response should include challenge id");
    assert.equal(data.challengeType, "psi");
    assert.ok(data.invites.includes(invites[0]));
  });

  it("GET /api/invites/:inviteId returns 404 for nonexistent invite", async () => {
    const res = await request("GET", "/api/invites/inv_doesnotexist");
    assert.equal(res.status, 404);

    const data = await res.json();
    assert.ok(data.error);
  });

  it("GET /api/invites/:inviteId returns 409 for already-claimed invite", async () => {
    const { id, invites } = await createPsiChallenge();

    // Join with the invite (claims it)
    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    await challenge.instance.join(invites[0]);

    const res = await request("GET", `/api/invites/${invites[0]}`);
    assert.equal(res.status, 409);

    const data = await res.json();
    assert.ok(data.error.includes("already used"));
  });

  it("GET /api/invites/:inviteId — first invite claimed, second still valid", async () => {
    const { id, invites } = await createPsiChallenge();

    // Claim first invite
    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    await challenge.instance.join(invites[0]);

    // First invite → 409
    const res1 = await request("GET", `/api/invites/${invites[0]}`);
    assert.equal(res1.status, 409);

    // Second invite → 200
    const res2 = await request("GET", `/api/invites/${invites[1]}`);
    assert.equal(res2.status, 200);
  });

  // -- POST /api/invites --

  it("POST /api/invites claims a valid invite", async () => {
    const { invites } = await createPsiChallenge();

    const res = await request("POST", "/api/invites", { inviteId: invites[0] });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
  });

  it("POST /api/invites returns 400 when inviteId is missing", async () => {
    const res = await request("POST", "/api/invites", {});
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.ok(data.error.includes("required"));
  });

  it("POST /api/invites returns 404 for nonexistent invite", async () => {
    const res = await request("POST", "/api/invites", { inviteId: "inv_fake" });
    assert.equal(res.status, 404);

    const data = await res.json();
    assert.ok(data.error);
  });

  it("POST /api/invites returns 409 for already-claimed invite", async () => {
    const { id, invites } = await createPsiChallenge();

    // Claim the invite first
    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    await challenge.instance.join(invites[0]);

    const res = await request("POST", "/api/invites", { inviteId: invites[0] });
    assert.equal(res.status, 409);

    const data = await res.json();
    assert.ok(data.error.includes("already used"));
  });

  // -- Invite isolation between challenges --

  it("invites are scoped to their challenge", async () => {
    const c1 = await createPsiChallenge();
    const c2 = await createPsiChallenge();

    // Each challenge has unique invites
    const allInvites = [...c1.invites, ...c2.invites];
    const unique = new Set(allInvites);
    assert.equal(unique.size, 4, "all 4 invites should be unique");

    // c1's invite resolves to c1
    const res1 = await request("GET", `/api/invites/${c1.invites[0]}`);
    const data1 = await res1.json();
    assert.equal(data1.id, c1.id);

    // c2's invite resolves to c2
    const res2 = await request("GET", `/api/invites/${c2.invites[0]}`);
    const data2 = await res2.json();
    assert.equal(data2.id, c2.id);
  });

  // -- Both invites claimed --

  it("both invites can be checked and claimed independently", async () => {
    const { id, invites } = await createPsiChallenge();
    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);

    // Both valid initially
    const r1 = await request("GET", `/api/invites/${invites[0]}`);
    const r2 = await request("GET", `/api/invites/${invites[1]}`);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);

    // Claim first
    await challenge.instance.join(invites[0]);

    // First → 409, second → 200
    const r3 = await request("GET", `/api/invites/${invites[0]}`);
    const r4 = await request("GET", `/api/invites/${invites[1]}`);
    assert.equal(r3.status, 409);
    assert.equal(r4.status, 200);

    // Claim second
    await challenge.instance.join(invites[1]);

    // Both → 409
    const r5 = await request("GET", `/api/invites/${invites[0]}`);
    const r6 = await request("GET", `/api/invites/${invites[1]}`);
    assert.equal(r5.status, 409);
    assert.equal(r6.status, 409);
  });
});
