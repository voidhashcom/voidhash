import { getProjectsByOrganizationSlug } from "@/lib/services/projects/queries";
import {
	Card,
	GradientAvatar,
	DropdownMenu,
	DropdownMenuTrigger,
	Button,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import Link from "next/link";
import { getOrganizationBySlug } from "@/lib/services/organizations/queries";
import { notFound } from "next/navigation";
import { EmptyState } from "./empty-state";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";

export async function ProjectsList({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const activeOrganizationPromise = getOrganizationBySlug({
		ctx: serviceContext,
		input: {
			slug: organizationSlug,
		},
	});
	const organizationProjectsPromise = getProjectsByOrganizationSlug({
		ctx: serviceContext,
		input: {
			slug: organizationSlug,
		},
	});

	const [activeOrganization, organizationProjects] = await Promise.all([
		activeOrganizationPromise,
		organizationProjectsPromise,
	]);

	if (!activeOrganization) {
		return notFound();
	}

	if (organizationProjects?.length === 0) {
		return (
			<EmptyState
				organizationId={activeOrganization?.id}
				organizationSlug={organizationSlug as string}
			/>
		);
	}

	return (
		<Card className="divide-y grid p-0 gap-0">
			{organizationProjects?.map((project) => (
				<div
					className="relative isolate group hover:bg-accent/30 px-6 py-4"
					key={project.id}
				>
					<Link
						className="inset-0 absolute w-full h-full"
						href={`/${organizationSlug}/${project.slug}`}
					></Link>
					<div className="flex flex-row items-center justify-between">
						<div className="flex items-center gap-4">
							<GradientAvatar
								className="h-8 w-8 rounded-lg text-xs"
								src={undefined}
								alt={project.name}
								fallback={project.id}
							/>
							<div className="flex flex-col">
								<p>{project.name}</p>
								<p className="text-sm text-muted-foreground mt-1">
									No URL specified
								</p>
							</div>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline" size="icon" className="z-20">
									<EllipsisVerticalIcon className="w-4 h-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-48" align="end">
								<DropdownMenuItem asChild>
									<Link
										href={`/${organizationSlug}/${project.slug}/settings/general`}
									>
										Settings
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			))}
		</Card>
	);
}
