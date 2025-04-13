import type { NextConfig } from "next";

const REDIRECT_SEGMENTS = ["_static"];
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
	/* config options here */
	redirects: async () => {
		return [
			{
				source: "/",
				has: [
					{
						type: "host",
						value: "app.voidhash.com",
					},
				],
				destination: "https://app.voidhash.com",
				permanent: true,
			},
			{
				source: "/:path*",
				has: [
					{
						type: "host",
						value: "app.voidhash.com",
					},
				],
				destination: "https://app.voidhash.com/:path*",
				permanent: true,
			},
			...REDIRECT_SEGMENTS.flatMap((segment) => [
				{
					source: `/${segment}`,
					has: [
						{
							type: "host",
							value: "voidhash.com",
						},
					],
					destination: `https://voidhash.com/${segment}`,
					permanent: true,
				},
				{
					source: `/${segment}/:path*`,
					has: [
						{
							type: "host",
							value: "voidhash.com",
						},
					],
					destination: `https://voidhash.com/${segment}/:path*`,
					permanent: true,
				},
			]),
			{
				source: "/",
				has: [
					{
						type: "host",
						value: "staging.voidhash.com",
					},
				],
				destination: "https://staging.voidhash.com",
				permanent: true,
			},
			{
				source: "/",
				has: [
					{
						type: "host",
						value: "preview.voidhash.com",
					},
				],
				destination: "https://preview.voidhash.com",
				permanent: true,
			},
			{
				source: "/",
				has: [
					{
						type: "host",
						value: "admin.voidhash.com",
					},
				],
				destination: "https://admin.voidhash.com",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
