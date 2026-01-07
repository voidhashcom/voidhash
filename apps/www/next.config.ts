// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;

import { AUTH_DOMAIN, DOCS_DOMAIN, STUDIO_DOMAIN } from "@voidhash/lib";
import type { NextConfig } from "next";
import path from "node:path";

const STUDIO_BASE_PATH = "/studio";
const DOCS_BASE_PATH = "/docs";
const AUTH_BASE_PATH = "/auth";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "../../.."),
  },
  // biome-ignore lint/suspicious/useAwait: async is required
  redirects: async () => [
    // Redirect to dashboard if user is authenticated
    {
      destination: STUDIO_BASE_PATH,
      has: [
        {
          key: "better-auth.session_token",
          type: "cookie",
        },
      ],
      permanent: false,
      source: "/",
    },
  ],
  // biome-ignore lint/suspicious/useAwait: async is required
  rewrites: async () => [
    {
      destination: `${STUDIO_DOMAIN}/studio`,
      source: STUDIO_BASE_PATH,
    },
    {
      destination: `${STUDIO_DOMAIN}/studio/:path*`,
      source: `${STUDIO_BASE_PATH}/:path*`,
    },
    {
      destination: `${DOCS_DOMAIN}/docs`,
      source: DOCS_BASE_PATH,
    },
    {
      destination: `${DOCS_DOMAIN}/docs/:path+`,
      source: `${DOCS_BASE_PATH}/:path*`,
    },
    {
      destination: `${AUTH_DOMAIN}/auth`,
      source: AUTH_BASE_PATH,
    },
    {
      destination: `${AUTH_DOMAIN}/auth/:path+`,
      source: `${AUTH_BASE_PATH}/:path*`,
    },
  ],
};

if (process.env.NODE_ENV === "development") {
  nextConfig.outputFileTracingRoot = path.join(__dirname, "../../../");
}

export default nextConfig;
