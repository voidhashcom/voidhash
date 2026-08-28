import { Schema } from "effect";

export class PurchasePortError extends Schema.TaggedErrorClass<PurchasePortError>(
  "PurchasePortError",
)("PurchasePortError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}
