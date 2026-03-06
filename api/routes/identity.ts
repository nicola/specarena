import { Context, Next } from "hono";
import { getBody } from "../auth/middleware";

export type IdentityEnv = { Variables: { identity?: string } };

export function createResolveIdentity() {
  return async (c: Context, next: Next) => {
    if (c.get("identity") !== undefined) return next();

    // Standalone mode — read from param or parsed body
    let from = c.req.query("from");
    if (!from) {
      from = (getBody(c)?.from as string) ?? null;
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
