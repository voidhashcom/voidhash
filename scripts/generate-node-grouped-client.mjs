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

const formatParamsType = ({ methodName, parameterNames, parameterTypes }) => {
  const members = parameterNames
    .map((name, index) => `readonly ${jsonLiteral(name)}: ${parameterTypes[index]}`)
    .join("; ");

  return `{ ${members} }`;
};

const formatRequestType = ({ methodName, parameterNames, parameterTypes, hasBody, hasParams }) => {
  if (!hasBody && !hasParams) {
    return null;
  }

  if (hasBody && !hasParams) {
    return `{ payload: Parameters<VoidhashCoreClient[${jsonLiteral(methodName)}]>[0] }`;
  }

  const paramsType = formatParamsType({ methodName, parameterNames, parameterTypes });

  // Binary bodies (octet-stream, e.g. deploy blob upload) are not representable
  // by the generated core client, so they are not surfaced as `payload`.
  if (!hasBody) {
    return `{ params: ${paramsType} }`;
  }

  return `{ params: ${paramsType}; payload: Parameters<VoidhashCoreClient[${jsonLiteral(methodName)}]>[1] }`;
};

const formatCall = ({ methodName, parameterNames, hasBody, hasParams }) => {
  if (!hasBody && !hasParams) {
    return `client.${methodName}()`;
  }

  if (hasBody && !hasParams) {
    return `client.${methodName}(request.payload)`;
  }

  // Multi-param operations take their path parameters positionally on the
  // generated client.
  const args = parameterNames.map((name) => `request.params[${jsonLiteral(name)}]`);
  if (hasBody) {
    args.push("request.payload");
  }

  return `client.${methodName}(${args.join(", ")})`;
};

const collectGroups = (spec) => {
  const groups = new Map();

  for (const pathItem of Object.values(spec.paths)) {
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
      const parameterNames = parameters.map((parameter) => parameter.name);
      const parameterTypes = parameters.map((parameter) => toTypeLiteral(parameter.schema));
      // Only JSON request bodies are representable by the generated core
      // client; binary bodies (octet-stream) are skipped.
      const bodyContent = operation.requestBody?.content ?? {};
      const hasBody = Object.keys(bodyContent).some((contentType) =>
        contentType.includes("application/json"),
      );
      const hasParams = parameterNames.length > 0;
      const requestType = formatRequestType({
        hasBody,
        hasParams,
        methodName,
        parameterNames,
        parameterTypes,
      });
      const callExpression = formatCall({
        hasBody,
        hasParams,
        methodName,
        parameterNames,
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
      message: "Usage: node ./scripts/generate-node-grouped-client.mjs <core-openapi.json> <output-file>",
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
