"use client";

import { SidebarProvider } from "@voidhash/ui";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const isSettingsRoute = pathname.includes("/settings");

	return (
		<div className="flex flex-col [--header-height:calc(theme(spacing.14))] has-[div#nav-enviromental-bar]:[--header-height:calc(theme(spacing.24))]">
			<SidebarProvider defaultOpen={!isSettingsRoute} className="flex flex-col">
				{children}
			</SidebarProvider>
		</div>
	);
}
