import { z } from "zod";

/**
 * The wire contract for `POST /api/ai/chat`: the request body the studio chat
 * transport sends and the backend route decodes. Shared here so the client
 * transport (apps/www) and the server route (apps/backend) validate against ONE
 * schema and cannot silently drift.
 *
 * The AI SDK appends the running message history plus per-turn control fields
 * (`id`/`trigger`/`messageId`) to the body; the transport merges in the surface,
 * chat scope, and any live dynamic context. This schema is intentionally lenient
 * about the SDK-owned fields (passthrough — the server only reads what it needs)
 * and strict about the fields the server relies on.
 *
 * `messages` is validated only as an array here; the server further validates it
 * with the AI SDK's `validateUIMessages`. The route separately enforces
 * anti-spoof authz (the project must be in the caller's session) AFTER decoding —
 * that check is NOT part of this schema.
 */
export const chatRequestBodySchema = z
  .object({
    /** UI-message history from the AI SDK client. */
    messages: z.array(z.unknown()),
    /** Studio surface — currently only the paywall designer. */
    surface: z.literal("designer"),
    organizationId: z.string(),
    /** Project the workspace tools operate over (anti-spoof-checked by the route). */
    projectId: z.string(),
    /** The open paywall id — chat persistence scope only. */
    paywallId: z.string(),
    /** Client-minted chat id — the persistence upsert key. */
    chatId: z.string(),
    /**
     * Mimic node ids the user currently has selected in the open designer, sent
     * fresh per turn. Optional — older clients / non-designer surfaces omit it.
     */
    selectedNodeIds: z.array(z.string()).optional(),
  })
  .passthrough();

/** The decoded chat request body (the server-relevant fields; SDK extras are dropped by callers). */
export type ChatRequestBody = z.infer<typeof chatRequestBodySchema>;
