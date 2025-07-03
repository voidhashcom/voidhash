"use client";

import { switchEnvironmentAction } from "@/lib/nextjs/server-actions";
import { cn, Label, Switch } from "@voidhash/ui";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
	Environment as EnvironmentEnum,
	EnvironmentValue,
} from "@voidhash/lib/index";

export function NavProjectEnvironmentToggle({
	environment,
	projectId,
}: { environment: EnvironmentValue; projectId: string }) {
	const router = useRouter();
	const { execute, isExecuting } = useAction(switchEnvironmentAction, {
		onSuccess: ({ input }) => {
			if (input.environment === EnvironmentEnum.Testing) {
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
			environment:
				environment === EnvironmentEnum.Testing
					? EnvironmentEnum.Production
					: EnvironmentEnum.Testing,
		});
	};

	return (
		<div className="flex items-center gap-2">
			<Label
				htmlFor="test-mode-switch"
				className={cn(
					environment === EnvironmentEnum.Testing && "text-primary"
				)}
			>
				Dev Mode
			</Label>
			<Switch
				id="test-mode-switch"
				checked={environment === EnvironmentEnum.Testing}
				disabled={isExecuting}
				className="data-[state=checked]:bg-primary"
				onCheckedChange={handleSwitch}
			/>
		</div>
	);
}
