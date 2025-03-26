import { GradientAvatar } from "../gradient-avatar";
import { TeamProjectSwitcher } from "./team-project-switcher";

export function TeamSwitcher({
	activeTeam,
	teams,
}: {
	activeTeam: { id: string; name: string; logo: React.ElementType };
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
	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-2">
				<GradientAvatar
					className="h-8 w-8 rounded-lg text-xs"
					src={undefined}
					alt={activeTeam.name}
					fallback={activeTeam.name}
				/>
				<span className="truncate text-sm text-foreground-">
					{activeTeam.name}
				</span>
			</div>
			<TeamProjectSwitcher teams={teams} />
		</div>
	);
}
