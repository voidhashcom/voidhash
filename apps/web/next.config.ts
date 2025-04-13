import "./lib/env";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.

const nextConfig = {
	transpilePackages: [
		"@voidhash/ui",
		"@voidhash/auth",
		"@voidhash/db",
		"@voidhash/lib",
		"@voidhash/emails",
	],
};

export default nextConfig;
