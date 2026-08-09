import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  root: "src",
  server: {
    host: "127.0.0.1",
    port: 3003,
    strictPort: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
