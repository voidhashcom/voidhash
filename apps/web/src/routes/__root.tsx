import type { ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
	Outlet,
	HeadContent,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/react-router";
import appCss from "@/styles/globals.css?url";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "src/lib/auth";
import { getWebRequest } from "@tanstack/react-start/server";
import { Toaster } from "@chiron-standalone/ui";

const fetchUser = createServerFn({ method: "GET" }).handler(async () => {
	const { headers } = getWebRequest()!;
	const res = await auth.api.getSession({
		headers: headers,
	});

	return res?.user;
});

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	user: Awaited<ReturnType<typeof fetchUser>>;
}>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.fetchQuery({
			queryKey: ["user"],
			queryFn: ({ signal }) => fetchUser({ signal }),
		}); // we're using react-query for caching, see router.tsx
		return { user };
	},
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
			<Toaster />
			<TanStackRouterDevtools />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
