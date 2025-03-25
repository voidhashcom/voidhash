import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@voidhash/auth/client";
import { SidebarProvider, SidebarInset } from "@voidhash/ui";
import {
	createFileRoute,
	Outlet,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { toast } from "sonner";
import { SettingsSidebar } from "@/components/settings-sidebar";

export const Route = createFileRoute("/_authed/_dashboard")({
	component: RouteComponent,
});

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
	const isSettingsRoute = routerState.location.pathname.startsWith("/settings");

	return (
		<SidebarProvider defaultOpen={!isSettingsRoute}>
			<div className="flex flex-row">
				<AppSidebar user={user!} onSignOut={handleSignOut} />
				{isSettingsRoute && <SettingsSidebar />}
			</div>
			<SidebarInset>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
