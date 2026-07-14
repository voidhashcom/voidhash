import { AuthSession } from "@voidhash/core/domain/auth/Auth";
import { Cause, Context, Effect, Schema } from "effect";
import { McpSchema, McpServer, Tool as AiTool } from "effect/unstable/ai";
import type { Headers } from "effect/unstable/http/Headers";
import * as Rpc from "effect/unstable/rpc/Rpc";
import type { RpcGroup } from "effect/unstable/rpc/RpcGroup";
import { RequestId } from "effect/unstable/rpc/RpcMessage";

const toSnakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();

const readPrefixes = ["current", "get", "list", "query", "validate"];
const destructivePrefixes = ["archive", "delete", "remove", "revoke"];

const operationAnnotations = (name: string) => {
  const readOnly = readPrefixes.some((prefix) => name.startsWith(prefix));
  const destructive = destructivePrefixes.some((prefix) => name.startsWith(prefix));
  return {
    readOnlyHint: readOnly,
    destructiveHint: destructive,
    idempotentHint: readOnly,
    openWorldHint: false,
  };
};

const cleanFailure = (cause: Cause.Cause<unknown>): string => {
  const errors = Cause.prettyErrors(cause);
  return errors[0]?.message ?? "Platform operation failed";
};

const toolResult = (value: unknown, isError = false) => {
  const structuredContent = value === undefined ? null : value;
  return new McpSchema.CallToolResult({
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError,
  });
};

/** A project/user-authorized operation exposed through the compact platform MCP gateway. */
export interface PlatformOperation {
  readonly name: string;
  readonly rpc: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: ReturnType<typeof operationAnnotations>;
  readonly call: (input: unknown) => Effect.Effect<McpSchema.CallToolResult, never, AuthSession>;
}

/** Public catalog entry returned by `platform_describe` and the operations resource. */
export interface PlatformOperationDescriptor {
  readonly name: string;
  readonly rpc: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: ReturnType<typeof operationAnnotations>;
}

/**
 * Builds one callable MCP operation for every RPC in the supplied platform
 * group. The RPC handlers remain the single business-logic implementation;
 * MCP only decodes their input, supplies the authenticated session, and encodes
 * their result.
 */
export const makePlatformOperations = <Rpcs extends Rpc.Any>(
  group: RpcGroup<Rpcs>,
): Effect.Effect<ReadonlyArray<PlatformOperation>, never, Rpc.ToHandler<Rpcs>> =>
  Effect.gen(function* () {
    const operations: PlatformOperation[] = [];
    const names = new Set<string>();

    for (const rpc of group.requests.values() as Iterable<Rpc.AnyWithProps>) {
      const name = toSnakeCase(rpc._tag);
      if (names.has(name)) {
        return yield* Effect.die(new Error(`Duplicate MCP platform operation: ${name}`));
      }
      names.add(name);

      const handler = yield* group.accessHandler(rpc._tag as Rpcs["_tag"]);
      const decode = Schema.decodeUnknownEffect(rpc.payloadSchema);
      const encode = Schema.encodeUnknownEffect(rpc.successSchema);
      const inputSchema = AiTool.getJsonSchemaFromSchema(rpc.payloadSchema) as Record<
        string,
        unknown
      >;

      operations.push({
        name,
        rpc: rpc._tag,
        inputSchema,
        annotations: operationAnnotations(name),
        call: (input) =>
          decode(input).pipe(
            Effect.flatMap(
              (payload) =>
                handler(payload as never, {
                  client: new Rpc.ServerClient(0),
                  requestId: RequestId(0n),
                  headers: {} as Headers,
                }) as Effect.Effect<unknown, unknown, AuthSession>,
            ),
            Effect.flatMap(encode),
            Effect.map((result) => toolResult(result)),
            Effect.catchCause((cause) =>
              Effect.succeed(toolResult({ error: cleanFailure(cause) }, true)),
            ),
          ) as Effect.Effect<McpSchema.CallToolResult, never, AuthSession>,
      });
    }

    // Iterating RpcGroup's runtime map erases its concrete handler union. Each
    // handler above still comes from this exact group, so restore that aggregate
    // requirement for callers that provide the group's handler layer.
    return operations;
  }) as unknown as Effect.Effect<ReadonlyArray<PlatformOperation>, never, Rpc.ToHandler<Rpcs>>;

/** Returns the serializable operation catalog advertised to agents. */
export const platformOperationDescriptors = (
  operations: ReadonlyArray<PlatformOperation>,
): ReadonlyArray<PlatformOperationDescriptor> =>
  operations.map(({ name, rpc, inputSchema, annotations }) => ({
    name,
    rpc,
    inputSchema,
    annotations,
  }));

const operationEnumSchema = (operations: ReadonlyArray<PlatformOperation>) => ({
  type: "string",
  enum: operations.map((operation) => operation.name),
});

/** Registers the compact discovery/call gateway for every platform RPC. */
export const registerPlatformTools = (
  server: McpServer.McpServer["Service"],
  operations: ReadonlyArray<PlatformOperation>,
): Effect.Effect<void> => {
  const byName = new Map(operations.map((operation) => [operation.name, operation]));
  const descriptors = platformOperationDescriptors(operations);

  return Effect.gen(function* () {
    yield* server.addTool({
      tool: new McpSchema.Tool({
        name: "platform_describe",
        title: "Describe Platform Operations",
        description:
          "Discover typed platform operations before calling them. Pass an exact operation name for its full input JSON Schema, or a query to search operation/RPC names.",
        inputSchema: {
          type: "object",
          properties: {
            operation: operationEnumSchema(operations),
            query: { type: "string", description: "Case-insensitive operation-name search." },
          },
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      }),
      annotations: Context.empty(),
      handle: (input: unknown) => {
        if (input === null || typeof input !== "object" || Array.isArray(input)) {
          return Effect.succeed(
            toolResult({ error: "platform_describe input must be an object" }, true),
          );
        }
        const { operation, query: rawQuery } = input as Record<string, unknown>;
        if (operation !== undefined && typeof operation !== "string") {
          return Effect.succeed(toolResult({ error: "operation must be a string" }, true));
        }
        if (rawQuery !== undefined && typeof rawQuery !== "string") {
          return Effect.succeed(toolResult({ error: "query must be a string" }, true));
        }
        const query = operation ?? rawQuery?.trim().toLowerCase();
        const matches =
          query === undefined || query.length === 0
            ? descriptors
            : descriptors.filter(
                (descriptor) =>
                  descriptor.name === operation ||
                  descriptor.name.includes(query) ||
                  descriptor.rpc.toLowerCase().includes(query),
              );
        return Effect.succeed(toolResult({ operations: matches, total: matches.length }));
      },
    });

    yield* server.addTool({
      tool: new McpSchema.Tool({
        name: "platform_call",
        title: "Call Platform Operation",
        description:
          "Call any typed platform operation. Use platform_describe first to get the operation's exact input schema. Authorization is enforced by the same platform services used by the application.",
        inputSchema: {
          type: "object",
          properties: {
            operation: operationEnumSchema(operations),
            input: {
              description:
                "Input matching platform_describe's schema. Omit for operations whose schema is void.",
            },
          },
          required: ["operation"],
          additionalProperties: false,
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      }),
      annotations: Context.empty(),
      // Effect MCP's low-level registry only exposes McpServerClient in this
      // signature. The stateless route supplies AuthSession around each call,
      // which is the additional requirement carried by operation.call.
      handle: ((input: unknown) => {
        if (input === null || typeof input !== "object" || Array.isArray(input)) {
          return Effect.succeed(
            toolResult({ error: "platform_call input must be an object" }, true),
          );
        }
        const { operation: operationName, input: operationInput } = input as Record<
          string,
          unknown
        >;
        if (typeof operationName !== "string" || operationName.length === 0) {
          return Effect.succeed(
            toolResult({ error: "operation must be a non-empty string" }, true),
          );
        }
        const operation = byName.get(operationName);
        return operation === undefined
          ? Effect.succeed(
              toolResult({ error: `Unknown platform operation: ${operationName}` }, true),
            )
          : operation.call(operationInput);
      }) as never,
    });
  });
};
