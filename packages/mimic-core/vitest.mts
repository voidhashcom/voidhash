import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["./tests/**/*.test.ts"],
    exclude: ["./node_modules/**"],
    reporters: ["verbose"],
  },
});
