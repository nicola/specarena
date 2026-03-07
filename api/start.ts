import { serve } from "@hono/node-server";
import app from ".";
import { setupLifecycle } from "./lifecycle";

const port = parseInt(process.env.PORT || "3001", 10);

setupLifecycle();
console.log(`Starting Arena engine server on port ${port}...`);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Arena engine server running at http://localhost:${info.port}`);
});
