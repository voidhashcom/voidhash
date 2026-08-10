// oxlint-disable-next-line effect/noNodeBuiltinImport -- this launcher runs in Node before Vite (and therefore any Effect runtime) exists; FileSystem would need a runtime that is not there yet.
import { existsSync } from "node:fs";

// Vite only exposes `VITE_`-prefixed values, and only to `import.meta.env` — the
// server routes read plain `process.env` (root credentials, auth secret), so the
// repo-root `.env` used by the Alchemy stack has to be loaded here too. Real
// environment variables win: Node's parser skips names that are already set, and
// a deployment without the file keeps every documented default.
const rootEnvFile = `${import.meta.dirname}/../../../.env`;
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

process.env.VITE_APP_API_URL ??= "https://mimic.voidhash.localhost";

const { createServer } = await import("vite");

// Keep the Vite server and TanStack Start plugin on the same module instance.
const server = await createServer();
await server.listen();
server.printUrls();
