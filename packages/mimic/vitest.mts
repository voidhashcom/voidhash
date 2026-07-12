import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["./tests/**/*.test.ts", "./tests/**/*.test.tsx"],
    exclude: ["./node_modules/**"],
    reporters: ["verbose"],
  },
});
