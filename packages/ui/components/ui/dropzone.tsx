import * as React from "react";
import { cn } from "../../lib/utils";
import { UploadIcon } from "lucide-react";

interface DropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
	onFileChange: (file: File) => void;
	accept?: string;
	maxSize?: number;
	multiple?: boolean;
}

export function Dropzone({
	className,
	onFileChange,
	accept,
	maxSize,
	multiple = false,
	...props
}: DropzoneProps) {
	const [isDragging, setIsDragging] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) {
			const file = files[0];
			if (maxSize && file && file.size > maxSize) {
				return;
			}
			if (file) {
				onFileChange(file);
			}
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (maxSize && file && file.size > maxSize) {
				return;
			}
			if (file) {
				onFileChange(file);
			}
		}
	};

	return (
		<div
			className={cn(
				"select-none cursor-pointer relative flex flex-col items-center justify-center w-full p-6 border border-dashed group isolate rounded-lg transition-colors focus-within:border-primary/50 focus-within:ring-ring/50 focus-within:ring-3",
				isDragging
					? "border-primary/50 bg-primary/5"
					: "border-border hover:border-primary/50",
				className
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			// onClick={() => inputRef.current?.click()}
			{...props}
		>
			<input
				ref={inputRef}
				type="file"
				className="cursor-pointer opacity-0 absolute inset-0 left-0 top-0 w-full h-full"
				accept={accept}
				multiple={multiple}
				onChange={handleFileChange}
			/>
			<UploadIcon className="mb-3 text-muted-foreground" />
			<p className="text-sm text-muted-foreground text-center">
				Drag and drop a file here, or click to select
			</p>
			{maxSize && (
				<p className="text-xs text-muted-foreground mt-1">
					Max file size: {Math.round(maxSize / 1024 / 1024)}MB
				</p>
			)}
		</div>
	);
}
