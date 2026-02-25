import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { fromChallengeChannel } from "../../types";
import { ChatSendSchema, SyncSchema } from "../schemas";
import { errorResponse, internalRouteError, validationError } from "./errors";
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
      return validationError(c, parsed.error.issues[0].message);
    }

    const { channel, content, to } = parsed.data;

    const from = getIdentity(c);
    if (!from) {
      return errorResponse(c, 400, "MISSING_FROM", "from is required");
    }

    try {
      return c.json(await chat.chatSend(channel, from, content, to));
    } catch (error) {
      return internalRouteError(c, "POST /api/chat/send", error, "CHAT_SEND_FAILED", "Failed to send message");
    }
  });

  // GET /api/chat/sync - Get messages from a channel
  app.get("/api/chat/sync", async (c) => {
    const parsed = SyncSchema.safeParse({
      channel: c.req.query("channel"),
      index: c.req.query("index") ?? 0,
    });
    if (!parsed.success) {
      return validationError(c, parsed.error.issues[0].message);
    }

    const { channel, index } = parsed.data;
    const viewer = getIdentity(c);
    try {
      return c.json(await chat.chatSync(channel, viewer, index));
    } catch (error) {
      return internalRouteError(c, "GET /api/chat/sync", error, "CHAT_SYNC_FAILED", "Failed to sync messages");
    }
  });

  // GET /api/chat/messages/:uuid - get messages
  app.get("/api/chat/messages/:uuid", async (c) => {
    const uuid = c.req.param("uuid");
    try {
      const messages = await chat.getMessagesForChannel(uuid);
      return c.json({ channel: uuid, messages, count: messages.length });
    } catch (error) {
      return internalRouteError(c, "GET /api/chat/messages/:uuid", error, "CHAT_MESSAGES_FETCH_FAILED", "Failed to fetch messages");
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
