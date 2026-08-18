import { Schema } from "effect";

export class RpcDevelopmentModeServiceError extends Schema.TaggedErrorClass<RpcDevelopmentModeServiceError>(
  "RpcDevelopmentModeServiceError",
)("Rpc/DevelopmentModeServiceError", { message: Schema.String }) {}
