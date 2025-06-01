"use client";

import { switchEnvironmentAction } from "@/lib/nextjs/server-actions";
import { Environment } from "@/lib/services/environments/types";
import { cn, Label, Switch } from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function NavProjectEnvironmentToggle({
	environment,
	projectId,
}: { environment: Environment; projectId: string }) {
	const router = useRouter();
	const { execute, isExecuting } = useAction(switchEnvironmentAction, {
		onSuccess: ({ input }) => {
			if (input.environment === "testing") {
				toast.success("Switched to testing environment");
			} else {
				toast.success("Switched to production environment");
			}
		},
		onError: () => {
			toast.error("Failed to switch environment");
		},
		onSettled: () => {
			router.refresh();
		},
	});

	const handleSwitch = () => {
		execute({
			projectId: projectId,
			environment: environment === "testing" ? "production" : "testing",
		});
	};

	return (
		<div className="flex items-center gap-2">
			<Label
				htmlFor="test-mode-switch"
				className={cn(environment === "testing" && "text-primary")}
			>
				Dev Mode
			</Label>
			<Switch
				id="test-mode-switch"
				checked={environment === "testing"}
				disabled={isExecuting}
				className="data-[state=checked]:bg-primary"
				onCheckedChange={handleSwitch}
			/>
		</div>
	);
}
