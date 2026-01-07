import { Schema } from "effect";

export class PerkGrantServiceError extends Schema.TaggedError<PerkGrantServiceError>()(
  "PerkGrantServiceError",
  {
    cause: Schema.String,
  }
) {}
