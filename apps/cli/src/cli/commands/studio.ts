import { type ChildProcess, spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { Console, Effect, FileSystem, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { userError } from "../../utils/error-formatter";

const DEFAULT_PORT = 4830;

/** Resolves the installed Studio app directory and the Vite CLI entry point. */
const resolveStudioPaths = () =>
  Effect.try({
    try: () => {
      // `require.resolve` works both in the bundled CJS binary and under tsx in
      // development. We resolve the package manifest to get the app root, and
      // Vite's own CLI entry so we can launch it without depending on bin
      // shims being hoisted in any particular way.
      const studioDir = dirname(require.resolve("@voidhash/studio/package.json"));
      // Resolve Vite via its package.json (an exported subpath) from the Studio
      // package, then join the CLI entry — `vite/bin/vite.js` is not an exported
      // subpath, so it can't be resolved directly under Node's exports rules.
      const viteDir = dirname(require.resolve("vite/package.json", { paths: [studioDir] }));
      const viteBin = join(viteDir, "bin", "vite.js");
      return { studioDir, viteBin };
    },
    catch: () =>
      userError("Could not locate the Voidhash Studio app. Reinstall the CLI and try again."),
  });

/** Best-effort: open the given URL in the user's default browser. */
const openBrowser = (url: string): void => {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Opening the browser is a convenience; never fail the command over it.
  }
};

/**
 * `voidhash-cli studio [--port] [--no-open]`
 *
 * Launches the paywall preview Studio (a Vite app) against the current project.
 * The project's `.voidhash` folder is the source of truth; the Studio process is
 * pointed at it via the `VOIDHASH_PROJECT_ROOT` env var. Runs until interrupted
 * (Ctrl+C), at which point the Vite child process is terminated.
 */
export const studioCommand = Command.make(
  "studio",
  {
    port: Flag.integer("port").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Port for the Studio dev server"),
      Flag.withDefault(DEFAULT_PORT),
    ),
    open: Flag.boolean("open").pipe(
      Flag.withDescription("Open Studio in your browser once it starts"),
      Flag.withDefault(true),
    ),
  },
  ({ port, open }) =>
    Effect.gen(function* studioCommand() {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const projectRoot = path.resolve(".");
      const voidhashDir = path.join(projectRoot, ".voidhash");

      const hasVoidhash = yield* fs.exists(voidhashDir);
      if (!hasVoidhash) {
        yield* Console.warn(
          `No .voidhash folder found in ${projectRoot}.\n` +
            "Studio will start, but there are no paywalls to preview yet.\n" +
            "Create .voidhash/paywalls/<name>.tsx to get started.\n",
        );
      }

      const { studioDir, viteBin } = yield* resolveStudioPaths();
      const url = `http://localhost:${port}`;

      yield* Console.log("\n  Voidhash Studio");
      yield* Console.log(`  Project:  ${projectRoot}`);
      yield* Console.log(`  Preview:  ${url}\n`);

      // Spawn Vite, keep the command alive until the child exits, and ensure the
      // child is terminated if the fiber is interrupted (Ctrl+C).
      yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          spawn(process.execPath, [viteBin, "--port", String(port), "--strictPort"], {
            cwd: studioDir,
            env: { ...process.env, VOIDHASH_PROJECT_ROOT: projectRoot },
            stdio: "inherit",
          }),
        ),
        (child: ChildProcess) => {
          if (open) {
            // Give Vite a moment to bind the port before opening the browser.
            setTimeout(() => openBrowser(url), 1500);
          }
          return Effect.callback<void>((resume) => {
            child.on("exit", () => resume(Effect.void));
            child.on("error", (error) => resume(Effect.die(error)));
          });
        },
        (child: ChildProcess) =>
          Effect.sync(() => {
            if (child.exitCode === null && !child.killed) {
              child.kill("SIGTERM");
            }
          }),
      );
    }),
).pipe(Command.withDescription("Launch the paywall preview Studio for this project."));
