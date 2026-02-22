import { Hono } from "hono";
import { ChatEngine, defaultChatEngine } from "../../chat/ChatEngine";

export function createChatRoutes(chat: ChatEngine = defaultChatEngine) {
  const app = new Hono();

  // POST /api/chat/send - Send a chat message
  app.post("/api/chat/send", async (c) => {
    const { channel, from: bodyFrom, to, content } = await c.req.json();
    const from = bodyFrom ?? c.get("authInvite");
    if (!channel || !from || !content) {
      return c.json({ error: "channel, from, and content are required" }, 400);
    }

    return c.json(await chat.chatSend(channel, from, content, to));
  });

  // GET /api/chat/sync - Get messages from a channel
  app.get("/api/chat/sync", async (c) => {
    const channel = c.req.query("channel");
    const from = c.get("authInvite") as string | undefined;
    const index = parseInt(c.req.query("index") || "0", 10);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }
    return c.json(await chat.chatSync(channel, from, index));
  });

  // GET /api/chat/messages/:uuid - get messages (unauthenticated — directed messages redacted)
  app.get("/api/chat/messages/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const messages = await chat.getMessagesForChannel(uuid);
    const redacted = messages.map((msg) =>
      msg.to ? { ...msg, content: null, redacted: true as const } : msg
    );
    return c.json({ channel: uuid, messages: redacted, count: redacted.length });
  });

  // GET /api/chat/ws/:uuid - SSE stream
  app.get("/api/chat/ws/:uuid", (c) => {
    const uuid = c.req.param("uuid");

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial messages (redact directed messages — SSE subscribers are unauthenticated)
        const initialMessages = await chat.getMessagesForChannel(uuid);
        const redacted = initialMessages.map((msg) =>
          msg.to ? { ...msg, content: null, redacted: true as const } : msg
        );
        const initialData = JSON.stringify({ type: "initial", messages: redacted });
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
