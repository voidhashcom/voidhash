/** biome-ignore-all lint/a11y/noStaticElementInteractions: shadcn */
/** biome-ignore-all lint/nursery/noNoninteractiveElementInteractions: shadcn */
import { UploadIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";

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

    const files = [...e.dataTransfer.files];
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
    const { files } = e.target;
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
        "group relative isolate flex w-full cursor-pointer select-none flex-col items-center justify-center rounded-lg border border-dashed p-6 transition-colors focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-ring/50",
        isDragging ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/50",
        className,
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      // onClick={() => inputRef.current?.click()}
      {...props}
    >
      <input
        accept={accept}
        className="absolute inset-0 top-0 left-0 h-full w-full cursor-pointer opacity-0"
        multiple={multiple}
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <UploadIcon className="mb-3 text-muted-foreground" />
      <p className="text-center text-muted-foreground text-sm">
        Drag and drop a file here, or click to select
      </p>
      {maxSize && (
        <p className="mt-1 text-muted-foreground text-xs">
          Max file size: {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      )}
    </div>
  );
}
