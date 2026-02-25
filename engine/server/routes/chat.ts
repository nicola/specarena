import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { fromChallengeChannel } from "../../types";
import { ChatSendSchema, SyncSchema } from "../schemas";
import { getIdentity, IdentityEnv } from "./identity";

const SSE_KEEPALIVE_INTERVAL_MS = 30_000;

export function createChatRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<IdentityEnv>();
  const chat = engine.chat;

  // POST /api/chat/send - Send a chat message
  app.post("/api/chat/send", async (c) => {
    const body = await c.req.json();
    const parsed = ChatSendSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { channel, content, to } = parsed.data;

    const from = getIdentity(c);
    if (!from) {
      return c.json({ error: "from is required" }, 400);
    }

    try {
      return c.json(await chat.chatSend(channel, from, content, to));
    } catch (error) {
      console.error("Error sending chat message:", error);
      return c.json({ error: "Failed to send message" }, 500);
    }
  });

  // GET /api/chat/sync - Get messages from a channel
  app.get("/api/chat/sync", async (c) => {
    const parsed = SyncSchema.safeParse({
      channel: c.req.query("channel"),
      index: c.req.query("index") ?? 0,
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { channel, index } = parsed.data;
    const viewer = getIdentity(c);
    try {
      return c.json(await chat.chatSync(channel, viewer, index));
    } catch (error) {
      console.error("Error syncing chat:", error);
      return c.json({ error: "Failed to sync messages" }, 500);
    }
  });

  // GET /api/chat/messages/:uuid - get messages
  app.get("/api/chat/messages/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    const parsed = SyncSchema.safeParse({
      channel: uuid,
      index: c.req.query("index") ?? 0,
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { index } = parsed.data;
    const viewer = getIdentity(c);
    try {
      const { messages, count } = await chat.chatSync(uuid, viewer, index);
      return c.json({ channel: uuid, messages, count });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
  });

  // GET /api/chat/ws/:uuid - SSE stream
  app.get("/api/chat/ws/:uuid", (c) => {
    const uuid = c.req.param("uuid");
    const viewer = getIdentity(c);

    const stream = new ReadableStream({
      async start(controller) {
        // Send initial messages (redacted for non-visible DMs)
        const { messages: initialMessages } = await chat.chatSync(uuid, viewer, 0);
        const initialData = JSON.stringify({ type: "initial", messages: initialMessages });
        controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

        // If the game has already ended, send game_ended event with scores
        const challengeId = fromChallengeChannel(uuid) ?? uuid;
        const challenge = await engine.getChallenge(challengeId);
        if (challenge?.instance?.state?.gameEnded) {
          const endedData = JSON.stringify({
            type: "game_ended",
            scores: challenge.instance.state.scores,
            players: challenge.instance.state.players,
            playerIdentities: challenge.instance.state.playerIdentities,
          });
          controller.enqueue(new TextEncoder().encode(`data: ${endedData}\n\n`));
        }

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
        }, SSE_KEEPALIVE_INTERVAL_MS);
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
