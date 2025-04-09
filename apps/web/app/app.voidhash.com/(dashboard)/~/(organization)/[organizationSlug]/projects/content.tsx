"use client";
import { useActiveOrganization } from "@voidhash/features/shell/hooks/useActiveOrganization";
import { useActiveOrganizationProjects } from "@voidhash/features/shell/hooks/useActiveOrganizationProjects";
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
import { EmptyState } from "./empty-state";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTRPC } from "@voidhash/features/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function Content() {
	const { organizationSlug } = useParams();
	const router = useRouter();
	const trpc = useTRPC();
	const { data: me, isLoading } = useQuery(trpc.auth.me.queryOptions());

	const activeOrganization = useActiveOrganization();
	const { data: projects } = useActiveOrganizationProjects();

	useEffect(() => {
		if (isLoading) return;

		const currentOrganization = me?.organizations.find(
			(org) => org.slug === organizationSlug
		);

		if (!currentOrganization) {
			router.push("/");
		}
	}, [isLoading, me, organizationSlug, router]);

	if (!activeOrganization) {
		return <div>Organization not found</div>;
	}

	if (projects?.length === 0) {
		return (
			<EmptyState
				organizationId={activeOrganization?.id}
				organizationSlug={organizationSlug as string}
			/>
		);
	}
	return (
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
								href={`/~/${organizationSlug}/${project.slug}/dashboard`}
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
												href={`/~/${organizationSlug}/${project.slug}/settings/general`}
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
	);
}
