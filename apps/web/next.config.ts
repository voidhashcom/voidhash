import { API_DOMAIN, DOCS_DOMAIN } from "@voidhash/lib/constants";
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
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				has: [
					{
						type: "host",
						value: "voidhash.com",
					},
				],
				destination: `${API_DOMAIN}/:path*`,
			},
			{
				source: "/docs/:path*",
				has: [
					{
						type: "host",
						value: "voidhash.com",
					},
				],
				destination: `${DOCS_DOMAIN}/:path*`,
			},
		];
	},
};

export default nextConfig;
