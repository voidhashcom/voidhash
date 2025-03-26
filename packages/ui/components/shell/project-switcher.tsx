import * as React from "react";
import { ChevronsUpDown, Plus } from "lucide-react";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
	GradientAvatar,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	TeamProjectSwitcher,
	useSidebar,
} from "@voidhash/ui";

export function ProjectSwitcher({
	teams,
	activeTeam,
}: {
	activeTeam: {
		id: string;
		name: string;
		logo: React.ElementType;
	};
	teams: {
		id: string;
		name: string;
		logo: React.ElementType;
		plan: string;
		projects: {
			name: string;
			logo: React.ElementType;
		}[];
	}[];
}) {
	const { isMobile } = useSidebar();

	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-2">
				<span className="truncate text-sm text-foreground-">
					{activeTeam.name}
				</span>
			</div>
			<TeamProjectSwitcher teams={teams} />
		</div>
	);
}
