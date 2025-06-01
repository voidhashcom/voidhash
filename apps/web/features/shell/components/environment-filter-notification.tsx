import { cn } from "@voidhash/ui";

export const EnvironmentFilterNotification = ({
	message = "You are using test data.",
	className,
	type,
}: {
	message: string;
	className?: string;
	type: "testing" | "shared";
}) => {
	return (
		<div
			className={cn(
				"p-4 border border-",
				type === "shared" &&
					"bg-card border-l-2 border-l-orange-600   text-card-foreground ",
				type === "testing" &&
					"bg-card border-l-2 border-l-primary   text-card-foreground",
				className
			)}
		>
			<div className="text-sm mt-1">{message}</div>
		</div>
	);
};
