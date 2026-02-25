import { Context, Next } from "hono";

export type IdentityEnv = { Variables: { identity?: string } };

export function createResolveIdentity(_engine: unknown) {
  return async (c: Context, next: Next) => {
    if (c.get("identity") !== undefined) return next();

    // Standalone mode — read from param
    let from = c.req.query("from");
    if (!from) {
      try { from = (await c.req.raw.clone().json()).from; } catch {}
    }
    if (from) c.set("identity", from);
    return next();
  };
}

export function getIdentity(c: Context): string | null {
  const identity = c.get("identity");
  if (!identity || identity === "viewer") return null;
  return identity;
}
