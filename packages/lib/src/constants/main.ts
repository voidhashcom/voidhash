export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "voidhash.com";

type VERCEL_ENV = "production" | "preview" | "development";

const WWW_DOMAINS: Record<VERCEL_ENV, string> = {
	development: "http://localhost:3000",
	preview: `https://preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	production: `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
};

const STUDIO_DOMAINS: Record<VERCEL_ENV, string> = {
	development: "http://localhost:3001",
	preview: `https://studio-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	production: `https://studio.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
};

const DOCS_DOMAINS: Record<VERCEL_ENV, string> = {
	development: "http://localhost:3002",
	preview: `https://docs-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	production: `https://docs.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
};

const API_DOMAINS: Record<VERCEL_ENV, string> = {
	development: "http://localhost:5001",
	preview: `https://api-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	production: `https://api.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
};

const AUTH_DOMAINS: Record<VERCEL_ENV, string> = {
	development: "http://localhost:3003",
	production: `https://auth.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	preview: `https://auth-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
};

export const HOME_DOMAIN = `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}`;

export const STUDIO_DOMAIN =
	STUDIO_DOMAINS[process.env.NEXT_PUBLIC_VERCEL_ENV as VERCEL_ENV];
export const WWW_DOMAIN =
	WWW_DOMAINS[process.env.NEXT_PUBLIC_VERCEL_ENV as VERCEL_ENV];
export const DOCS_DOMAIN =
	DOCS_DOMAINS[process.env.NEXT_PUBLIC_VERCEL_ENV as VERCEL_ENV];
export const API_DOMAIN =
	API_DOMAINS[process.env.NEXT_PUBLIC_VERCEL_ENV as VERCEL_ENV];
export const AUTH_DOMAIN =
	AUTH_DOMAINS[process.env.NEXT_PUBLIC_VERCEL_ENV as VERCEL_ENV];

export const APP_HOSTNAMES = new Set([
	`app.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	`preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	"localhost:3000",
	"localhost",
]);
