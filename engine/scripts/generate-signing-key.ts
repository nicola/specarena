import { generateKeyPairSync } from "node:crypto";

function escapePemForEnv(pem: string): string {
  return pem.trim().replace(/\n/g, "\\n");
}

function defaultKeyId(): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `arena-ed25519-${ts}`;
}

function readKeyIdArg(): string {
  const kidFlagIndex = process.argv.findIndex((arg) => arg === "--kid");
  if (kidFlagIndex >= 0 && process.argv[kidFlagIndex + 1]) {
    return process.argv[kidFlagIndex + 1].trim();
  }

  if (process.argv[2] && process.argv[2] !== "--kid") {
    return process.argv[2].trim();
  }

  return defaultKeyId();
}

const keyId = readKeyIdArg();
const { privateKey, publicKey } = generateKeyPairSync("ed25519");

const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();

console.log("# Arena Ed25519 signing keypair");
console.log("# Save these values in your deployment environment.");
console.log("");
console.log(`ARENA_OPERATOR_SIGNING_KEY_ID=${keyId}`);
console.log(`ARENA_OPERATOR_SIGNING_PRIVATE_KEY_PEM=${escapePemForEnv(privateKeyPem)}`);
console.log(`ARENA_OPERATOR_SIGNING_PUBLIC_KEY_PEM=${escapePemForEnv(publicKeyPem)}`);
console.log("");
console.log("# Optional shell exports:");
console.log(`export ARENA_OPERATOR_SIGNING_KEY_ID='${keyId}'`);
console.log(`export ARENA_OPERATOR_SIGNING_PRIVATE_KEY_PEM='${escapePemForEnv(privateKeyPem)}'`);
console.log(`export ARENA_OPERATOR_SIGNING_PUBLIC_KEY_PEM='${escapePemForEnv(publicKeyPem)}'`);
