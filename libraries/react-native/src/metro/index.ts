/**
 * Metro plugin — Node-only entry, never bundled into the RN app.
 *
 * Wire this into the user's `metro.config.js` to automatically regenerate
 * `voidhash.gen.d.ts` when the dashboard schema changes during `expo start`:
 *
 * ```js
 * const { getDefaultConfig } = require("expo/metro-config");
 * const { withVoidhash } = require("@voidhash/react-native/metro");
 *
 * module.exports = withVoidhash(getDefaultConfig(__dirname), {
 *   pollIntervalMs: 5000, // optional
 * });
 * ```
 *
 * Spawns `voidhash-cli types generate --watch` as a child process once the Metro
 * dev server starts serving, and tears it down on shutdown. Loading the config
 * for a one-off bundle (`expo export`, `react-native bundle`, the release build
 * phase) starts nothing. Errors from the spawned CLI are logged but do not
 * crash Metro — the user can keep developing against the last-known-good
 * `.d.ts`.
 *
 * `voidhash-cli` is not a dependency of this package — install it as a dev
 * dependency to enable the watch integration, or point `cliBinary` at a
 * `voidhash` installed another way. If the binary isn't on PATH, the dev
 * server keeps running and a warning is emitted.
 */

// We avoid pulling in `@types/node` so the SDK's TypeScript compilation
// stays free of Node ambient types — this module only runs in the Metro
// (Node) context. The minimal ambient declarations below describe just what
// we need.

declare const require: (id: string) => unknown;
declare const process: {
  on(event: string, listener: () => void): void;
  emitWarning(message: string): void;
};

import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

interface ChildProcessLike {
  killed: boolean;
  kill(signal?: string): boolean;
  unref(): void;
  on(event: "error", listener: (error: { message: string }) => void): void;
  on(event: "exit", listener: () => void): void;
}

interface ChildProcessModule {
  spawn(
    command: string,
    args: ReadonlyArray<string>,
    options: {
      stdio: "inherit";
    },
  ): ChildProcessLike;
}

const isChildProcessModule = (value: unknown): value is ChildProcessModule =>
  P.isObject(value) && "spawn" in value && P.isFunction(value.spawn);

// Metro config has a deep, framework-specific type. We treat it as opaque and
// only wrap `server.enhanceMiddleware`, so we don't have to depend on
// `metro-config`.
type MetroConfig = unknown;

type EnhanceMiddleware = (middleware: unknown, server: unknown) => unknown;

const isEnhanceMiddleware = (value: unknown): value is EnhanceMiddleware => P.isFunction(value);

export interface WithVoidhashOptions {
  /** How often to poll the server for schema changes (ms). Default 5000. */
  pollIntervalMs?: number;
  /**
   * The CLI to run: a path, or a name on $PATH such as `voidhash`. Defaults to
   * `voidhash-cli`, which the npm package of that name provides.
   */
  cliBinary?: string;
  /** Additional CLI arguments forwarded after `types generate --watch`. */
  extraArgs?: ReadonlyArray<string>;
}

let activeChildProcess = Option.none<ChildProcessLike>();
let teardownInstalled = false;

function ensureTeardownHandlers() {
  if (teardownInstalled) return;
  teardownInstalled = true;

  const teardown = () => {
    if (Option.isSome(activeChildProcess) && !activeChildProcess.value.killed) {
      activeChildProcess.value.kill("SIGTERM");
      activeChildProcess = Option.none();
    }
  };

  process.on("exit", teardown);
  process.on("SIGINT", teardown);
  process.on("SIGTERM", teardown);
}

function startWatcher(options: WithVoidhashOptions) {
  if (Option.isSome(activeChildProcess)) {
    return;
  }

  const binary = options.cliBinary ?? "voidhash-cli";
  const args = [
    "types",
    "generate",
    "--watch",
    "--poll-interval-ms",
    String(options.pollIntervalMs ?? 5000),
    ...(options.extraArgs ?? []),
  ];

  const childProcessModule = require("node:child_process");
  if (!isChildProcessModule(childProcessModule)) {
    process.emitWarning("[voidhash/metro] node:child_process did not expose spawn().");
    return;
  }

  const spawned = Result.try(() => childProcessModule.spawn(binary, args, { stdio: "inherit" }));
  Result.match(spawned, {
    onFailure: (error) => {
      process.emitWarning(`[voidhash/metro] Could not start types watcher: ${String(error)}`);
      activeChildProcess = Option.none();
    },
    onSuccess: (childProcess: ChildProcessLike) => {
      // The watcher lives exactly as long as the dev server; it must never be
      // what keeps Node running.
      childProcess.unref();
      activeChildProcess = Option.some(childProcess);
      childProcess.on("error", (error) => {
        process.emitWarning(
          `[voidhash/metro] Failed to spawn '${binary} ${args.join(" ")}': ${error.message}. ` +
            "Install voidhash-cli as a dev dependency of this project, or set cliBinary.",
        );
        activeChildProcess = Option.none();
      });

      childProcess.on("exit", () => {
        activeChildProcess = Option.none();
      });

      ensureTeardownHandlers();
    },
  });
}

/**
 * Wrap a Metro config so that `voidhash-cli types generate --watch` runs alongside
 * the Metro dev server. The watcher starts the first time Metro builds its
 * server middleware (`server.enhanceMiddleware`), which only happens when Metro
 * serves; bundling commands that merely load the config spawn nothing. The
 * returned config is otherwise the one passed in, and any `enhanceMiddleware`
 * it already had still runs.
 */
export function withVoidhash<TConfig extends MetroConfig>(
  metroConfig: TConfig,
  options: WithVoidhashOptions = {},
): TConfig {
  const server =
    P.hasProperty(metroConfig, "server") && P.isObject(metroConfig.server)
      ? metroConfig.server
      : {};
  const enhanceMiddleware =
    P.hasProperty(server, "enhanceMiddleware") && isEnhanceMiddleware(server.enhanceMiddleware)
      ? server.enhanceMiddleware
      : undefined;
  return Object.assign({}, metroConfig, {
    server: {
      ...server,
      enhanceMiddleware: (middleware: unknown, metroServer: unknown) => {
        startWatcher(options);
        return enhanceMiddleware === undefined
          ? middleware
          : enhanceMiddleware(middleware, metroServer);
      },
    },
  });
}
