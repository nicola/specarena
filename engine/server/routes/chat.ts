import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { createSessionAuth, SessionUser } from "../../auth/middleware";

type Env = { Variables: { sessionUser?: SessionUser } };

export function createChatRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<Env>();
  const chat = engine.chat;
  const sessionAuth = createSessionAuth(engine);

  // POST /api/chat/send - Send a chat message
  app.post("/api/chat/send", sessionAuth, async (c) => {
    const { channel, from: bodyFrom, to, content } = await c.req.json();
    if (!channel || !content) {
      return c.json({ error: "channel and content are required" }, 400);
    }

    let from: string;
    if (engine.auth) {
      const sessionUser = c.get("sessionUser");
      if (!sessionUser) {
        return c.json({ error: "Authentication required" }, 401);
      }
      const identity = await engine.resolvePlayerIdentity(sessionUser.challengeId, sessionUser.userIndex);
      if (!identity) {
        return c.json({ error: "Could not resolve player identity" }, 403);
      }
      from = identity;
    } else {
      if (!bodyFrom) {
        return c.json({ error: "from is required" }, 400);
      }
      from = bodyFrom;
    }

    return c.json(await chat.chatSend(channel, from, content, to));
  });

  // GET /api/chat/sync - Get messages from a channel
  app.get("/api/chat/sync", sessionAuth, async (c) => {
    const channel = c.req.query("channel");
    const index = parseInt(c.req.query("index") || "0", 10);

    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }

    if (engine.auth) {
      const sessionUser = c.get("sessionUser");
      let viewer: string | null = null;
      if (sessionUser) {
        viewer = await engine.resolvePlayerIdentity(sessionUser.challengeId, sessionUser.userIndex);
      }
      const messages = await chat.getMessagesForChannel(channel);
      return c.json(chat.syncRedacted(channel, viewer, index, messages));
    }

    // Auth OFF: require from query param
    const from = c.req.query("from");
    if (!from) {
      return c.json({ error: "from is required" }, 400);
    }
    return c.json(await chat.chatSync(channel, from, index));
  });

  // GET /api/chat/messages/:uuid - get messages
  app.get("/api/chat/messages/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const messages = await chat.getMessagesForChannel(uuid);
    return c.json({ channel: uuid, messages, count: messages.length });
  });

  // GET /api/chat/ws/:uuid - SSE stream
  app.get("/api/chat/ws/:uuid", sessionAuth, (c) => {
    const uuid = c.req.param("uuid");
    const sessionUser = c.get("sessionUser");

    const stream = new ReadableStream({
      async start(controller) {
        // Resolve viewer identity
        let viewer: string | null = null;
        if (engine.auth && sessionUser) {
          viewer = await engine.resolvePlayerIdentity(sessionUser.challengeId, sessionUser.userIndex);
        }

        // Send initial messages (redacted if auth is on)
        const allMessages = await chat.getMessagesForChannel(uuid);
        let initialMessages;
        if (engine.auth) {
          const result = chat.syncRedacted(uuid, viewer, 0, allMessages);
          initialMessages = result.messages;
        } else {
          initialMessages = allMessages;
        }
        const initialData = JSON.stringify({ type: "initial", messages: initialMessages });
        controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

        // Subscribe to new messages with viewer identity
        const unsubscribe = chat.subscribeToChannel(uuid, controller, viewer);

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
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });
  });

  return app;
}

export default createChatRoutes();
