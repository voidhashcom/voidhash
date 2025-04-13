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
		<div className="flex flex-col [--header-height:calc(--spacing(14))]">
			<SidebarProvider defaultOpen={!isSettingsRoute} className="flex flex-col">
				{children}
			</SidebarProvider>
		</div>
	);
}
