"use client";

import { switchEnvironment } from "@/lib/actions/environments/switch-environment";
import { Environment } from "@/lib/environments/types";
import { cn, Label, Switch } from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function NavProjectEnvironmentToggle({
	environment,
	projectId,
}: { environment: Environment; projectId: string }) {
	const router = useRouter();
	const { execute, isExecuting } = useAction(switchEnvironment, {
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
				className={cn(environment === "testing" && "text-orange-600")}
			>
				Test Mode
			</Label>
			<Switch
				id="test-mode-switch"
				checked={environment === "testing"}
				disabled={isExecuting}
				className="data-[state=checked]:bg-orange-600"
				onCheckedChange={handleSwitch}
			/>
		</div>
	);
}
