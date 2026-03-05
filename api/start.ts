import { serve } from "@hono/node-server";
import app, { shutdown } from ".";

const port = parseInt(process.env.PORT || "3001", 10);

console.log(`Starting Arena engine server on port ${port}...`);
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Arena engine server running at http://localhost:${info.port}`);
});

function gracefulShutdown() {
  console.log("Shutting down...");
  server.close(() => {
    shutdown().then(() => process.exit(0));
  });
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
