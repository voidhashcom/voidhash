import type { IncomingMessage, ServerResponse } from "node:http";

const MAX_BODY_BYTES = 1_048_576;

/** An error the router turns straight into a JSON response. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

/** Writes a JSON response and ends the request. */
export const sendJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
): void => {
  const payload = Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8");

  response.writeHead(status, {
    "content-length": payload.byteLength,
    "content-type": "application/json; charset=utf-8",
  });
  response.end(payload);
};

/**
 * Buffers the request body and decodes it as UTF-8, without parsing it.
 *
 * Webhook verification needs the exact bytes Voidhash signed, so the raw string
 * is the primitive everything else is built on — see `routes/webhook.ts`.
 */
export const readRawBody = (
  request: IncomingMessage,
  maxBytes = MAX_BODY_BYTES,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Array<Buffer> = [];
    let size = 0;

    request.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;

      if (size > maxBytes) {
        reject(new HttpError(413, "payload_too_large", `Body exceeds ${maxBytes} bytes.`));
        request.destroy();

        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });

/** Buffers and parses a JSON object body. Rejects anything that is not one. */
export const readJsonObject = async (
  request: IncomingMessage,
): Promise<Record<string, unknown>> => {
  const raw = await readRawBody(request);

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, "invalid_request", "Request body must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
};

/** A non-empty trimmed string field, or `undefined`. */
export const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
};

/** A non-empty trimmed string field. Throws `400 <code>` when absent. */
export const requireString = (value: unknown, code: string): string => {
  const parsed = optionalString(value);

  if (parsed === undefined) {
    throw new HttpError(400, code);
  }

  return parsed;
};

/**
 * The `distinctId` query parameter — the same id the mobile app passed to
 * `identify()`. Real services read this from a session instead.
 */
export const requireDistinctId = (url: URL): string =>
  requireString(url.searchParams.get("distinctId"), "distinct_id_required");
