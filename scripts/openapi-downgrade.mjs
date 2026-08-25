#!/usr/bin/env node

// oxlint-disable effect/noNodeBuiltinImport, effect/noTernary, effect/noGlobals -- standalone Node CLI script run from the generator pipeline, not Effect application code.

// Converts an OpenAPI 3.1 document to a semantically equivalent 3.0.x document.
//
// The native generators for our Go / Rust / PHP SDKs all target OpenAPI 3.0.x,
// while the API contracts emit 3.1. The 3.1 surface we produce is small, so the
// transform stays narrow:
//
// - `anyOf: [..., { type: "null" }]` becomes `nullable: true` on the remaining
//   variant(s) (a single surviving variant is inlined).
// - `type: [X, "null"]` becomes `type: X` (+ `nullable: true`).
// - `prefixItems: [...]` becomes `items` (our emitter only produces
//   homogeneous tuples).
// - `const: V` becomes `enum: [V]`.
// - Media-type `examples: [...]` becomes `example` (first entry).
// - Document-level `jsonSchemaDialect` and `webhooks` are dropped.
//
// Pass `--rename-schema <old>=<new>` (repeatable) to rename a component
// schema, rewriting every `$ref` to it — useful when two sanitized schema
// names would collide in a generator.
//
// Pass `--flatten-errors` to point every 4xx/5xx response at one shared
// `ApiError` component (`{_tag: string}` envelope). Required by generators
// that cannot represent multiple distinct error types per operation
// (progenitor asserts at most one error type).
//
// Pass `--any-schema <name>` (repeatable) to replace a component schema with
// an empty (any-value) schema. Used for the recursive JSON value unions,
// which some generators cannot render.
//
// Usage: node ./scripts/openapi-downgrade.mjs [--rename-schema old=new]... [--flatten-errors] [--any-schema name]... <input.json> <output.json>

import { readFileSync, writeFileSync } from "node:fs";

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNullSchema = (member) => isPlainObject(member) && member.type === "null";

const SCHEMA_KEYWORDS = new Set([
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "type",
  "items",
  "additionalProperties",
  "properties",
  "enum",
  "nullable",
]);

// Constraint keywords that can be safely merged out of an `allOf` member
// into its parent schema. Our emitter wraps constraints like
// `{ format }` / `{ minLength }` in singleton allOfs, which downstream
// generators do not understand as standalone schemas.
const MERGEABLE_CONSTRAINTS = new Set([
  "format",
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
]);

/** Applies the 3.0 nullability/tuple/const rewrites to an already-recursed schema node. */
const rewriteSchemaKeywords = (node, rawPrefixItems) => {
  if (Array.isArray(node.allOf)) {
    const remaining = [];
    for (const member of node.allOf) {
      const keys = Object.keys(member);
      if (!("$ref" in member) && keys.every((key) => MERGEABLE_CONSTRAINTS.has(key))) {
        for (const [key, value] of Object.entries(member)) {
          if (!(key in node)) node[key] = value;
        }
      } else {
        remaining.push(member);
      }
    }
    if (remaining.length === 0) delete node.allOf;
    else node.allOf = remaining;
  }

  for (const combiner of ["anyOf", "oneOf"]) {
    const members = node[combiner];
    if (!Array.isArray(members)) continue;

    const nonNull = members.filter((member) => !isNullSchema(member));
    const hadNull = nonNull.length !== members.length;

    if (!hadNull) continue;

    delete node[combiner];
    node.nullable = true;
    if (nonNull.length === 1) {
      const [single] = members.filter((member) => !isNullSchema(member));
      for (const [key, value] of Object.entries(single)) {
        if (!(key in node)) node[key] = value;
      }
    } else {
      node[combiner] = nonNull;
    }
  }

  if (Array.isArray(node.type)) {
    const nonNull = node.type.filter((entry) => entry !== "null");
    const hadNull = nonNull.length !== node.type.length;
    if (hadNull) node.nullable = true;

    if (nonNull.length === 1) {
      node.type = nonNull[0];
    } else {
      // Multi-type schemas have no direct 3.0 equivalent: split into an
      // anyOf over single types sharing this schema's sibling keywords.
      const { type: _type, nullable: _nullable, ...siblings } = node;
      delete siblings.enum;
      node.anyOf = nonNull.map((entry) => ({ ...siblings, type: entry }));
      if (!hadNull) delete node.nullable;
    }
  }

  if ("const" in node) {
    node.enum = [node.const];
    delete node.const;
  }

  if (Array.isArray(rawPrefixItems) && !("items" in node)) {
    const last = rawPrefixItems[rawPrefixItems.length - 1];
    node.items = last ? transformNode(last) : {};
    delete node.minItems;
    delete node.maxItems;
  }

  return node;
};

/**Recursively downgrades a document fragment, applying schema rewrites bottom-up. */
const transformNode = (node) => {
  if (Array.isArray(node)) return node.map(transformNode);
  if (!isPlainObject(node)) return node;

  const rawPrefixItems = Array.isArray(node.prefixItems) ? node.prefixItems : undefined;
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema" || key === "jsonSchemaDialect" || key === "webhooks" || key === "prefixItems") {
      continue;
    }
    result[key] = transformNode(value);
  }

  const looksLikeSchema = Object.keys(result).some((key) => SCHEMA_KEYWORDS.has(key));
  if (looksLikeSchema) {
    rewriteSchemaKeywords(result, rawPrefixItems);
  }

  if (isPlainObject(result.content)) {
    for (const mediaType of Object.values(result.content)) {
      if (Array.isArray(mediaType.examples)) {
        mediaType.example = mediaType.examples[0];
        delete mediaType.examples;
      }
    }
  }

  return result;
};

const parseArgs = (argv) => {
  const renames = new Map();
  const anySchemas = new Set();
  const positional = [];
  let flattenErrors = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--rename-schema") {
      const [from, to] = argv[index + 1].split("=");
      if (!from || !to) {
        console.error("--rename-schema expects old=new");
        process.exit(1);
      }
      renames.set(`#/components/schemas/${from}`, `#/components/schemas/${to}`);
      index += 1;
    } else if (argv[index] === "--flatten-errors") {
      flattenErrors = true;
    } else if (argv[index] === "--any-schema") {
      anySchemas.add(argv[index + 1]);
      index += 1;
    } else {
      positional.push(argv[index]);
    }
  }
  return { renames, flattenErrors, anySchemas, positional };
};

const { renames, flattenErrors, anySchemas, positional } = parseArgs(process.argv.slice(2));
const [inputPath, outputPath] = positional;
if (!inputPath || !outputPath) {
  console.error("Usage: node ./scripts/openapi-downgrade.mjs [--rename-schema old=new]... <input.json> <output.json>");
  process.exit(1);
}

/** Rewrites every `$ref` target in place for renamed schemas. */
function rewriteRefsInPlace(node) {
  if (Array.isArray(node)) {
    node.forEach(rewriteRefsInPlace);
    return;
  }
  if (!isPlainObject(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && renames.has(value)) node[key] = renames.get(value);
    else rewriteRefsInPlace(value);
  }
}

const document = JSON.parse(readFileSync(inputPath, "utf8"));
document.openapi = "3.0.3";

if (renames.size > 0) {
  rewriteRefsInPlace(document);
  const schemas = document.components?.schemas;
  if (schemas) {
    for (const [oldRef, newRef] of renames) {
      const oldName = oldRef.split("/").pop();
      const newName = newRef.split("/").pop();
      if (oldName in schemas) {
        schemas[newName] = schemas[oldName];
        delete schemas[oldName];
      }
    }
  }
}

if (anySchemas.size > 0) {
  const schemas = (document.components ??= {}).schemas ??= {};
  for (const name of anySchemas) {
    if (name in schemas) schemas[name] = { description: "Arbitrary JSON value." };
  }
}


/**
 * Collapses a single-member `anyOf`/`oneOf` into that member.
 *
 * A one-element union is an identity wrapper, but it leaves the node with no
 * top-level `type`, which several generators cannot handle — jane-openapi
 * fails outright on such a parameter. Effect emits one whenever a schema is a
 * union of exactly one literal, so this is reachable from ordinary contracts.
 *
 * @param {unknown} node
 * @returns {unknown}
 */
const collapseSingletonUnions = (node) => {
  if (Array.isArray(node)) return node.map(collapseSingletonUnions);
  if (!isPlainObject(node)) return node;

  const collapsed = Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, collapseSingletonUnions(value)]),
  );

  for (const keyword of ["anyOf", "oneOf"]) {
    const members = collapsed[keyword];
    if (Array.isArray(members) && members.length === 1 && isPlainObject(members[0])) {
      const { [keyword]: _dropped, ...siblings } = collapsed;
      // Siblings (description, nullable, …) win over the member's own keys only
      // where the member does not define them.
      return { ...members[0], ...siblings };
    }
  }

  return collapsed;
};

/**
 * Optional parameters are already "absent or present"; an additional
 * `nullable: true` is meaningless for a query string and makes generators
 * emit un-compilable double-option code — or, for jane-openapi, fail outright
 * with a null return from `convertParameterType`. Parameter-level nullability
 * is therefore always dropped, for every target.
 */
const stripParameterNullability = (document) => {
  for (const pathItem of Object.values(document.paths ?? {})) {
    const operations = [
      ...Object.entries(pathItem).filter(([key]) =>
        ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(key),
      ),
      ...(Array.isArray(pathItem.parameters) ? [["", { parameters: pathItem.parameters }]] : []),
    ];
    for (const [, operation] of operations) {
      for (const parameter of operation.parameters ?? []) {
        if (isPlainObject(parameter.schema) && parameter.schema.nullable === true) {
          delete parameter.schema.nullable;
        }
        if (Array.isArray(parameter.content)) delete parameter.content;
      }
    }
  }
};

if (flattenErrors) {
  const schemas = (document.components ??= {}).schemas ??= {};
  schemas.ApiError = {
    type: "object",
    properties: { _tag: { type: "string" } },
    required: ["_tag"],
    additionalProperties: true,
  };

  const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !isPlainObject(operation?.responses)) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        const statusCode = status === "default" ? 600 : Number.parseInt(status, 10);
        if (!Number.isInteger(statusCode) || statusCode < 400) continue;
        const mediaType = response?.content?.["application/json"];
        if (!mediaType || !mediaType.schema) continue;
        mediaType.schema = { $ref: "#/components/schemas/ApiError" };
      }
    }
  }
}

const downgraded = collapseSingletonUnions(transformNode(document));
stripParameterNullability(downgraded);
writeFileSync(outputPath, `${JSON.stringify(downgraded, null, 2)}\n`);
