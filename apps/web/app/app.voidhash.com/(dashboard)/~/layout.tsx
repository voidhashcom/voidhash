"use client";
import { NavBar } from "@voidhash/features/shell/nav-bar";
import { authClient } from "@voidhash/auth/client";
import { SidebarProvider } from "@voidhash/ui";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@voidhash/features/auth/hooks/useMe";

export default function DashboardLayout({
	children,
}: { children: React.ReactNode }) {
	const { data: user } = useMe();
	const pathname = usePathname();
	const isSettingsRoute = pathname.includes("/settings");
	const queryClient = useQueryClient();

	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queryClient.invalidateQueries();
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
				<NavBar onSignOut={handleSignOut} />
				{children}
			</SidebarProvider>
		</div>
	);
}
