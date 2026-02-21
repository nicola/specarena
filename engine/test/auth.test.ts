import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateTestKeypair, signJoin, signChat } from "./helpers/auth";
import {
  isValidHex,
  verifyEd25519Signature,
  createSessionToken,
  verifySessionToken,
  generateServerSecret,
} from "../auth/crypto";
import { AuthEngine } from "../auth/index";

// --- Crypto unit tests ---

describe("crypto: isValidHex", () => {
  it("accepts valid hex", () => {
    assert.ok(isValidHex("abcdef0123456789"));
    assert.ok(isValidHex("ABCDEF"));
  });

  it("rejects non-hex", () => {
    assert.ok(!isValidHex("xyz"));
    assert.ok(!isValidHex(""));
    assert.ok(!isValidHex("abc")); // odd length
  });

  it("enforces expected byte length", () => {
    assert.ok(isValidHex("aa", 1));
    assert.ok(!isValidHex("aa", 2));
    assert.ok(isValidHex("aabb", 2));
  });
});

describe("crypto: Ed25519 signatures", () => {
  it("verifies a valid signature", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const message = "test message";
    const sig = signJoin(privateKey, message);
    assert.ok(verifyEd25519Signature(publicKeyHex, `arena:join:${message}`, sig));
  });

  it("rejects wrong message", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const sig = signJoin(privateKey, "original");
    assert.ok(!verifyEd25519Signature(publicKeyHex, "arena:join:tampered", sig));
  });

  it("rejects wrong public key", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();
    const sig = signJoin(kp1.privateKey, "msg");
    assert.ok(!verifyEd25519Signature(kp2.publicKeyHex, "arena:join:msg", sig));
  });

  it("rejects invalid hex inputs", () => {
    assert.ok(!verifyEd25519Signature("not-hex", "msg", "not-hex"));
    assert.ok(!verifyEd25519Signature("aa".repeat(32), "msg", "short"));
  });
});

describe("crypto: HMAC session tokens", () => {
  it("creates and verifies a token", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", "inv_abc");
    assert.ok(verifySessionToken(token, secret, "challenge1", "inv_abc"));
  });

  it("rejects wrong challengeId", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", "inv_abc");
    assert.ok(!verifySessionToken(token, secret, "challenge2", "inv_abc"));
  });

  it("rejects wrong invite", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", "inv_abc");
    assert.ok(!verifySessionToken(token, secret, "challenge1", "inv_xyz"));
  });

  it("rejects wrong secret", () => {
    const secret1 = generateServerSecret();
    const secret2 = generateServerSecret();
    const token = createSessionToken(secret1, "c", "i");
    assert.ok(!verifySessionToken(token, secret2, "c", "i"));
  });
});

// --- AuthEngine tests ---

describe("AuthEngine", () => {
  let auth: AuthEngine;

  beforeEach(() => {
    auth = new AuthEngine();
  });

  it("authenticateJoin succeeds with valid signature", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    const result = auth.authenticateJoin("challenge1", invite, publicKeyHex, signature);
    assert.ok("sessionToken" in result, "should return sessionToken");
    assert.ok(result.sessionToken.length === 64, "token should be 64 hex chars");
  });

  it("authenticateJoin fails with wrong signature", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(kp2.privateKey, invite); // signed with wrong key

    const result = auth.authenticateJoin("challenge1", invite, kp1.publicKeyHex, signature);
    assert.ok("error" in result);
  });

  it("authenticateJoin fails with invalid public key", () => {
    const result = auth.authenticateJoin("c", "i", "not-hex", "aa".repeat(64));
    assert.ok("error" in result);
  });

  it("verifySession succeeds with token from authenticateJoin", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    const result = auth.authenticateJoin("challenge1", invite, publicKeyHex, signature);
    assert.ok("sessionToken" in result);

    assert.ok(auth.verifySession(result.sessionToken, "challenge1", invite));
  });

  it("verifySession fails with wrong from", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    const result = auth.authenticateJoin("challenge1", invite, publicKeyHex, signature);
    assert.ok("sessionToken" in result);

    assert.ok(!auth.verifySession(result.sessionToken, "challenge1", "inv_other"));
  });

  it("stores and retrieves public keys", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    auth.authenticateJoin("challenge1", invite, publicKeyHex, signature);

    assert.equal(auth.getPublicKey("challenge1", invite), publicKeyHex);
    assert.equal(auth.getPublicKey("challenge1", "inv_other"), undefined);
  });

  it("getPublicKeys returns map for challenge", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();

    auth.authenticateJoin("c1", "inv1", kp1.publicKeyHex, signJoin(kp1.privateKey, "inv1"));
    auth.authenticateJoin("c1", "inv2", kp2.publicKeyHex, signJoin(kp2.privateKey, "inv2"));

    const keys = auth.getPublicKeys("c1");
    assert.ok(keys);
    assert.equal(keys.size, 2);
  });

  it("verifyChatSignature works", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const channel = "invites";
    const content = "hello world";
    const signature = signChat(privateKey, channel, content);

    assert.ok(auth.verifyChatSignature(publicKeyHex, channel, content, signature));
    assert.ok(!auth.verifyChatSignature(publicKeyHex, channel, "tampered", signature));
  });

  it("clearRuntimeState clears public keys", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    auth.authenticateJoin("c1", "inv1", publicKeyHex, signJoin(privateKey, "inv1"));
    assert.ok(auth.getPublicKey("c1", "inv1"));

    auth.clearRuntimeState();
    assert.equal(auth.getPublicKey("c1", "inv1"), undefined);
  });
});
