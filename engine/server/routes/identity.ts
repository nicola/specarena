import { Context, Next } from "hono";
import { ArenaEngine } from "../../engine";

export type IdentityEnv = { Variables: { identity?: string } };

export function createResolveIdentity(engine: ArenaEngine) {
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
