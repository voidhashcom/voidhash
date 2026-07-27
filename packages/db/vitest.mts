import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["./node_modules/**"],
    include: ["./tests/**/*.test.ts"],
    reporters: ["verbose"],
  },
});
