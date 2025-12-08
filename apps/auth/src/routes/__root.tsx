import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { ThemeProviderTanstack } from "@voidhash/ui";
import appCss from "../globals.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{ title: "Voidhash - The mobile app monetization and insights platform" },
			{
				name: "description",
				content:
					"Voidhash is an monetization and insights platform simplifying integrations, analytics, and revenue growth for apps and digital products.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	component: RootLayout,
});

function RootLayout() {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="antialiased">
				<ThemeProviderTanstack
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange
					enableSystem
				>
					<Outlet />
				</ThemeProviderTanstack>
				<Scripts />
			</body>
		</html>
	);
}
