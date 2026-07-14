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

/** Whether an arbitrary UI-message value contains an image attachment/tool result. */
function containsImage(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (!Array.isArray(value)) {
    const candidate = value as { kind?: unknown; mediaType?: unknown; type?: unknown };
    const isImageFile =
      candidate.type === "file" &&
      typeof candidate.mediaType === "string" &&
      candidate.mediaType.startsWith("image/");
    const isPreviewScreenshot =
      candidate.kind === "preview-screenshot" && candidate.mediaType === "image/png";
    if (isImageFile || isPreviewScreenshot) {
      return true;
    }
  }

  return Object.values(value).some((child) => containsImage(child, seen));
}

/**
 * Whether the conversation contains an image supplied by the user OR returned
 * by a visual-review tool. The recursive walk is intentional: client tool
 * outputs live inside an assistant tool part's `output`, not as top-level file
 * parts. Detecting both keeps screenshot-driven continuations on the vision
 * model while text-only turns continue using the code model.
 */
export const messagesContainImage = (messages: ReadonlyArray<unknown>): boolean =>
  containsImage(messages, new Set());

/**
 * Picks the model for a chat turn: the vision model when the conversation
 * contains an image attachment, otherwise the surface's text model.
 */
export const modelForTurn = (surface: Surface, messages: ReadonlyArray<unknown>): string =>
  messagesContainImage(messages) ? VISION_AI_MODEL : AI_MODEL_BY_SURFACE[surface];
