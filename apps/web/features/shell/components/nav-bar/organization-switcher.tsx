import { GradientAvatar } from "@voidhash/ui/gradient-avatar";

import { OrganizationProjectSwitcher } from "./organization-project-switcher";
import Link from "next/link";
import { getOrganizationBySlug } from "../../../organizations/server/cached-queries";
import { Suspense } from "react";
import { Skeleton } from "@voidhash/ui";

const OrganizationSwitcherComponent = async ({
	organizationSlug,
}: { organizationSlug: string | null }) => {
	if (!organizationSlug) {
		return null;
	}

	const activeOrganization = await getOrganizationBySlug(organizationSlug);

	if (!activeOrganization) {
		return null;
	}

	return (
		<div className="flex items-center gap-2">
			<Link href={`/~/${organizationSlug}`}>
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
};

function OrganizationSwitcherSkeleton() {
	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-2">
				<Skeleton className="w-6 h-6 rounded-full" />
				<Skeleton className="w-12 h-4 rounded-full" />
			</div>
		</div>
	);
}

export async function OrganizationSwitcher({
	organizationSlug,
}: { organizationSlug: string | null }) {
	return (
		<Suspense fallback={<OrganizationSwitcherSkeleton />}>
			<OrganizationSwitcherComponent organizationSlug={organizationSlug} />
		</Suspense>
	);
}
