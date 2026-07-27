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
 * Spawns `voidhash-cli types generate --watch` as a child process on Metro server
 * start and tears it down on shutdown. Errors from the spawned CLI are logged
 * but do not crash Metro — the user can keep developing against the
 * last-known-good `.d.ts`.
 *
 * `voidhash-cli` is an optional peer dependency. If the binary isn't on PATH,
 * `withVoidhash` returns the original Metro config unchanged with a warning.
 */

// We avoid pulling in `@types/node` so the SDK's TypeScript compilation
// stays free of Node ambient types — this module only runs in the Metro
// (Node) context. The minimal ambient declarations below describe just what
// we need.

declare const require: (id: string) => unknown;
declare const process: {
  env: Record<string, string | undefined>;
  on(event: string, listener: () => void): void;
};

interface ChildProcessLike {
  killed: boolean;
  kill(signal?: string): boolean;
  on(event: "error", listener: (error: { message: string }) => void): void;
  on(event: "exit", listener: () => void): void;
}

interface ChildProcessModule {
  spawn(
    command: string,
    args: ReadonlyArray<string>,
    options: {
      env: Record<string, string | undefined>;
      stdio: "inherit";
    },
  ): ChildProcessLike;
}

// Metro config has a deep, framework-specific type. We treat it as opaque
// here and return it unchanged so we don't have to depend on `metro-config`.
type MetroConfig = unknown;

export interface WithVoidhashOptions {
  /** How often to poll the server for schema changes (ms). Default 5000. */
  pollIntervalMs?: number;
  /** Path to the `voidhash-cli` binary. Defaults to picking it up via $PATH. */
  cliBinary?: string;
  /** Additional CLI arguments forwarded after `types generate --watch`. */
  extraArgs?: ReadonlyArray<string>;
}

let activeChildProcess: ChildProcessLike | null = null;
let teardownInstalled = false;

function ensureTeardownHandlers() {
  if (teardownInstalled) return;
  teardownInstalled = true;

  const teardown = () => {
    if (activeChildProcess && !activeChildProcess.killed) {
      activeChildProcess.kill("SIGTERM");
      activeChildProcess = null;
    }
  };

  process.on("exit", teardown);
  process.on("SIGINT", teardown);
  process.on("SIGTERM", teardown);
}

function startWatcher(options: WithVoidhashOptions) {
  if (activeChildProcess) {
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

  try {
    const childProcessModule = require("node:child_process") as ChildProcessModule;
    activeChildProcess = childProcessModule.spawn(binary, args, {
      env: process.env,
      stdio: "inherit",
    });

    activeChildProcess.on("error", (error) => {
      // biome-ignore lint/suspicious/noConsole: dev-time diagnostic
      console.warn(
        `[voidhash/metro] Failed to spawn '${binary} ${args.join(" ")}': ${error.message}. ` +
          "Ensure voidhash-cli is installed in this project.",
      );
      activeChildProcess = null;
    });

    activeChildProcess.on("exit", () => {
      activeChildProcess = null;
    });

    ensureTeardownHandlers();
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: dev-time diagnostic
    console.warn(
      `[voidhash/metro] Could not start types watcher: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    activeChildProcess = null;
  }
}

/**
 * Wrap a Metro config so that `voidhash-cli types generate --watch` runs alongside
 * the Metro dev server. Returns the original config unchanged — the watcher
 * runs as a sibling process, not via Metro's transformer/resolver pipeline.
 */
export function withVoidhash<TConfig extends MetroConfig>(
  metroConfig: TConfig,
  options: WithVoidhashOptions = {},
): TConfig {
  // Kick the watcher off lazily so that simply *importing* this module from a
  // non-dev context doesn't spawn a background process.
  globalThis.queueMicrotask?.(() => startWatcher(options));
  return metroConfig;
}
