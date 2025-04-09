import { AppSidebar } from "@/components/app-sidebar";
import { authClient } from "@voidhash/features/auth/lib/client";
import { SidebarInset } from "@voidhash/ui";
import {
	createFileRoute,
	Outlet,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { toast } from "sonner";
import { ProjectSettingsSidebar } from "@/components/project-settings-sidebar";

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/$projectSlug"
)({
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
	const isSettingsRoute = routerState.location.pathname.includes("/settings");

	return (
		<div className="flex flex-1">
			<div className="flex flex-row">
				<AppSidebar user={user!} onSignOut={handleSignOut} />
				{isSettingsRoute && <ProjectSettingsSidebar />}
			</div>
			<SidebarInset className="top-[var(--header-height)]">
				<Outlet />
			</SidebarInset>
		</div>
	);
}
