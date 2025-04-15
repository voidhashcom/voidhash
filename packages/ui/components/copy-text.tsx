import { Copy } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "../lib/utils";

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
		<div className={cn("flex items-center space-x-2", className)}>
			<span className="flex-1 min-w-0 w-32 whitespace-pre-wrap break-words ">
				{text}
			</span>
			<Button
				size={"sm"}
				variant={"outline"}
				onClick={handleCopy}
				className="flex space-x-2"
			>
				<Copy size={16} strokeWidth={1.5} />
				<span>{"Copy"}</span>
			</Button>
		</div>
	);
}
