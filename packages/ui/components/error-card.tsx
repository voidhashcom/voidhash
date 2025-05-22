import { cn } from "../lib/utils";
import { Logo } from "./logo";
import { Button } from "./ui/button";
import Link from "next/link";

export function ErrorCard({
	title,
	description,
	onRetry,
	className,
}: {
	title: string;
	description: string;
	className?: string;
	onRetry: () => void;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-6 flex-1",
				className
			)}
		>
			<Link href="/">
				<Logo />
			</Link>
			<div className="flex flex-col items-center justify-center gap-3">
				<h1 className="text-2xl font-bold">{title}</h1>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
			<Button onClick={onRetry}>Retry</Button>
		</div>
	);
}
