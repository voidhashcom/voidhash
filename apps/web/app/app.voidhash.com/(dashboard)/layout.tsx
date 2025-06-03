"use client";

import { authClient } from "@voidhash/auth/client";
import { Logo, SidebarProvider, useIsMobile } from "@voidhash/ui";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const isSettingsRoute = pathname.includes("/settings");
	const isMobile = useIsMobile();

	const signOut = async () => {
		await authClient.signOut();
		router.refresh();
		router.push("/");
	};

	return (
		<div className="flex flex-col [--header-height:calc(theme(spacing.14))] has-[div#nav-enviromental-bar]:[--header-height:calc(theme(spacing.24))]">
			<SidebarProvider defaultOpen={!isSettingsRoute} className="flex flex-col">
				{children}
				{isMobile && (
					<div className="fixed bottom-0 left-0 right-0 bg-background z-50 flex items-center justify-center inset-0 flex-col px-6">
						<Logo className="w-22" />
						<div className="mt-3 text-center text-xl font-semibold text-balance">
							Voidhash is currently not available on mobile,
						</div>
						<div className="mt-3 text-center text-sm text-muted-foreground text-balance">
							Please use a desktop browser to access Voidhash. We are working
							hard to bring you the best experience on mobile.
						</div>
						<div className="text-center text-sm text-muted-foreground mt-6">
							<button
								className="underline underline-offset-4 text-foreground cursor-pointer"
								onClick={signOut}
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
