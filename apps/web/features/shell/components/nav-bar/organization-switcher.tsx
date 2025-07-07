import { GradientAvatar } from "@voidhash/ui/gradient-avatar";

import { OrganizationProjectSwitcher } from "./organization-project-switcher";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@voidhash/ui";
import { OrganizationService } from "@/lib/services/organization.service";
import { UserService } from "@/lib/services/user.service";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { AuthService, AuthSession } from "@/lib/services/auth.service";

const OrganizationSwitcherComponent = async ({
	organizationSlug,
}: { organizationSlug: string | null }) => {
	if (!organizationSlug) {
		return null;
	}

	const data = await runServerEffect(
		Effect.gen(function* () {
			const authService = yield* AuthService;
			const authSession = yield* authService.authenticateWithSession();
			return yield* AuthSession.provide(authSession)(
				Effect.gen(function* () {
					const userService = yield* UserService;
					const organizationService = yield* OrganizationService;
					const [user, activeOrganization] = yield* Effect.all([
						userService.getUser(),
						organizationService.getOrganizationBySlug(organizationSlug),
					], {
						concurrency: "unbounded"
					});
					if (!activeOrganization) {
						return yield* Effect.fail(
							new NotFoundError({
								message: "Organization not found",
							})
						);
					}
					return { user, activeOrganization };
				})
			);
		})
	);

	if (data.isErr()) {
		return null;
	}

	const { user, activeOrganization } = data.value;

	return (
		<div className="flex items-center gap-2">
			<Link href={`/${organizationSlug}`}>
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
			<OrganizationProjectSwitcher
				user={user}
				activeOrganization={activeOrganization}
				activeProject={null}
			/>
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
