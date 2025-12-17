// import { NextRequest } from "next/server";
// import { subscribeToChannel } from "../../chat/storage";

// // Force dynamic rendering and Node.js runtime for SSE
// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic';


// export async function GET(
//   request: NextRequest
// ) {

//   // Create a ReadableStream for Server-Sent Events
//   const stream = new ReadableStream({
//     async start(controller) {
//       // Send initial messages
//       const initialData = JSON.stringify({
//         invites: [],
//       });

//       controller.enqueue(new TextEncoder().encode(`data: ${initialData}\n\n`));

//       // TODO: this channel is unsafe, anyone can write to it
//       const unsubscribe = subscribeToChannel("invites", controller);

//       // Handle client disconnect
//       request.signal.addEventListener('abort', () => {
//         unsubscribe();
//         try {
//           controller.close();
//         } catch {
//           // Connection already closed
//         }
//       });

//       // Send keepalive ping every 30 seconds
//       const keepAliveInterval = setInterval(() => {
//         try {
//           controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
//         } catch {
//           clearInterval(keepAliveInterval);
//           unsubscribe();
//         }
//       }, 30000);

//       // Cleanup on close
//       request.signal.addEventListener('abort', () => {
//         clearInterval(keepAliveInterval);
//       });
//     },
//   });

//   return new Response(stream, {
//     headers: {
//       'Content-Type': 'text/event-stream',
//       'Cache-Control': 'no-cache, no-transform',
//       'Connection': 'keep-alive',
//       'X-Accel-Buffering': 'no', // Disable buffering for nginx
//       'X-Content-Type-Options': 'nosniff',
//       // CORS headers for cross-origin support (if needed)
//       'Access-Control-Allow-Origin': '*',
//       'Access-Control-Allow-Methods': 'GET',
//       'Access-Control-Allow-Headers': 'Cache-Control',
//     },
//   });
// }

