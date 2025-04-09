import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CreateProjectModal } from "@voidhash/features/projects/client/components/create-project-modal";
import { useActiveOrganization } from "@voidhash/features/shell/hooks/useActiveOrganization";
import { useActiveOrganizationProjects } from "@voidhash/features/shell/hooks/useActiveOrganizationProjects";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	GradientAvatar,
	Page,
} from "@voidhash/ui";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/_organization/projects"
)({
	component: RouteComponent,
	loader: ({ context, params }) => {
		const currentOrganization = context.user?.organizations.find(
			(org) => org.slug === params.organizationSlug
		);

		if (!currentOrganization) {
			return redirect({ to: "/" });
		}

		return {
			currentOrganization,
		};
	},
});

function EmptyState({
	organizationId,
	organizationSlug,
}: { organizationId: string; organizationSlug: string }) {
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No projects yet</CardTitle>
				<CardDescription>Create a project to get started.</CardDescription>
			</CardHeader>
			<CardContent>
				<CreateProjectModal
					open={open}
					onClose={() => setOpen(false)}
					trigger={
						<Button onClick={() => setOpen(true)}>Create project</Button>
					}
					organizationId={organizationId}
					organizationSlug={organizationSlug}
				/>
			</CardContent>
		</Card>
	);
}

function RouteComponent() {
	const { organizationSlug } = Route.useParams();

	const activeOrganization = useActiveOrganization();
	const { data: projects } = useActiveOrganizationProjects();

	if (!activeOrganization) {
		return <Page>Organization not found</Page>;
	}

	if (projects?.length === 0) {
		return (
			<Page>
				<EmptyState
					organizationId={activeOrganization?.id}
					organizationSlug={organizationSlug}
				/>
			</Page>
		);
	}
	return (
		<Page>
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">Projects</h1>
				<p className="text-muted-foreground mt-3">
					All projects of organization {organizationSlug}
				</p>
				<div className="mt-8">
					<Card className="divide-y grid p-0 gap-0">
						{projects?.map((project) => (
							<div
								className="relative isolate group hover:bg-accent/30 px-6 py-4"
								key={project.id}
							>
								<Link
									className="inset-0 absolute w-full h-full"
									to="/~/$organizationSlug/$projectSlug/dashboard"
									params={{
										organizationSlug,
										projectSlug: project.slug,
									}}
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
													to="/~/$organizationSlug/$projectSlug/settings/general"
													params={{
														organizationSlug,
														projectSlug: project.slug,
													}}
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
				</div>
			</div>
		</Page>
	);
}
