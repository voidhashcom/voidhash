import { Button } from "react-day-picker";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "./ui/card";

import { Skeleton } from "./ui/skeleton";

export function SettingsCardSkeleton({
	description = true,
	footer = true,
	content = false,
	instructions = true,
	action = true,
}: {
	description?: boolean;
	footer?: boolean;
	content?: boolean;
	instructions?: boolean;
	action?: boolean;
}) {
	return (
		<Card className="pb-0 overflow-hidden mt-8">
			<CardHeader>
				<CardTitle>
					<Skeleton className="w-32 h-4" />
				</CardTitle>
				{description && (
					<CardDescription>
						<Skeleton className="w-48 h-4" />
					</CardDescription>
				)}
			</CardHeader>
			{content && (
				<CardContent>
					<Skeleton className="w-64 h-4" />
				</CardContent>
			)}
			{footer && (
				<CardFooter className="bg-background py-3 border-t border-border [.border-t]:pt-3 flex items-center justify-between">
					<div>{instructions && <Skeleton className="w-24 h-4" />}</div>
					{action && (
						<div>
							<Skeleton className="w-20 h-8" />
						</div>
					)}
				</CardFooter>
			)}
		</Card>
	);
}
