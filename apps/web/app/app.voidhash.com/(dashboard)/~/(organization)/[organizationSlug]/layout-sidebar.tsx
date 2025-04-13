"use client";

import { useSidebar } from "@voidhash/ui";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function LayoutSidebar({
	organizationSidebar,
	organizationSettingsSidebar,
}: {
	organizationSidebar: React.ReactNode;
	organizationSettingsSidebar: React.ReactNode;
}) {
	const pathname = usePathname();
	const isSettingsRoute = pathname.includes("/settings");

	const { setOpen } = useSidebar();
	useEffect(() => {
		if (isSettingsRoute) {
			setOpen(false);
		} else if (!isSettingsRoute) {
			setOpen(true);
		}
	}, [isSettingsRoute, setOpen]);

	return (
		<div className="flex flex-row">
			{organizationSidebar}
			{isSettingsRoute && organizationSettingsSidebar}
		</div>
	);
}
