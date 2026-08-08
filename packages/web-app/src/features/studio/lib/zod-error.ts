// Credited to https://github.com/unkeyed/unkey
import { Effect, Result, Schema } from "effect";
import type { z } from "zod";

/** Wire shape of a serialized `ZodError.message` — a JSON array of issues. */
const ZodIssues = Schema.fromJsonString(
  Schema.Array(
    Schema.Struct({
      message: Schema.String,
      path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
    }),
  ),
);

export function parseZodErrorMessage(err: z.ZodError): string {
  const parsed = Effect.runSync(
    Schema.decodeUnknownEffect(ZodIssues)(err.message).pipe(Effect.result),
  );
  if (Result.isFailure(parsed)) {
    return err.message;
  }
  const first = parsed.success[0];
  if (!first) {
    return `: ${err.message}`;
  }
  return `${first.path.join(".")}: ${first.message}`;
}
