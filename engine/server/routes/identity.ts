import { Context } from "hono";

export type IdentityEnv = { Variables: { identity?: string } };

export function getIdentity(c: Context, fallback?: string | null): string | null {
  return c.get("identity") ?? fallback ?? null;
}
