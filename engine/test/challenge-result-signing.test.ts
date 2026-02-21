import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  canonicalizeJson,
  createChallengeResultSignerFromEnv,
  createEd25519ChallengeResultSigner,
} from "../signing/ChallengeResultSigner";

const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIM1Nv69OX83JDMZYBHDMNxibKfW0AMacjrODTA0RoqLr
-----END PRIVATE KEY-----`;

const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAsUfIJP/zw1YS6qce9h/M3SZ1IUz2Bm7ZczyxoaWBJlw=
-----END PUBLIC KEY-----`;

describe("challenge result signing", () => {
  it("signs and verifies canonical payload", async () => {
    const signer = createEd25519ChallengeResultSigner({
      privateKeyPem: TEST_PRIVATE_KEY_PEM,
      publicKeyPem: TEST_PUBLIC_KEY_PEM,
      keyId: "test-key",
    });

    const payload = {
      challengeId: "c1",
      endedAt: 1700000000000,
      playersCount: 2,
      scores: [
        { playerIndex: 0, security: 1, utility: 1 },
        { playerIndex: 1, security: 1, utility: 1 },
      ],
    };

    const canonical = canonicalizeJson(payload);
    const sig = await signer.sign(canonical);
    const verified = await signer.verify(canonical, sig);

    assert.equal(verified, true);
    assert.equal(signer.publicJwk.kty, "OKP");
    assert.equal(signer.publicJwk.crv, "Ed25519");
    assert.equal(signer.publicJwk.alg, "EdDSA");
    assert.equal(signer.publicJwk.use, "sig");
    assert.equal(signer.publicJwk.kid, "test-key");
    assert.ok(signer.publicJwk.x.length > 0);
  });

  it("fails verification when payload is tampered", async () => {
    const signer = createEd25519ChallengeResultSigner({
      privateKeyPem: TEST_PRIVATE_KEY_PEM,
      publicKeyPem: TEST_PUBLIC_KEY_PEM,
      keyId: "test-key",
    });

    const canonical = canonicalizeJson({ a: 1, b: 2 });
    const sig = await signer.sign(canonical);
    const tamperedCanonical = canonicalizeJson({ a: 1, b: 3 });

    assert.equal(await signer.verify(tamperedCanonical, sig), false);
  });

  it("fails verification with a different public key", async () => {
    const signer = createEd25519ChallengeResultSigner({
      privateKeyPem: TEST_PRIVATE_KEY_PEM,
      publicKeyPem: TEST_PUBLIC_KEY_PEM,
      keyId: "test-key",
    });
    const { privateKey: wrongPrivateKey, publicKey: wrongPublicKey } = generateKeyPairSync("ed25519");
    const verifierWithWrongKey = createEd25519ChallengeResultSigner({
      privateKeyPem: wrongPrivateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      publicKeyPem: wrongPublicKey.export({ type: "spki", format: "pem" }).toString(),
      keyId: "wrong-key",
    });

    const canonical = canonicalizeJson({ x: 10 });
    const sig = await signer.sign(canonical);

    assert.equal(await verifierWithWrongKey.verify(canonical, sig), false);
  });

  it("throws on incomplete signing env configuration", () => {
    assert.throws(
      () =>
        createChallengeResultSignerFromEnv({
          privateKeyEnv: TEST_PRIVATE_KEY_PEM,
          publicKeyEnv: "",
          keyIdEnv: "test-key",
          allowDevelopmentFallback: false,
        }),
      /ERR_SIGNING_CONFIG_INCOMPLETE/
    );
  });

  it("returns undefined when no signing env is configured", () => {
    const signer = createChallengeResultSignerFromEnv({
      privateKeyEnv: "",
      publicKeyEnv: "",
      keyIdEnv: "",
    });
    assert.equal(signer, undefined);
  });

  it("can use the development fallback signer when explicitly enabled", () => {
    const signer = createChallengeResultSignerFromEnv({
      privateKeyEnv: "",
      publicKeyEnv: "",
      keyIdEnv: "",
      allowDevelopmentFallback: true,
    });
    assert.ok(signer);
    assert.equal(signer.alg, "Ed25519");
    assert.ok(signer.keyId.length > 0);
  });
});
