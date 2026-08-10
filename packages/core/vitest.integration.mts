import { defineConfig } from "vite-plus";

// The integration suite runs against a provisioned environment: locally the
// Node test fixture (`pnpm test:integration`), downstream whatever the
// composition's globalSetup provides. Files run sequentially — they share one
// database and one seeded fixture container.
//
// `isolate: false` keeps the module registry between files. Re-importing the
// module graph per file cost ~90s of a 110s run; the tests themselves are ~16s.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["./**/*.integration.test.ts"],
    exclude: [
      // Purchase-provider flows exercised through the SDK HTTP harness; run
      // via the dedicated purchase pipeline, not the shared-fixture suite.
      "./test/services/paymentProviders/appStore/AppStorePaymentProviderService.integration.test.ts",
      "./test/services/paymentProviders/googlePlay/GooglePlayPaymentProviderService.integration.test.ts",
      "./node_modules/**",
      "./dist/**",
    ],
    globalSetup: ["./test/_testing/globalSetup.ts"],
    passWithNoTests: true,
    reporters: ["verbose"],
    pool: "threads",
    isolate: false,
    fileParallelism: false,
    hookTimeout: 300_000,
    teardownTimeout: 300_000,
    testTimeout: 120_000,
  },
});
