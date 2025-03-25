import { Copy } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

export function CopyText({ text }: { text: string }) {
	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);

		toast.success("Copied to clipboard");
	};

	return (
		<div className="flex items-center space-x-2">
			<span>{text}</span>
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
