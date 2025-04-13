import type { NextConfig } from "next";

const REDIRECT_SEGMENTS = ["_static"];
import "./lib/env";

// Import env files to validate at build time. Use jiti so we can load .ts files in here.

const nextConfig: NextConfig = {
	transpilePackages: [
		"@voidhash/ui",
		"@voidhash/auth",
		"@voidhash/db",
		"@voidhash/lib",
		"@voidhash/emails",
	],
	/* config options here */
	redirects: async () => {
		return [];
	},
};

export default nextConfig;
