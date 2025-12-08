import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultCatchBoundary } from "./components/default-cache-boundary";
import { NotFound } from "./components/not-found";
import { BASE_PATH } from "./lib/basepath";
import { queryClient } from "./lib/effect-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createRouter({
		routeTree,
		basepath: BASE_PATH,
		context: { queryClient },
		defaultPreload: "intent",
		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: () => <NotFound />,
	});
	setupRouterSsrQueryIntegration({
		router,
		queryClient,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
