import './lib/env';

// Import env files to validate at build time. Use jiti so we can load .ts files in here.

const nextConfig = {
  basePath: '/studio',
  transpilePackages: [
    '@voidhash/ui',
    '@voidhash/auth',
    '@voidhash/lib',
    '@voidhash/emails'
  ],
  serverExternalPackages: ['pino', '@axiomhq/pino']
};

export default nextConfig;
