"use client";
import { authClient } from "@voidhash/auth/client";
import { SidebarInset } from "@voidhash/ui";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { OrganizationSidebar } from "@voidhash/features/shell/organization-sidebar";
import { OrganizationSettingsSidebar } from "@voidhash/features/shell/organization-settings-sidebar";
import { useMe } from "@voidhash/features/auth/hooks/useMe";

export default function OrganizationLayout({
	children,
}: { children: React.ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const { data: me } = useMe();

	const queryClient = useQueryClient();
	const handleSignOut = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ["user"] });
					router.refresh();
				},
				onError: () => {
					toast.error("Failed to sign out");
				},
			},
		});
	};

	const isSettingsRoute = pathname.includes("/settings");

	return (
		<div className="flex flex-1">
			<div className="flex flex-row">
				<OrganizationSidebar user={me!} onSignOut={handleSignOut} />
				{isSettingsRoute && <OrganizationSettingsSidebar />}
			</div>
			<SidebarInset className="top-[var(--header-height)]">
				{children}
			</SidebarInset>
		</div>
	);
}
