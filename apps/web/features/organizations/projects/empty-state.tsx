"use client";
import { CreateProjectModal } from "@/features/projects/create-project-modal";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Button,
} from "@voidhash/ui";
import { useState } from "react";

export function EmptyState({
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
