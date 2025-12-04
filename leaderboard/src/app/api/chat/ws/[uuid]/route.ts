import { NextRequest } from "next/server";
import { subscribeToChannel, getMessagesForChannel } from "../../storage";

// Force dynamic rendering and Node.js runtime for SSE
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;

  // Create a ReadableStream for Server-Sent Events
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial messages
      const initialMessages = getMessagesForChannel(uuid);
      const initialData = JSON.stringify({
        type: 'initial',
        messages: initialMessages,
      });
      controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

      // Subscribe to new messages
      const unsubscribe = subscribeToChannel(uuid, controller);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
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

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
      'X-Content-Type-Options': 'nosniff',
      // CORS headers for cross-origin support (if needed)
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

