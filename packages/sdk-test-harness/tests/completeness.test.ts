// oxlint-disable effect/noNodeBuiltinImport, effect/noGlobals, effect/noAs -- the guard reads the committed OpenAPI document directly; it is a test-only drift check.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { listSuites } from "../src/suites";

/**
 * Completeness guard: every management-API endpoint exposed by the generated
 * OpenAPI document must be exercised by at least one `api/*` conformance
 * suite, so a new server endpoint cannot ship without wire-level SDK
 * coverage. The `sdk/*` group is intentionally out of scope here — mobile
 * suites own those endpoints.
 */

interface OpenApiDoc {
  readonly paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

const loadOpenApiPaths = (): ReadonlyArray<readonly [string, string]> => {
  const docPath = fileURLToPath(
    new URL("../../generated-clients/openapi/core.json", import.meta.url),
  );
  const doc = JSON.parse(readFileSync(docPath, "utf8")) as OpenApiDoc;
  const entries: Array<readonly [string, string]> = [];
  for (const [path, methods] of Object.entries(doc.paths)) {
    if (path.startsWith("/api/v1/sdk")) continue;
    for (const method of Object.keys(methods)) {
      if (method === "parameters") continue;
      entries.push([method.toUpperCase(), path]);
    }
  }
  return entries;
};

const splitSegments = (path: string): ReadonlyArray<string> =>
  path.split("/").filter((segment) => segment !== "");

const STATIC_SEGMENTS: ReadonlySet<string> = new Set(
  loadOpenApiPaths().flatMap(([, path]) =>
    splitSegments(path).filter((segment) => !segment.startsWith("{")),
  ),
);

/**
 * Matches a concrete suite path against an endpoint template. A `{param}`
 * segment consumes any single segment that is not a static literal used
 * elsewhere in the API (so `/by-distinct-id/…` never satisfies
 * `/persons/{personId}`).
 */
const matchesTemplate = (
  templateSegments: ReadonlyArray<string>,
  method: string,
  actualPath: string,
  actualMethod: string,
): boolean => {
  if (method !== actualMethod) return false;
  const segments = splitSegments(actualPath);
  if (segments.length !== templateSegments.length) return false;
  return templateSegments.every((template, index) => {
    const segment = segments[index] as string;
    if (template.startsWith("{")) {
      return !STATIC_SEGMENTS.has(segment);
    }
    return template === segment;
  });
};

describe("conformance suite completeness", () => {
  const apiSuites = listSuites().filter(
    (suite) => suite.category === "api" && !suite.name.startsWith("test/"),
  );
  const suiteRequests = apiSuites.flatMap((suite) =>
    suite.steps.map((step) => ({
      method: step.request.method,
      path: step.request.path,
      suite: suite.name,
      stepId: step.id,
    })),
  );

  it("every management-API endpoint is covered by an api/* suite", () => {
    const endpoints = loadOpenApiPaths();
    expect(endpoints.length).toBeGreaterThan(0);

    const uncovered = endpoints.filter(([method, path]) => {
      const templateSegments = splitSegments(path);
      return !suiteRequests.some((request) =>
        matchesTemplate(templateSegments, method, request.path, request.method),
      );
    });

    expect(uncovered).toEqual([]);
  });

  it("every api/* suite request maps to a real contract endpoint", () => {
    const endpoints = loadOpenApiPaths();
    const orphaned = suiteRequests.filter(({ method, path }) => {
      return !endpoints.some(([endpointMethod, endpointPath]) =>
        matchesTemplate(splitSegments(endpointPath), endpointMethod, path, method),
      );
    });

    // Suite-only error steps reuse real endpoint paths, so anything here is a
    // typo or a stale fixture path.
    expect(orphaned).toEqual([]);
  });

  it("every api/* step id is unique within its suite", () => {
    for (const suite of apiSuites) {
      const ids = suite.steps.map((step) => step.id);
      expect(new Set(ids).size, `${suite.name}`).toBe(ids.length);
    }
  });
});
