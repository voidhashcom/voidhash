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
