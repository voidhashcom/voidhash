"use client";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Button,
} from "@voidhash/ui";
import { useState } from "react";
import { CreatePerkModal } from "./create-perk-modal";

export function PerksPageEmptyState({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No perks yet</CardTitle>
				<CardDescription className="max-w-md text-balance mx-auto">
					Each product may unlock one or more perks for the customer, which your
					app uses to grant access to various features. Examples of perks
					include &quot;Full-Access&quot;, &quot;AI-features&quot;, and
					&quot;Premium-recipes&quot;.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<CreatePerkModal
					open={open}
					onClose={() => setOpen(false)}
					trigger={<Button onClick={() => setOpen(true)}>Create perk</Button>}
					projectId={projectId}
					onSuccess={() => setOpen(false)}
				/>
			</CardContent>
		</Card>
	);
}
