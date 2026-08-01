import { defineConfig } from "vite-plus";

// The integration suite runs against a provisioned environment: locally the
// self-host stack (`pnpm stack:up`), downstream whatever the composition's
// globalSetup provides. Files run sequentially — they share one database and
// one seeded fixture container.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: [
      // Purchase-provider flows exercised through the SDK HTTP harness; run
      // via the dedicated purchase pipeline, not the shared-fixture suite.
      "./test/services/paymentProviders/appStore/AppStorePaymentProviderService.integration.test.ts",
      "./test/services/paymentProviders/googlePlay/GooglePlayPaymentProviderService.integration.test.ts",
      "./node_modules/**",
    ],
    include: [
      "./src/**/*.integration.test.ts",
      "./test/**/*.integration.test.ts",
    ],
    globalSetup: ["./test/_testing/globalSetup.ts"],
    passWithNoTests: true,
    pool: "threads",
    fileParallelism: false,
    hookTimeout: 300_000,
    reporters: ["verbose"],
    teardownTimeout: 300_000,
    testTimeout: 120_000,
  },
});
