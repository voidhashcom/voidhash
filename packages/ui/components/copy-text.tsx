import { Copy, CopyIcon } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

export function CopyText({
	text,
	className,
}: { text: string; className?: string }) {
	const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		await navigator.clipboard.writeText(text);

		toast.success("Copied to clipboard");
	};

	return (
		<div className={cn("flex items-center space-x-4", className)}>
			<span className="flex-1 min-w-0 w-32 whitespace-pre-wrap break-words ">
				{text}
			</span>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon"
							className="z-20"
							onClick={handleCopy}
						>
							<CopyIcon className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Click to copy</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}
