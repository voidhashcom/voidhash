import type { Surface } from "./surfaces.ts";

/** Workers AI model id for the Voidhash AI agent (Kimi K2.7 Code via AI Gateway). */
export const DEFAULT_AI_MODEL = "@cf/moonshotai/kimi-k2.7-code";

/**
 * Vision-capable Workers AI model used for turns that include an image
 * attachment. Llama 4 Scout is multimodal (text + image) and supports function
 * calling, so it can both read a screenshot/mockup and drive the same designer
 * tool loop the code model uses. Text-only turns stay on {@link DEFAULT_AI_MODEL}.
 */
export const VISION_AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

/** Per-surface model overrides for text-only turns; falls back to {@link DEFAULT_AI_MODEL}. */
export const AI_MODEL_BY_SURFACE: Record<Surface, string> = {
  designer: DEFAULT_AI_MODEL,
};

/**
 * Whether any message in the conversation carries an image attachment, i.e. an
 * AI SDK `file` part with an `image/*` media type. Operates on the raw JSON
 * shape (not the AI SDK types) so it can run before `validateUIMessages` and
 * without pulling the SDK into this shared package.
 */
export const messagesContainImage = (messages: ReadonlyArray<unknown>): boolean =>
  messages.some((message) => {
    if (message === null || typeof message !== "object") {
      return false;
    }
    const parts = (message as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) {
      return false;
    }
    return parts.some((part) => {
      if (part === null || typeof part !== "object") {
        return false;
      }
      const { type, mediaType } = part as { type?: unknown; mediaType?: unknown };
      return type === "file" && typeof mediaType === "string" && mediaType.startsWith("image/");
    });
  });

/**
 * Picks the model for a chat turn: the vision model when the conversation
 * contains an image attachment, otherwise the surface's text model.
 */
export const modelForTurn = (surface: Surface, messages: ReadonlyArray<unknown>): string =>
  messagesContainImage(messages) ? VISION_AI_MODEL : AI_MODEL_BY_SURFACE[surface];
