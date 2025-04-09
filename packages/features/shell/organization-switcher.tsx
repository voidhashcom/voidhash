import { GradientAvatar } from "@voidhash/ui/gradient-avatar";
import { OrganizationProjectSwitcher } from "./organization-project-switcher";
import { useActiveOrganization } from "./hooks/useActiveOrganization";
import Link from "next/link";

export function OrganizationSwitcher() {
	const { activeOrganization, isLoading } = useActiveOrganization();
	if (!activeOrganization) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<Link href={`/~/${activeOrganization.slug}`}>
				<div className="flex items-center gap-2">
					<GradientAvatar
						className="h-6 w-6 rounded-lg text-xs"
						src={undefined}
						alt={activeOrganization.name}
						fallback={activeOrganization.id}
					/>
					<span className="truncate text-sm text-foreground-">
						{activeOrganization.name}
					</span>
				</div>
			</Link>
			<OrganizationProjectSwitcher />
		</div>
	);
}
