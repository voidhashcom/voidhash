// oxlint-disable effect/noAs, effect/noAsyncFunction, effect/noGlobals, effect/noNewError, effect/noThrowStatement -- HarnessClient is the deliberate non-Effect boundary consumed by plain runners in every language: raw fetch/JSON over HTTP on purpose so TypeScript runners need nothing but a URL.
// oxlint-disable-next-line effect/noNodeBuiltinImport -- the created server value is handed to the `@effect/platform-node` HTTP adapter, which requires a real `node:http` Server instance.
import { createServer, type Server } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Exit, Layer, Scope } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { listSuites } from "../suites/index";
import type { ScenarioStep, SessionReport } from "../types";
import { buildAppLayer } from "./app";
import { HarnessStore } from "./store";

export interface HarnessHandle {
  readonly url: string;
  readonly port: number;
  readonly shutdown: () => Promise<void>;
}

export interface StartHarnessOptions {
  /** Defaults to an ephemeral port. */
  readonly port?: number;
}

const startEffect = (options: StartHarnessOptions) =>
  Effect.gen(function* () {
    let nodeServer: Server | undefined;

    const appLayer = HttpRouter.serve(buildAppLayer(new HarnessStore(listSuites())), {
      disableLogger: true,
    }).pipe(
      Layer.provide(
        NodeHttpServer.layer(
          () => {
            const server = createServer();
            nodeServer = server;
            return server;
          },
          { port: options.port ?? 0, host: "127.0.0.1" },
        ),
      ),
    );

    const scope = yield* Scope.make();
    yield* Layer.build(appLayer).pipe(Effect.provideService(Scope.Scope, scope));

    const address = nodeServer?.address();
    if (address === null || address === undefined || typeof address === "string") {
      return yield* Effect.die(new Error("harness server failed to bind a TCP port"));
    }

    return {
      url: `http://127.0.0.1:${address.port}`,
      port: address.port,
      shutdown: () =>
        Effect.runPromise(
          Effect.asVoid(Scope.close(scope, Exit.succeed(undefined))),
        ) as Promise<void>,
    } satisfies HarnessHandle;
  });

/**
 * Boots the harness server on `127.0.0.1` and returns a handle with the bound
 * URL plus an async shutdown that releases the underlying server scope.
 */
export const startHarness = (options: StartHarnessOptions = {}): Promise<HarnessHandle> =>
  Effect.runPromise(startEffect(options));

/** Fetch-based helper shared by every TypeScript runner. */
export class HarnessClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  static forHandle(handle: HarnessHandle): HarnessClient {
    return new HarnessClient(handle.url);
  }

  private async postJson<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
      throw new Error(`harness ${path} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  /** Starts a session and returns its id together with the full step descriptors. */
  createSession(suiteName: string): Promise<CreatedSession> {
    return this.postJson<CreatedSession>("/__harness/sessions", { suite: suiteName });
  }

  /** Completes a session and returns its final report. */
  completeSession(sessionId: string): Promise<SessionReport> {
    return this.postJson<SessionReport>(`/__harness/sessions/${sessionId}/complete`);
  }
}

export interface CreatedSession {
  readonly sessionId: string;
  readonly suite: string;
  /** Full step descriptors so generic runners can replay without local fixtures. */
  readonly steps: ReadonlyArray<ScenarioStep>;
}
