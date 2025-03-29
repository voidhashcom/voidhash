import { NavBar } from "@/components/nav-bar";
import {
	createFileRoute,
	Outlet,
	redirect,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { authClient } from "@voidhash/features/auth/lib/client";
import { authQueryKeys } from "@voidhash/features/auth/query-keys";
import { SidebarProvider } from "@voidhash/ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/~/$organizationSlug")({
	component: RouteComponent,
	beforeLoad: async ({ params, context }) => {
		const teamExists = context.user?.organizations.some(
			(org) => org.slug === params.organizationSlug
		);

		if (!teamExists) {
			return redirect({ to: "/" });
		}
	},
});

function RouteComponent() {
	const { user, queryClient } = Route.useRouteContext();
	const { organizationSlug } = Route.useParams();
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
				onError: (error) => {
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
