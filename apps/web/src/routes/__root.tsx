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
import { Toaster } from "@voidhash/ui";
import { getMe } from "@voidhash/features/auth/server/queries";
import { authQueryKeys } from "@voidhash/features/auth/client/query-keys";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	user: Awaited<ReturnType<typeof getMe>>;
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
				title: "voidhash - Payments made simple",
			},
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient.fetchQuery({
			queryKey: authQueryKeys.me(),
			queryFn: ({ signal }) => getMe({ signal }),
		});
		return { user };
	},
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
			<Toaster />
			<TanStackRouterDevtools position="bottom-left" />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html>
			<head>
				<HeadContent />
			</head>
			<body className="dark">
				{children}
				<Scripts />
			</body>
		</html>
	);
}
