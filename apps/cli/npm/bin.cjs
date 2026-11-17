#!/usr/bin/env node
"use strict";

// Runs the Voidhash CLI binary for this computer. The binary ships in one
// optional package per platform, `@voidhash/cli-<os>-<arch>`, of which the
// package manager installs only the matching one.

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { platform, arch } = process;
const executable = platform === "win32" ? "voidhash.exe" : "voidhash";
const platformPackage = `@voidhash/cli-${platform}-${arch}`;

function findBinary() {
  if (process.env.VOIDHASH_BINARY) return process.env.VOIDHASH_BINARY;
  try {
    return require.resolve(`${platformPackage}/bin/${executable}`);
  } catch {
    // Not installed; a source checkout builds its own binary instead.
  }
  const built = path.join(__dirname, "..", "bin", executable);
  return fs.existsSync(built) ? built : undefined;
}

const binary = findBinary();
if (binary === undefined) {
  if (fs.existsSync(path.join(__dirname, "..", "go.mod"))) {
    process.stderr.write(
      "voidhash: the CLI is not built in this checkout. Build it with Go installed:\n\n" +
        "  pnpm --filter voidhash-cli build\n",
    );
    process.exit(1);
  }
  const supported = require("./platforms.json").some(
    (target) => target.os === platform && target.cpu === arch,
  );
  process.stderr.write(
    supported
      ? `voidhash: the package ${platformPackage}, which holds the CLI for this computer, is not installed.\n` +
          "It is an optional dependency of voidhash-cli, so it is skipped by --no-optional,\n" +
          "--omit=optional and --ignore-optional, and by a lockfile written on another platform\n" +
          "without it. Install again with optional dependencies, or add it yourself:\n\n" +
          `  npm install --save-dev ${platformPackage}\n\n` +
          "Or install the CLI without npm: https://voidhash.com/docs/cli#install\n"
      : `voidhash: there is no prebuilt CLI for ${platform} ${arch}.\n` +
          "Build it from source with Go: https://github.com/voidhashcom/voidhash/tree/main/apps/cli#developing\n" +
          "and set VOIDHASH_BINARY to the path of the binary.\n",
  );
  process.exit(1);
}

const child = spawn(binary, process.argv.slice(2), { stdio: "inherit" });

// A signal sent to this process alone, as a parent that stops its child does,
// has to reach the CLI. One sent to the terminal's foreground group reaches the
// CLI as well; it handles the first and the repeat is harmless.
const forwarded = ["SIGINT", "SIGTERM", "SIGHUP"];
const forward = (signal) => {
  child.kill(signal);
};
for (const signal of forwarded) process.on(signal, forward);

child.on("error", (error) => {
  process.stderr.write(`voidhash: could not run ${binary}: ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal === null) {
    process.exit(code ?? 1);
  }
  // End the same way the CLI did, so the caller sees the signal.
  for (const name of forwarded) process.removeListener(name, forward);
  process.kill(process.pid, signal);
});
