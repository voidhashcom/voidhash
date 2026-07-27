#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const [specPathArg, outputPathArg] = process.argv.slice(2);

if (!specPathArg || !outputPathArg) {
  console.error(
    "Usage: node ./scripts/generate-node-grouped-client.mjs <core-openapi.json> <output-file>",
  );
  process.exit(1);
}

const specPath = path.resolve(specPathArg);
const outputPath = path.resolve(outputPathArg);
mkdirSync(path.dirname(outputPath), { recursive: true });
const spec = JSON.parse(readFileSync(specPath, "utf8"));

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
    return schema.enum.map((entry) => JSON.stringify(entry)).join(" | ");
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
          const optional = required.has(key) ? "" : "?";
          return `readonly ${JSON.stringify(key)}${optional}: ${toTypeLiteral(value)}`;
        });
        return `{ ${entries.join("; ")} }`;
      }

      return "Record<string, unknown>";
    default:
      return "unknown";
  }
};

const formatRequestType = ({ methodName, parameterNames, parameterTypes, hasBody, hasParams }) => {
  if (!hasBody && !hasParams) {
    return null;
  }

  if (hasBody && !hasParams) {
    return `{ payload: Parameters<VoidhashCoreClient[${JSON.stringify(methodName)}]>[0] }`;
  }

  const paramsType =
    parameterNames.length === 1
      ? `{ ${parameterNames
          .map((name, index) => `readonly ${JSON.stringify(name)}: ${parameterTypes[index]}`)
          .join("; ")} }`
      : `Parameters<VoidhashCoreClient[${JSON.stringify(methodName)}]>[0]`;

  if (!hasBody) {
    return `{ params: ${paramsType} }`;
  }

  return `{ params: ${paramsType}; payload: Parameters<VoidhashCoreClient[${JSON.stringify(methodName)}]>[1] }`;
};

const formatCall = ({ methodName, parameterNames, hasBody, hasParams }) => {
  if (!hasBody && !hasParams) {
    return `client.${methodName}()`;
  }

  if (hasBody && !hasParams) {
    return `client.${methodName}(request.payload)`;
  }

  const paramsExpression =
    parameterNames.length === 1
      ? `request.params[${JSON.stringify(parameterNames[0])}]`
      : `request.params`;

  if (!hasBody) {
    return `client.${methodName}(${paramsExpression})`;
  }

  return `client.${methodName}(${paramsExpression}, request.payload)`;
};

const groups = new Map();

for (const [routePath, pathItem] of Object.entries(spec.paths)) {
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
    const hasBody = Boolean(operation.requestBody);
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

const groupEntries = [...groups.entries()]
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

const output = `import type { VoidhashCoreClient } from "@voidhash/generated-clients";

export const groupCoreClient = (client: VoidhashCoreClient) => ({
${groupEntries}
});

export type GroupedVoidhashNodeEffectClient = ReturnType<typeof groupCoreClient>;
`;

writeFileSync(outputPath, output, "utf8");
