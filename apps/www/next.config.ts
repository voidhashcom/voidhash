// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;

import path from 'node:path';
import { DOCS_DOMAIN, STUDIO_DOMAIN } from '@voidhash/lib';
import type { NextConfig } from 'next';

const STUDIO_BASE_PATH = '/studio';
const DOCS_BASE_PATH = '/docs';

const nextConfig: NextConfig = {
  // biome-ignore lint/suspicious/useAwait: async is required
  redirects: async () => {
    return [
      // Redirect to dashboard if user is authenticated
      {
        source: '/',
        has: [
          {
            type: 'cookie',
            key: 'better-auth.session_token'
          }
        ],
        permanent: false,
        destination: STUDIO_BASE_PATH
      }
    ];
  },
  // biome-ignore lint/suspicious/useAwait: async is required
  rewrites: async () => {
    return [
      {
        source: STUDIO_BASE_PATH,
        destination: `${STUDIO_DOMAIN}/studio`
      },
      {
        source: `${STUDIO_BASE_PATH}/:path*`,
        destination: `${STUDIO_DOMAIN}/studio/:path*`
      },
      {
        source: DOCS_BASE_PATH,
        destination: `${DOCS_DOMAIN}/docs`
      },
      {
        source: `${DOCS_BASE_PATH}/:path*`,
        destination: `${DOCS_DOMAIN}/docs/:path+`
      }
    ];
  }
};

if (process.env.NODE_ENV === 'development') {
  nextConfig.outputFileTracingRoot = path.join(__dirname, '../../');
}

export default nextConfig;
