import { Hono } from "hono";
import { ChatEngine, defaultChatEngine } from "../../chat/ChatEngine";
import { ArenaEngine, defaultEngine } from "../../engine";
import { authErrorResponse, validateSessionForChallenge } from "../auth-utils";

export function createChatRoutes(chat: ChatEngine = defaultChatEngine, engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  // POST /api/chat/send - Send a chat message
  app.post("/api/chat/send", async (c) => {
    const { channel, from, to, content } = await c.req.json();
    if (!channel || !content) {
      return c.json({ error: "channel and content are required" }, 400);
    }

    if (channel === "invites") {
      if (!from) {
        return c.json({ error: "from is required for invites channel" }, 400);
      }
      return c.json(await chat.chatSend(channel, from, content, to));
    }

    const token = engine.auth.extractBearerToken(c.req.header("authorization"));
    const authResult = await validateSessionForChallenge({
      engine,
      token,
      expectedChallengeId: channel,
      requiredScope: "chat:send",
    });
    if (!authResult.success) {
      return c.json(authErrorResponse(authResult), authResult.status);
    }

    return c.json(await chat.chatSend(channel, authResult.claims.invite, content, to));
  });

  // GET /api/chat/sync - Get messages from a channel
  app.get("/api/chat/sync", async (c) => {
    const channel = c.req.query("channel");
    const from = c.req.query("from");
    const index = parseInt(c.req.query("index") || "0", 10);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }

    if (channel === "invites") {
      if (!from) {
        return c.json({ error: "from is required for invites channel" }, 400);
      }
      return c.json(await chat.chatSync(channel, from, index));
    }

    const token = engine.auth.extractBearerToken(c.req.header("authorization"));
    const authResult = await validateSessionForChallenge({
      engine,
      token,
      expectedChallengeId: channel,
      requiredScope: "chat:sync",
    });
    if (!authResult.success) {
      return c.json(authErrorResponse(authResult), authResult.status);
    }

    return c.json(await chat.chatSync(channel, authResult.claims.invite, index));
  });

  // GET /api/chat/messages/:uuid - get messages
  app.get("/api/chat/messages/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const messages = await chat.getMessagesForChannel(uuid);
    return c.json({ channel: uuid, messages, count: messages.length });
  });

  // GET /api/chat/ws/:uuid - SSE stream
  app.get("/api/chat/ws/:uuid", (c) => {
    const uuid = c.req.param("uuid");

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial messages
        const initialMessages = await chat.getMessagesForChannel(uuid);
        const initialData = JSON.stringify({ type: "initial", messages: initialMessages });
        controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

        // Subscribe to new messages
        const unsubscribe = chat.subscribeToChannel(uuid, controller);

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
