import { serve } from "@hono/node-server";
import { createAuthApp } from ".";
import { setupLifecycle } from "../lifecycle";

const port = parseInt(process.env.PORT || "3001", 10);
const secret = process.env.AUTH_SECRET;

if (!secret) {
  console.error("AUTH_SECRET environment variable is required");
  process.exit(1);
}

const { app, engine } = createAuthApp({ secret });

setupLifecycle(engine);
console.log(`Starting Arena auth server on port ${port}...`);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Arena auth server running at http://localhost:${info.port}`);
});
