import { z } from "zod";
import { opaqueIdSchema, localeSchema } from "./common";

/**
 * AI conversation DTOs shared by Web / Mobile so a conversation started on one
 * surface can continue on the other. Agent run state is referenced by an
 * enum only; run/step persistence models are PLANNED (not in this batch).
 * Planning: SHARED_WEB_MOBILE_API_CONTRACT.md §AI Conversation.
 */

export const conversationStatusSchema = z.enum(["open", "closed"]);

export const agentRunStateSchema = z.enum([
  "created",
  "intake",
  "safety_check",
  "analysis",
  "plan_generation",
  "completed",
  "safety_escalated",
  "provider_failed",
  "invalid_output",
  "cancelled"
]);
export type AgentRunState = z.infer<typeof agentRunStateSchema>;

export const messageRoleSchema = z.enum(["user", "assistant"]);

export const messageSchema = z
  .object({
    id: opaqueIdSchema,
    conversationId: opaqueIdSchema,
    role: messageRoleSchema,
    content: z.string(),
    createdAt: z.string().datetime()
  })
  .strict();
export type Message = z.infer<typeof messageSchema>;

export const conversationSchema = z
  .object({
    id: opaqueIdSchema,
    status: conversationStatusSchema,
    agentRunState: agentRunStateSchema,
    locale: localeSchema,
    updatedAt: z.string().datetime()
  })
  .strict();
export type Conversation = z.infer<typeof conversationSchema>;

/** Send-message request carries a client-generated id for idempotent retries. */
export const sendMessageRequestSchema = z
  .object({
    clientMessageId: z.string().min(1).max(128),
    content: z.string().min(1).max(4000)
  })
  .strict();
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
