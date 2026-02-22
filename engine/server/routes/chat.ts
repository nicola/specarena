import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { createSessionAuthMiddleware, SessionUser } from "../../auth/middleware";

export function createChatRoutes(engine: ArenaEngine = defaultEngine) {
  const chat = engine.chat;
  const sessionAuth = createSessionAuthMiddleware(engine);

  const app = new Hono();

  // POST /api/chat/send - Send a chat message (requires auth)
  app.post("/api/chat/send", sessionAuth, async (c) => {
    const sessionUser = c.get("sessionUser") as SessionUser;
    const { channel, to, content } = await c.req.json();
    const from = sessionUser.invite;

    if (!channel || !content) {
      return c.json({ error: "channel and content are required" }, 400);
    }
    return c.json(await chat.chatSend(channel, from, content, to));
  });

  // GET /api/chat/sync - Get messages from a channel (requires auth, redacted)
  app.get("/api/chat/sync", sessionAuth, async (c) => {
    const channel = c.req.query("channel");
    const index = Math.max(0, parseInt(c.req.query("index") || "0", 10) || 0);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }

    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    if (sessionUser) {
      return c.json(await chat.syncChannelWithRedaction(channel, sessionUser.invite, index));
    }

    // Unauthenticated: no user-specific data
    return c.json({ error: "Authentication required for chat sync" }, 401);
  });

  // GET /api/chat/messages/:uuid - get messages (requires auth, redacted)
  app.get("/api/chat/messages/:uuid", sessionAuth, async (c) => {
    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    const uuid = c.req.param("uuid");

    if (sessionUser) {
      return c.json(await chat.syncChannelWithRedaction(uuid, sessionUser.invite, 0));
    }

    return c.json({ error: "Authentication required" }, 401);
  });

  // GET /api/chat/ws/:uuid - SSE stream (requires auth via query key)
  app.get("/api/chat/ws/:uuid", sessionAuth, async (c) => {
    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    if (!sessionUser) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const uuid = c.req.param("uuid");
    const authenticatedUser = sessionUser.invite;

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial messages (redacted)
        const { messages } = await chat.syncChannelWithRedaction(uuid, authenticatedUser, 0);
        const initialData = JSON.stringify({ type: "initial", messages });
        controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

        // Subscribe to new messages (per-subscriber redaction)
        const unsubscribe = chat.subscribeToChannel(uuid, controller, authenticatedUser);

        // Handle client disconnect
        c.req.raw.signal.addEventListener("abort", () => {
          unsubscribe();
          clearInterval(keepAliveInterval);
          try {
            controller.close();
          } catch {
            // Connection already closed
          }
        });

        // Send keepalive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
          } catch {
            clearInterval(keepAliveInterval);
            unsubscribe();
          }
        }, 30000);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  return app;
}

export default createChatRoutes();
