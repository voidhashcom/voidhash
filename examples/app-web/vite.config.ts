import { loadEnv } from "vite";
import { defineConfig } from "vite-plus";

/**
 * A first-party proxy, the way a site runs one in production: the page sends
 * the SDK's requests to `/vh` on its own origin, where ad blockers leave them
 * alone, and the server forwards them to Voidhash without the prefix.
 * `/backend` stands in for the site's own server: it forwards to the Node
 * backend example, which creates payment-source checkouts.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, ["VOIDHASH_", "NIMBUS_"]);
  return {
    server: {
      proxy: {
        "/backend": {
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/backend/, ""),
          target: env.NIMBUS_BACKEND_URL || "http://localhost:8080",
        },
        "/vh": {
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/vh/, ""),
          target: env.VOIDHASH_API_URL || "https://api.voidhash.com",
        },
      },
    },
  };
});
