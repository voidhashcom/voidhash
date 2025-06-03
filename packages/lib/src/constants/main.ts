export const SHORT_DOMAIN =
	process.env.NEXT_PUBLIC_APP_SHORT_DOMAIN || "voidha.sh";

export const HOME_DOMAIN = `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}`;

export const APP_HOSTNAMES = new Set([
	`app.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	`preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	"localhost:3000",
	"localhost",
]);

export const APP_DOMAIN =
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
		? `https://app.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
		: process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
			? `https://preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
			: "http://localhost:3000";

export const API_HOSTNAMES = new Set([
	`api.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	`api-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	`api.${SHORT_DOMAIN}`,
	"api.localhost:3000",
]);

export const API_DOMAIN =
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
		? `https://api.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
		: process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
			? `https://api-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
			: "http://api.localhost:3000";

export const DOCS_HOSTNAMES = new Set([
	`docs.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	"docs.localhost:3001",
]);

export const DOCS_DOMAIN =
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
		? `https://docs.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
		: "http://docs.localhost:3001";

export const CHECKOUT_HOSTNAMES = new Set([
	`checkout.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	`checkout-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`,
	"checkout.localhost:3000",
]);

export const CHECKOUT_DOMAIN =
	process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
		? `https://checkout.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
		: process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"
			? `https://checkout-preview.${process.env.NEXT_PUBLIC_APP_DOMAIN}`
			: "http://localhost:3000/checkout.voidhash.com";
