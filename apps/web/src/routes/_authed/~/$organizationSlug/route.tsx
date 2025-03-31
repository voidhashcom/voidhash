import { NavBar } from "@/components/nav-bar";
import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { authClient } from "@voidhash/features/auth/lib/client";
import { teamProjectsBySlugQueryOptions } from "@voidhash/features/projects/client/query-utils";
import { SidebarProvider } from "@voidhash/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/~/$organizationSlug")({
	component: RouteComponent,
	loader: async ({ params, context }) => {
		await context.queryClient.ensureQueryData(
			teamProjectsBySlugQueryOptions(params.organizationSlug)
		);
	},
});

function RouteComponent() {
	const { user, queryClient } = Route.useRouteContext();
	const routerState = useRouterState();
	const isSettingsRoute = routerState.location.pathname.includes("/settings");
	const router = useRouter();

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queryClient.invalidateQueries();
					router.invalidate();
				},
				onError: () => {
					toast.error("Failed to sign out");
				},
			},
		});
	};

	return (
		<div className="flex flex-col [--header-height:calc(--spacing(14))]">
			<SidebarProvider defaultOpen={!isSettingsRoute} className="flex flex-col">
				<NavBar user={user!} onSignOut={handleSignOut} />
				<Outlet />
			</SidebarProvider>
		</div>
	);
}
