import { OrganizationSettingsSidebar } from "@/components/organization-settings-sidebar";
import { OrganizationSidebar } from "@/components/organization-sidebar";
import {
	createFileRoute,
	Outlet,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { authClient } from "@voidhash/features/auth/lib/client";
import { SidebarInset } from "@voidhash/ui";
import { toast } from "sonner";
export const Route = createFileRoute("/_authed/~/$organizationSlug/_organizations")(
	{
		component: RouteComponent,
	}
);

function RouteComponent() {
	const { user, queryClient } = Route.useRouteContext();
	const router = useRouter();

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ["user"] });
					router.invalidate();
				},
				onError: (error) => {
					toast.error("Failed to sign out");
				},
			},
		});
	};

	const routerState = useRouterState();
	const isSettingsRoute = routerState.location.pathname.includes("/settings");

	return (
		<div className="flex flex-1">
			<div className="flex flex-row">
				<OrganizationSidebar user={user!} onSignOut={handleSignOut} />
				{isSettingsRoute && <OrganizationSettingsSidebar />}
			</div>
			<SidebarInset className="top-[var(--header-height)]">
				<Outlet />
			</SidebarInset>
		</div>
	);
}
