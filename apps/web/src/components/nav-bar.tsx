import {
	Logo,
	NavSlashSeparator,
	ProjectSwitcher,
	SidebarTrigger,
	TeamSwitcher,
} from "@voidhash/ui";
import { GalleryVerticalEnd, AudioWaveform, Command } from "lucide-react";
import { useState } from "react";

export function NavBar() {
	const teams = [
		{
			id: "1",
			name: "Acme Inc",
			logo: GalleryVerticalEnd,
			plan: "Enterprise",
			projects: [
				{
					id: "1-1",
					name: "Project 1",
					logo: GalleryVerticalEnd,
				},
			],
		},
		{
			id: "2",
			name: "Acme Corp.",
			logo: AudioWaveform,
			plan: "Startup",
			projects: [
				{
					id: "2-1",
					name: "Project 1",
					logo: GalleryVerticalEnd,
				},
			],
		},
		{
			id: "3",
			name: "Evil Corp.",
			logo: Command,
			plan: "Free",
			projects: [],
		},
	];

	const [activeTeam, setActiveTeam] = useState(teams[0]);

	if (!activeTeam) {
		return null;
	}

	return (
		<div className="p-4 border-b border-border w-full fixed top-0 left-0 right-0 bg-background z-50 h-[var(--header-height)] flex items-center justify-between">
			<div className="flex items-center gap-7">
				<SidebarTrigger className="px-4" />
				<Logo />
				<div className="flex items-center gap-2">
					<TeamSwitcher teams={teams} activeTeam={activeTeam} />
					<NavSlashSeparator />
					<ProjectSwitcher teams={teams} activeTeam={activeTeam} />
				</div>
			</div>
		</div>
	);
}
