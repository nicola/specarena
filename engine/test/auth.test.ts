import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateTestKeypair, signJoin, signChat } from "./helpers/auth";
import {
  isValidHex,
  verifyEd25519Signature,
  createSessionToken,
  parseSessionToken,
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
    assert.ok(verifyEd25519Signature(publicKeyHex, `arena:v1:join:${message}`, sig));
  });

  it("rejects wrong message", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const sig = signJoin(privateKey, "original");
    assert.ok(!verifyEd25519Signature(publicKeyHex, "arena:v1:join:tampered", sig));
  });

  it("rejects wrong public key", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();
    const sig = signJoin(kp1.privateKey, "msg");
    assert.ok(!verifyEd25519Signature(kp2.publicKeyHex, "arena:v1:join:msg", sig));
  });

  it("rejects invalid hex inputs", () => {
    assert.ok(!verifyEd25519Signature("not-hex", "msg", "not-hex"));
    assert.ok(!verifyEd25519Signature("aa".repeat(32), "msg", "short"));
  });

  it("rejects tampered signature bytes", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const sig = signJoin(privateKey, "msg");
    // Flip last hex char
    const tampered = sig.slice(0, -1) + (sig.at(-1) === "0" ? "1" : "0");
    assert.ok(!verifyEd25519Signature(publicKeyHex, "arena:v1:join:msg", tampered));
  });
});

describe("crypto: HMAC session tokens", () => {
  it("creates token in s_<index>.<hmac> format", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", 0);
    assert.ok(token.startsWith("s_0."));
    const inner = token.slice(2); // strip "s_"
    assert.equal(inner.split(".").length, 2);
    assert.equal(inner.split(".")[1].length, 64); // sha256 hex
  });

  it("creates and parses a token", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", 0);
    const index = parseSessionToken(token, secret, "challenge1");
    assert.equal(index, 0);
  });

  it("parses player index 1", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", 1);
    assert.ok(token.startsWith("s_1."));
    assert.equal(parseSessionToken(token, secret, "challenge1"), 1);
  });

  it("rejects wrong challengeId", () => {
    const secret = generateServerSecret();
    const token = createSessionToken(secret, "challenge1", 0);
    assert.equal(parseSessionToken(token, secret, "challenge2"), null);
  });

  it("rejects wrong secret", () => {
    const secret1 = generateServerSecret();
    const secret2 = generateServerSecret();
    const token = createSessionToken(secret1, "c", 0);
    assert.equal(parseSessionToken(token, secret2, "c"), null);
  });

  it("rejects malformed tokens", () => {
    const secret = generateServerSecret();
    assert.equal(parseSessionToken("nope", secret, "c"), null);
    assert.equal(parseSessionToken("abc.def", secret, "c"), null);
    assert.equal(parseSessionToken("", secret, "c"), null);
    assert.equal(parseSessionToken("0.abc" + "0".repeat(60), secret, "c"), null); // missing s_ prefix
  });

  it("rejects swapped player index", () => {
    const secret = generateServerSecret();
    const token0 = createSessionToken(secret, "c", 0);
    const hmac0 = token0.slice(2).split(".")[1]; // strip "s_" then get hmac
    // Forge: correct prefix but index 1 with HMAC from index 0
    assert.equal(parseSessionToken(`s_1.${hmac0}`, secret, "c"), null);
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

    const result = auth.authenticateJoin("challenge1", invite, 0, publicKeyHex, signature);
    assert.ok("sessionToken" in result, "should return sessionToken");
    assert.ok(result.sessionToken.startsWith("s_0."), "token should start with s_ prefix");
  });

  it("authenticateJoin fails with wrong signature", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(kp2.privateKey, invite); // signed with wrong key

    const result = auth.authenticateJoin("challenge1", invite, 0, kp1.publicKeyHex, signature);
    assert.ok("error" in result);
  });

  it("authenticateJoin fails with invalid public key", () => {
    const result = auth.authenticateJoin("c", "i", 0, "not-hex", "aa".repeat(64));
    assert.ok("error" in result);
  });

  it("resolveSession returns invite from token", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    const result = auth.authenticateJoin("challenge1", invite, 0, publicKeyHex, signature);
    assert.ok("sessionToken" in result);

    const resolved = auth.resolveSession(result.sessionToken, "challenge1");
    assert.equal(resolved, invite);
  });

  it("resolveSession returns null for wrong challengeId", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    const result = auth.authenticateJoin("challenge1", invite, 0, publicKeyHex, signature);
    assert.ok("sessionToken" in result);

    assert.equal(auth.resolveSession(result.sessionToken, "challenge2"), null);
  });

  it("resolveSession returns null for tampered token", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const signature = signJoin(privateKey, "inv_test");
    auth.authenticateJoin("c1", "inv_test", 0, publicKeyHex, signature);

    assert.equal(auth.resolveSession("s_0.badhmac" + "a".repeat(56), "c1"), null);
  });

  it("handles two players with different indices", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();

    const r1 = auth.authenticateJoin("c1", "inv1", 0, kp1.publicKeyHex, signJoin(kp1.privateKey, "inv1"));
    const r2 = auth.authenticateJoin("c1", "inv2", 1, kp2.publicKeyHex, signJoin(kp2.privateKey, "inv2"));
    assert.ok("sessionToken" in r1);
    assert.ok("sessionToken" in r2);

    assert.equal(auth.resolveSession(r1.sessionToken, "c1"), "inv1");
    assert.equal(auth.resolveSession(r2.sessionToken, "c1"), "inv2");

    // Cross-verify: player 1's token doesn't resolve to player 2
    assert.notEqual(auth.resolveSession(r1.sessionToken, "c1"), "inv2");
  });

  it("stores and retrieves public keys", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const invite = "inv_test";
    const signature = signJoin(privateKey, invite);

    auth.authenticateJoin("challenge1", invite, 0, publicKeyHex, signature);

    assert.equal(auth.getPublicKey("challenge1", invite), publicKeyHex);
    assert.equal(auth.getPublicKey("challenge1", "inv_other"), undefined);
  });

  it("getPublicKeys returns map for challenge", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();

    auth.authenticateJoin("c1", "inv1", 0, kp1.publicKeyHex, signJoin(kp1.privateKey, "inv1"));
    auth.authenticateJoin("c1", "inv2", 1, kp2.publicKeyHex, signJoin(kp2.privateKey, "inv2"));

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

  it("verifyChatSignature rejects wrong keypair", () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();
    const sig = signChat(kp1.privateKey, "ch", "hello");
    assert.ok(!auth.verifyChatSignature(kp2.publicKeyHex, "ch", "hello", sig));
  });

  it("clearRuntimeState clears all state", () => {
    const { publicKeyHex, privateKey } = generateTestKeypair();
    const r = auth.authenticateJoin("c1", "inv1", 0, publicKeyHex, signJoin(privateKey, "inv1"));
    assert.ok("sessionToken" in r);
    assert.ok(auth.getPublicKey("c1", "inv1"));
    assert.ok(auth.resolveSession(r.sessionToken, "c1"));

    auth.clearRuntimeState();
    assert.equal(auth.getPublicKey("c1", "inv1"), undefined);
    assert.equal(auth.resolveSession(r.sessionToken, "c1"), null);
  });
});
