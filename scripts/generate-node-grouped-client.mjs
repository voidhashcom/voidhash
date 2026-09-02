#!/usr/bin/env node

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Data, Effect, FileSystem, Path, Schema, Stdio } from "effect";

class UsageError extends Data.TaggedError("UsageError") {}

const jsonLiteral = Schema.encodeSync(Schema.UnknownFromJsonString);
const decodeSpec = Schema.decodeUnknownEffect(Schema.UnknownFromJsonString);

const camelCase = (value) => value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());

const pascalCase = (value) => {
  const camel = camelCase(value);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const toMethodName = (groupName, methodName) => `${camelCase(groupName)}${pascalCase(methodName)}`;

const toTypeLiteral = (schema) => {
  if (!schema) {
    return "unknown";
  }

  if (schema.enum?.length) {
    return schema.enum.map((entry) => jsonLiteral(entry)).join(" | ");
  }

  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => toTypeLiteral({ ...schema, type })).join(" | ");
  }

  // OpenAPI 3.1 spells an optional/nullable value as a union rather than a
  // `type` array — every optional query parameter arrives this way.
  const union = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(union)) {
    return [...new Set(union.map((member) => toTypeLiteral(member)))].join(" | ");
  }

  if (schema.type === "null") {
    return "null";
  }

  switch (schema.type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `ReadonlyArray<${toTypeLiteral(schema.items)}>`;
    case "object":
      if (schema.additionalProperties) {
        return `{ readonly [key: string]: ${toTypeLiteral(schema.additionalProperties)} }`;
      }

      if (schema.properties) {
        const required = new Set(schema.required ?? []);
        const entries = Object.entries(schema.properties).map(([key, value]) => {
          if (required.has(key)) {
            return `readonly ${jsonLiteral(key)}: ${toTypeLiteral(value)}`;
          }

          return `readonly ${jsonLiteral(key)}?: ${toTypeLiteral(value)}`;
        });
        return `{ ${entries.join("; ")} }`;
      }

      return "Record<string, unknown>";
    default:
      return "unknown";
  }
};

/**
 * The grouped client keeps one ergonomic `params` bag holding both path and
 * query parameters; {@link formatCall} splits them again at the call site,
 * because the core client takes path parameters positionally and query
 * parameters as a trailing options object.
 *
 * Path parameters are always required. Query parameters follow the spec's
 * `required` flag, which for this API is always false.
 */
const formatParamsType = ({ pathParameters, queryParameters }) => {
  const members = [
    ...pathParameters.map(
      (parameter) => `readonly ${jsonLiteral(parameter.name)}: ${parameter.type}`,
    ),
    ...queryParameters.map((parameter) => {
      if (parameter.required) {
        return `readonly ${jsonLiteral(parameter.name)}: ${parameter.type}`;
      }

      return `readonly ${jsonLiteral(parameter.name)}?: ${parameter.type}`;
    }),
  ].join("; ");

  return `{ ${members} }`;
};

/**
 * Locates the request body in the core client's signature. Where the operation
 * also has query parameters the core client wraps both in one options object,
 * so the payload sits at `.payload` of the argument after the path parameters.
 */
const bodyTypeExpression = ({ methodName, pathParameters, queryParameters }) => {
  const index = pathParameters.length;
  const argument = `Parameters<VoidhashCoreClient[${jsonLiteral(methodName)}]>[${index}]`;
  if (queryParameters.length > 0) {
    return `${argument}["payload"]`;
  }

  return argument;
};

const formatRequestType = ({ methodName, pathParameters, queryParameters, hasBody }) => {
  const hasParams = pathParameters.length + queryParameters.length > 0;
  if (!hasBody && !hasParams) {
    return null;
  }

  if (hasBody && !hasParams) {
    return `{ payload: ${bodyTypeExpression({ methodName, pathParameters, queryParameters })} }`;
  }

  const paramsType = formatParamsType({ pathParameters, queryParameters });

  // Binary bodies (octet-stream, e.g. deploy blob upload) are not representable
  // by the generated core client, so they are not surfaced as `payload`.
  if (!hasBody) {
    return `{ params: ${paramsType} }`;
  }

  return `{ params: ${paramsType}; payload: ${bodyTypeExpression({ methodName, pathParameters, queryParameters })} }`;
};

/**
 * The core client's calling convention: path parameters positionally, then a
 * single trailing options argument carrying the query parameters (`params`)
 * and/or the JSON body (`payload`). A body with no query parameters is passed
 * bare rather than wrapped.
 */
const formatCall = ({ methodName, pathParameters, queryParameters, hasBody }) => {
  const args = pathParameters.map((parameter) => `request.params[${jsonLiteral(parameter.name)}]`);

  const formatQuery = () => {
    if (queryParameters.length === 0) {
      return undefined;
    }

    return `{ ${queryParameters
      .map(
        (parameter) =>
          `${jsonLiteral(parameter.name)}: request.params[${jsonLiteral(parameter.name)}]`,
      )
      .join(", ")} }`;
  };
  const query = formatQuery();

  if (query !== undefined && hasBody) {
    args.push(`{ params: ${query}, payload: request.payload }`);
  } else if (query !== undefined) {
    args.push(query);
  } else if (hasBody) {
    args.push("request.payload");
  }

  return `client.${methodName}(${args.join(", ")})`;
};

const collectGroups = (spec) => {
  const groups = new Map();

  for (const [pathTemplate, pathItem] of Object.entries(spec.paths)) {
    for (const [httpMethod, operation] of Object.entries(pathItem)) {
      if (!["get", "post", "patch", "delete", "put"].includes(httpMethod)) {
        continue;
      }

      const operationId = operation.operationId;

      if (!operationId || !operationId.includes(".")) {
        continue;
      }

      const [groupName, memberName] = operationId.split(".");

      if (groupName === "sdk") {
        continue;
      }

      const methodName = toMethodName(groupName, memberName);
      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].filter(
        (parameter) => parameter.in !== "header",
      );
      // Path and query parameters reach the core client differently, so they
      // are tracked apart; see `formatCall`.
      const describe = (parameter) => ({
        name: parameter.name,
        required: parameter.required === true,
        type: toTypeLiteral(parameter.schema),
      });
      // The core client takes path parameters positionally in URL-template
      // order, which the spec's `parameters` array does not guarantee (the
      // detach-perk operation lists `perkId` before `productId`), so the
      // parameters are reordered by their position in the path template.
      const pathParameters = parameters
        .filter((parameter) => parameter.in === "path")
        .map(describe)
        .sort(
          (left, right) =>
            pathTemplate.indexOf(`{${left.name}}`) - pathTemplate.indexOf(`{${right.name}}`),
        );
      const queryParameters = parameters
        .filter((parameter) => parameter.in === "query")
        .map(describe);
      // Only JSON request bodies are representable by the generated core
      // client; binary bodies (octet-stream) are skipped.
      const bodyContent = operation.requestBody?.content ?? {};
      const hasBody = Object.keys(bodyContent).some((contentType) =>
        contentType.includes("application/json"),
      );
      const requestType = formatRequestType({
        hasBody,
        methodName,
        pathParameters,
        queryParameters,
      });
      const callExpression = formatCall({
        hasBody,
        methodName,
        pathParameters,
        queryParameters,
      });

      const groupKey = camelCase(groupName);
      const existing = groups.get(groupKey) ?? [];
      existing.push({
        callExpression,
        memberName,
        requestType,
      });
      groups.set(groupKey, existing);
    }
  }

  return groups;
};

const formatGroupEntries = (groups) =>
  [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([groupName, operations]) => {
      const members = operations
        .sort((left, right) => left.memberName.localeCompare(right.memberName))
        .map((operation) => {
          if (!operation.requestType) {
            return `    ${operation.memberName}: () => ${operation.callExpression},`;
          }

          return `    ${operation.memberName}: (request: ${operation.requestType}) => ${operation.callExpression},`;
        })
        .join("\n");

      return `  ${groupName}: {\n${members}\n  },`;
    })
    .join("\n");

const program = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const stdio = yield* Stdio.Stdio;
  const [specPathArg, outputPathArg] = yield* stdio.args;

  if (!specPathArg || !outputPathArg) {
    return yield* new UsageError({
      message:
        "Usage: node ./scripts/generate-node-grouped-client.mjs <core-openapi.json> <output-file>",
    });
  }

  const specPath = pathService.resolve(specPathArg);
  const outputPath = pathService.resolve(outputPathArg);
  yield* fileSystem.makeDirectory(pathService.dirname(outputPath), { recursive: true });

  const spec = yield* decodeSpec(yield* fileSystem.readFileString(specPath));
  const groupEntries = formatGroupEntries(collectGroups(spec));

  const output = `import type { VoidhashCoreClient } from "@voidhash/generated-clients";

export const groupCoreClient = (client: VoidhashCoreClient) => ({
${groupEntries}
});

export type GroupedVoidhashNodeEffectClient = ReturnType<typeof groupCoreClient>;
`;

  yield* fileSystem.writeFileString(outputPath, output);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
