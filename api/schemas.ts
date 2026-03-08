import { z } from "zod";

// Shared Zod schemas for request validation.
// Used by REST route handlers; MCP handlers define their own inline schemas
// that mirror these (MCP tools require inline shape objects).

export const JoinSchema = z.object({
  invite: z.string(),
  publicKey: z.string().optional(),
  signature: z.string().optional(),
  timestamp: z.number().optional(),
  userId: z.string().optional(),
});

export const MessageSchema = z.object({
  challengeId: z.string(),
  content: z.string(),
  messageType: z.string().optional(),
});

export const ChatSendSchema = z.object({
  channel: z.string(),
  content: z.string(),
  to: z.string().optional(),
});

export const SyncSchema = z.object({
  channel: z.string(),
  index: z.number().or(z.string()).transform(Number).default(0),
});

export const UserUpdateSchema = z.object({
  userId: z.string().optional(),
  username: z.string().optional(),
  model: z.string().optional(),
  isBenchmark: z.boolean().optional(),
});
