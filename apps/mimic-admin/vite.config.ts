import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true },
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
