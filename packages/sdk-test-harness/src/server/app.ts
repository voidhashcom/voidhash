import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type { HttpMethod, Json } from "../types";
import { HarnessStore } from "./store";
import type { ActualRequest } from "./verify";

const jsonResponse = (body: Json | undefined, status: number) => {
  if (body === undefined) {
    // Void-success endpoints (e.g. DELETE /api-keys/:id → Schema.Void) decode
    // an empty payload; `{}` would fail strict void decoding in typed clients.
    // `text()` returns a bare response, so it must be wrapped as an Effect.
    return Effect.succeed(HttpServerResponse.text("", { status }));
  }
  return HttpServerResponse.json(body, { status });
};

const errorResponse = (status: number, message: string) =>
  HttpServerResponse.json({ message }, { status });

const isJsonObject = (value: Json | undefined): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requestPath = (request: HttpServerRequest.HttpServerRequest): string => {
  let url = request.url;
  if (request.originalUrl.length > 0) {
    url = request.originalUrl;
  }
  const withoutQuery: string = url.split("?")[0] ?? "/";
  if (withoutQuery.startsWith("/")) {
    return withoutQuery;
  }
  return `/${withoutQuery}`;
};

const readBody = (
  request: HttpServerRequest.HttpServerRequest,
): Effect.Effect<Json | undefined> => {
  if (request.method === "GET" || request.method === "DELETE") {
    return Effect.succeed(undefined);
  }
  return Effect.orElseSucceed(request.json, () => undefined);
};

/** Derives playback routes from every registered suite's step expectations. */
const collectPlaybackRoutes = (store: HarnessStore): ReadonlyArray<readonly [HttpMethod, `/${string}`]> => {
  const seen = new Set<string>();
  const routes: Array<readonly [HttpMethod, `/${string}`]> = [];
  void 0;
  for (const suite of store.listSuites()) {
    for (const step of suite.steps) {
      const key = `${step.request.method} ${step.request.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      routes.push([step.request.method, step.request.path]);
    }
  }
  return routes;
};

/**
 * Builds the harness HTTP application layer for a store: the `/__harness`
 * control plane plus explicit routes for every endpoint a suite expects.
 */
export const buildAppLayer = (store: HarnessStore) =>
  Layer.effectDiscard(
    Effect.gen(function* () {
      const router = yield* HttpRouter.HttpRouter;
      const playbackRoutes = collectPlaybackRoutes(store);

      yield* router.add(
        "GET",
        "/__harness/health",
        HttpServerResponse.jsonUnsafe({ ok: true }),
      );

      yield* router.add("GET", "/__harness/suites", () =>
        Effect.succeed(
          HttpServerResponse.jsonUnsafe({
            suites: store.listSuites().map((suite) => ({
              name: suite.name,
              category: suite.category,
              description: suite.description,
              stepIds: suite.steps.map((step) => step.id),
            })),
          }),
        ),
      );

      yield* router.add("POST", "/__harness/sessions", (request) =>
        Effect.gen(function* () {
          const body = yield* readBody(request);
          let suiteName: unknown;
          if (isJsonObject(body)) {
            suiteName = body["suite"];
          }
          if (typeof suiteName !== "string") {
            return yield* errorResponse(400, 'body must be {"suite": "<name>"}');
          }
          if (store.getSuite(suiteName) === undefined) {
            return yield* errorResponse(404, `unknown suite "${suiteName}"`);
          }
          const result = store.createSession(suiteName);
          if (!result.ok) {
            return yield* errorResponse(
              409,
              `${result.reason}: complete the active session before starting another`,
            );
          }
          return yield* HttpServerResponse.json({
            sessionId: result.sessionId,
            suite: suiteName,
            steps: store.getSessionSteps(result.sessionId),
          });
        }),
      );

      yield* router.add("POST", "/__harness/sessions/:id/complete", () =>
        Effect.gen(function* () {
          const params = yield* HttpRouter.params;
          const report = store.completeSession(params["id"] ?? "");
          if (report === undefined || report === null) {
            return yield* errorResponse(404, "unknown session");
          }
          return yield* HttpServerResponse.json(report);
        }),
      );

      for (const [method, path] of playbackRoutes) {
        const routePath: HttpRouter.PathInput = path;
        yield* router.add(method, routePath, (request) =>
          Effect.gen(function* () {
            const sessionId = request.headers["x-harness-session"];
            if (typeof sessionId !== "string" || sessionId === "") {
              return yield* errorResponse(400, "missing x-harness-session header");
            }

            const body = yield* readBody(request);
            const actual: ActualRequest = {
              method: request.method,
              path: requestPath(request),
              headers: Object.fromEntries(Object.entries(request.headers)),
              contentType: request.headers["content-type"],
              body,
            };

            const result = store.recordRequest(sessionId, actual);
            if (!result.ok) {
              return yield* errorResponse(result.status, result.message);
            }
            return yield* jsonResponse(result.response.body, result.response.status);
          }),
        );
      }
    }),
  );
