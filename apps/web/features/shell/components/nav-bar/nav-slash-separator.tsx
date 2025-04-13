import { cn } from "@voidhash/ui/utils";

export function NavSlashSeparator({ className }: { className?: string }) {
	return (
		<svg
			className={cn("w-4 h-4 text-muted-foreground", className)}
			viewBox="0 0 9 22"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M1 21L8.5 0.5" stroke="currentColor" />
		</svg>
	);
}
