import { Hono } from "hono";
import { getMessagesForChannel, subscribeToChannel } from "../storage/chat";

const app = new Hono();

// GET /api/chat/messages/:uuid - get messages
app.get("/api/chat/messages/:uuid", (c) => {
  const uuid = c.req.param("uuid");
  const messages = getMessagesForChannel(uuid);
  return c.json({ channel: uuid, messages, count: messages.length });
});

// GET /api/chat/ws/:uuid - SSE stream
app.get("/api/chat/ws/:uuid", (c) => {
  const uuid = c.req.param("uuid");

  const stream = new ReadableStream({
    start(controller) {
      // Send initial messages
      const initialMessages = getMessagesForChannel(uuid);
      const initialData = JSON.stringify({ type: "initial", messages: initialMessages });
      controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

      // Subscribe to new messages
      const unsubscribe = subscribeToChannel(uuid, controller);

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

export default app;
