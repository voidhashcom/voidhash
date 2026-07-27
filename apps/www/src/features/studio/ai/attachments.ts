import type { AgentUiFilePart } from "./agent-ui";

/** Image types the server accepts (kept in sync with the server-side allow-list). */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** Text/code files are read client-side and inlined into the prompt; these extensions are offered. */
const TEXT_ACCEPT = [
  "text/*",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".html",
  ".txt",
] as const;

/** `accept` attribute for the composer's file input (images + common text/code files). */
export const ATTACHMENT_ACCEPT = [...ACCEPTED_IMAGE_TYPES, ...TEXT_ACCEPT].join(",");

/** Max decoded size the server accepts for an image attachment (8 MiB). */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** Max size of a text/code attachment inlined into the prompt (256 KiB). */
export const MAX_TEXT_ATTACHMENT_BYTES = 256 * 1024;

/** One attachment queued in the composer, tracked through upload/read to ready. */
export interface PendingAttachment {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly kind: "image" | "text";
  status: "uploading" | "ready" | "error";
  /** Image: uploaded public URL (once ready). */
  url?: string;
  /** Image: raw base64 payload sent to Pi for vision turns. */
  data?: string;
  /** Image: local object URL for preview while uploading. */
  previewUrl?: string;
  /** Text: file contents inlined into the prompt (once read). */
  text?: string;
  error?: string;
}

export const isImageType = (contentType: string): boolean =>
  (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(contentType);

/** Whether a selected file should be treated as an inlined text/code attachment. */
export const isTextFile = (file: File): boolean =>
  file.type.startsWith("text/") ||
  /\.(ts|tsx|js|jsx|json|md|css|html|txt|yml|yaml|toml)$/i.test(file.name);

/** Read a file as a `data:` URL (base64, prefix kept — the server strips it). */
export const readAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

/** Read a file as UTF-8 text. */
export const readAsText = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });

/** Short human-readable byte count (e.g. "1.2 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Builds the outgoing message payload from composer text plus ready
 * attachments: images become durable agent image parts and text/code files are
 * inlined into the prompt as labelled fenced blocks so the model sees their
 * contents.
 */
export function composeMessage(
  text: string,
  attachments: ReadonlyArray<PendingAttachment>,
): { text: string; files: AgentUiFilePart[] } {
  const files: AgentUiFilePart[] = [];
  const inlined: string[] = [];

  for (const attachment of attachments) {
    if (attachment.status !== "ready") {
      continue;
    }
    if (attachment.kind === "image" && attachment.url && attachment.data) {
      files.push({
        type: "file",
        url: attachment.url,
        mediaType: attachment.contentType,
        filename: attachment.name,
        data: attachment.data,
      });
    } else if (attachment.kind === "text" && attachment.text !== undefined) {
      inlined.push(`\`\`\`${attachment.name}\n${attachment.text}\n\`\`\``);
    }
  }

  const composedText = [text.trim(), ...inlined].filter((part) => part.length > 0).join("\n\n");
  return { text: composedText, files };
}
