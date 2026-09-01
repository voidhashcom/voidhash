import effect from "@mpsuesser/oxlint-plugin-effect";
import { defineConfig } from "vite";

const effectWorkspaces = [
  "apps/backend",
  "apps/cli",
  "libraries/node",
  "libraries/react-native",
  "libraries/web",
  "packages/agent",
  "packages/ai-shared",
  "packages/api-contracts",
  "packages/backend",
  "packages/core",
  "packages/core-v2",
  "packages/db",
  "packages/generated-clients",
  "packages/lib",
  "packages/mimic-schema",
  "packages/paywall-build",
  "packages/paywall-renderer-preact",
  "packages/platform",
  "packages/rpc",
  "packages/sdk-test-harness",
  "packages/shared",
  "packages/ui",
  "vendored/app-store-server-sdk",
  "vendored/google-play-server-sdk",
  "vendored/mimic/apps/mimic-db",
  "vendored/mimic/packages/mimic-server",
];

/** Repository lint configuration for standalone public checkouts. */
export default defineConfig({
  lint: {
    ignorePatterns: [
      "libraries/node/src/generated/grouped-client.ts",
      "packages/generated-clients/src/**/generated.ts",
    ],
    options: {
      typeAware: true,
      typeCheck: false,
    },
    overrides: [
      {
        files: effectWorkspaces.map((workspace) => `${workspace}/**`),
        ...effect.configs.recommended,
      },
    ],
  },
});
