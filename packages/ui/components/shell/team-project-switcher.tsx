import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	GradientAvatar,
	useSidebar,
} from "@voidhash/ui";

export function TeamProjectSwitcher({
	teams,
	onTeamSelected,
	onProjectSelected,
}: {
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
	onTeamSelected?: (team: {
		id: string;
		name: string;
		logo: React.ElementType;
		plan: string;
	}) => void;
	onProjectSelected?: (project: {
		name: string;
		logo: React.ElementType;
	}) => void;
}) {
	const { isMobile } = useSidebar();
	const [activeTeam, setActiveTeam] = React.useState(teams[0]);
	const [highlightedTeamIndex, setHighlightedTeamIndex] = React.useState(0);

	if (!activeTeam) {
		return null;
	}

	const highlightedTeamProjects = teams[highlightedTeamIndex].projects.map(
		(project) => ({
			...project,
			logo: project.logo,
		})
	);

	const handleTeamSelect = (team: (typeof teams)[0]) => {
		setActiveTeam(team);
		onTeamSelected?.(team);
	};

	const handleProjectSelect = (
		project: (typeof highlightedTeamProjects)[0]
	) => {
		onProjectSelected?.(project);
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					size={"icon"}
					variant={"ghost"}
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-0 px-1"
				>
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
				align="start"
				side={"bottom"}
				sideOffset={4}
			>
				<div className="flex flex-row divide-x divide-border">
					<div className="min-w-56">
						<div className="px-2 py-1.5 text-xs text-muted-foreground">
							Teams
						</div>
						{teams.map((team, index) => (
							<button
								key={team.name}
								onMouseEnter={() => setHighlightedTeamIndex(index)}
								onClick={() => handleTeamSelect(team)}
								className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground"
							>
								<GradientAvatar
									className="h-6 w-6 rounded-lg text-xs"
									src={undefined}
									alt={team.name}
									fallback={team.name}
								/>
								{team.name}
								{team.id === activeTeam.id && (
									<Check className="ml-auto h-4 w-4" />
								)}
							</button>
						))}
						<div className="h-px bg-border" />
						<button className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground">
							<div className="flex size-6 items-center justify-center rounded-md border bg-background">
								<Plus className="size-4" />
							</div>
							<div className="font-medium text-muted-foreground">Add team</div>
						</button>
					</div>
					<div className="min-w-56">
						<div className="px-2 py-1.5 text-xs text-muted-foreground">
							Projects
						</div>
						{highlightedTeamProjects.map((project, index) => (
							<button
								key={project.name}
								onClick={() => handleProjectSelect(project)}
								className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground"
							>
								{project.name}
							</button>
						))}
						<div className="h-px bg-border" />
						<button className="flex w-full items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground">
							<div className="flex size-6 items-center justify-center rounded-md border bg-background">
								<Plus className="size-4" />
							</div>
							<div className="font-medium text-muted-foreground">
								Add project
							</div>
						</button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
