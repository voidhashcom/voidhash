import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const forbiddenPackages = new Set([
  "alchemy",
  "cloudflare",
  "miniflare",
  "workerd",
  "wrangler",
  "@distilled.cloud/cloudflare",
  "@distilled.cloud/cloudflare-rolldown-plugin",
  "@distilled.cloud/cloudflare-runtime",
  "@distilled.cloud/cloudflare-vite-plugin",
]);

// Types-only packages carry no runtime cloud coupling. `@cloudflare/workers-types`
// reaches the prod tree as an optional peer of better-auth's kysely adapter and
// contains nothing but declaration files.
const allowedTypeOnlyPackages = new Set(["@cloudflare/workers-types"]);

const isForbidden = (name) =>
  !allowedTypeOnlyPackages.has(name) &&
  (forbiddenPackages.has(name) || name.startsWith("@cloudflare/"));

const readPackage = (packageDirectory, installed) => {
  const manifestPath = path.join(packageDirectory, "package.json");
  if (!fs.existsSync(manifestPath)) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (typeof manifest.name !== "string") return;
  const realPath = fs.realpathSync(packageDirectory);
  installed.set(realPath, {
    name: manifest.name,
    version: typeof manifest.version === "string" ? manifest.version : "unknown",
  });
};

const scanPackageDirectory = (nodeModulesDirectory, installed) => {
  if (!fs.existsSync(nodeModulesDirectory)) return;
  for (const entry of fs.readdirSync(nodeModulesDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(nodeModulesDirectory, entry.name);
    if (entry.name.startsWith("@")) {
      if (!entry.isDirectory()) continue;
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        readPackage(path.join(entryPath, scopedEntry.name), installed);
      }
    } else {
      readPackage(entryPath, installed);
    }
  }
};

const inspectDeployment = (deploymentRoot) => {
  const nodeModulesDirectory = path.join(deploymentRoot, "node_modules");
  const virtualStoreDirectory = path.join(nodeModulesDirectory, ".pnpm");
  if (!fs.existsSync(virtualStoreDirectory)) {
    throw new Error(`No pnpm deployment found at ${deploymentRoot}`);
  }

  const installed = new Map();
  scanPackageDirectory(nodeModulesDirectory, installed);
  for (const entry of fs.readdirSync(virtualStoreDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    scanPackageDirectory(path.join(virtualStoreDirectory, entry.name, "node_modules"), installed);
  }

  const forbidden = [...installed.values()]
    .filter((pkg) => isForbidden(pkg.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (forbidden.length > 0) {
    throw new Error(
      `Self-host deployment contains cloud-only packages:\n${forbidden
        .map((pkg) => `- ${pkg.name}@${pkg.version}`)
        .join("\n")}`,
    );
  }
  console.log(`Self-host runtime boundary OK — ${installed.size} installed packages checked.`);
};

const requestedDeployment = process.argv[2];
if (requestedDeployment) {
  inspectDeployment(path.resolve(requestedDeployment));
} else {
  const deploymentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "voidhash-selfhost-boundary-"));
  try {
    execFileSync(
      "corepack",
      [
        "pnpm@11.1.3",
        "--config.ignore-scripts=true",
        "--config.node-linker=isolated",
        "--config.block-exotic-subdeps=false",
        "--filter",
        "@voidhash/backend-app",
        "deploy",
        "--prod",
        "--legacy",
        deploymentRoot,
      ],
      { stdio: "inherit" },
    );
    inspectDeployment(deploymentRoot);
  } finally {
    fs.rmSync(deploymentRoot, { recursive: true, force: true });
  }
}
