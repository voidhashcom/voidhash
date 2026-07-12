import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    exclude: ["./**/*.integration.test.ts", "./node_modules/**"],
    include: ["./**/*.test.ts"],
    reporters: ["verbose"],
  },
});
