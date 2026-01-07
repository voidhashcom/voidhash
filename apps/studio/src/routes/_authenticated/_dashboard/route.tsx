import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { Logo, SidebarProvider, useIsMobile } from "@voidhash/ui";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/_dashboard")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = Route.useNavigate();
	const pathname = useLocation({
		select: (location) => location.pathname,
	});
	const isSettingsRoute = pathname.includes("/settings");
	const isMobile = useIsMobile();

	const signOut = async () => {
		await authClient.signOut();
		navigate({ to: "/" });
	};

	return (
		<div className="flex flex-col [--header-height:calc(theme(spacing.14))] has-[div#nav-enviromental-bar]:[--header-height:calc(theme(spacing.24))]">
			<SidebarProvider className="flex flex-col" defaultOpen={!isSettingsRoute}>
				<Outlet />
				{isMobile && (
					<div className="fixed inset-0 right-0 bottom-0 left-0 z-50 flex flex-col items-center justify-center bg-background px-6">
						<Logo className="w-22" />
						<div className="mt-3 text-balance text-center font-semibold text-xl">
							Voidhash is currently not available on mobile,
						</div>
						<div className="mt-3 text-balance text-center text-muted-foreground text-sm">
							Please use a desktop browser to access Voidhash. We are working
							hard to bring you the best experience on mobile.
						</div>
						<div className="mt-6 text-center text-muted-foreground text-sm">
							<button
								className="cursor-pointer text-foreground underline underline-offset-4"
								onClick={signOut}
								type="button"
							>
								Logout
							</button>
						</div>
					</div>
				)}
			</SidebarProvider>
		</div>
	);
}
