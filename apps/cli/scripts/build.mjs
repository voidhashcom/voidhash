#!/usr/bin/env node
// Builds the CLI for this computer into bin/, where the npm launcher finds it
// in a source checkout.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = path.join("bin", process.platform === "win32" ? "voidhash.exe" : "voidhash");

const built = spawnSync("go", ["build", "-trimpath", "-o", output, "./cmd/voidhash"], {
  cwd: root,
  stdio: "inherit",
});
if (built.error?.code === "ENOENT") {
  console.error(
    "The Voidhash CLI is written in Go. Install Go from https://go.dev/dl/ to build it.",
  );
  process.exit(1);
}
if (built.error) throw built.error;
process.exit(built.status ?? 1);
