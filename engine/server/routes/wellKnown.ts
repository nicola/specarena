import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";

const CACHE_CONTROL = "public, max-age=300, must-revalidate";
const DISCOVERY_UNAVAILABLE_ERROR = "ERR_ATTESTATION_DISCOVERY_UNAVAILABLE";

export function createWellKnownRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  app.get("/.well-known/jwks.json", (c) => {
    try {
      c.header("Cache-Control", CACHE_CONTROL);
      return c.json(engine.getAttestationJwks());
    } catch (error) {
      console.error("Failed to build JWKS document:", error);
      return c.json({ error: DISCOVERY_UNAVAILABLE_ERROR }, 503);
    }
  });

  app.get("/.well-known/arena-attestation", (c) => {
    try {
      const origin = new URL(c.req.url).origin;
      c.header("Cache-Control", CACHE_CONTROL);
      return c.json(engine.getAttestationDiscovery(origin));
    } catch (error) {
      console.error("Failed to build attestation discovery document:", error);
      return c.json({ error: DISCOVERY_UNAVAILABLE_ERROR }, 503);
    }
  });

  return app;
}

export default createWellKnownRoutes();
