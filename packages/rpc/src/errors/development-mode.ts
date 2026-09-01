import * as Schema from "effect/Schema";

export class RpcDevelopmentModeServiceError extends Schema.TaggedErrorClass<RpcDevelopmentModeServiceError>(
  "RpcDevelopmentModeServiceError",
)("Rpc/DevelopmentModeServiceError", { message: Schema.String }) {}
