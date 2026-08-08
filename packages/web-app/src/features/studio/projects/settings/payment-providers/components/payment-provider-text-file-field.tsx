import {
  Button,
  Dropzone,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@voidhash/ui";
import { CheckCircleIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

export function PaymentProviderTextFileField<TFieldValues extends FieldValues>({
  accept,
  control,
  label,
  maxSize,
  name,
  successMessage,
  validationIndicator,
}: {
  accept: string;
  control: Control<TFieldValues>;
  label?: string;
  maxSize: number;
  name: FieldPath<TFieldValues>;
  successMessage: string;
  validationIndicator?: ReactNode;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const handleFileChange = (file: File) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            field.onChange(event.target?.result ?? "");
          };
          reader.readAsText(file);
        };

        return (
          <FormItem className="flex flex-col gap-2">
            {label ? <FormLabel>{label}</FormLabel> : null}
            <FormControl>
              {field.value ? (
                <div className="flex flex-row items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 ring-1 ring-border/60">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-500" />
                    <p className="truncate text-[13px] text-muted-foreground">{successMessage}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {validationIndicator}
                    <Button
                      onClick={(event) => {
                        event.preventDefault();
                        field.onChange("");
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <XIcon className="h-4 w-4" />
                      <span>Remove</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Dropzone accept={accept} maxSize={maxSize} onFileChange={handleFileChange} />
                  {validationIndicator ? (
                    <div className="absolute top-2 right-2">{validationIndicator}</div>
                  ) : null}
                </div>
              )}
            </FormControl>
            <FormMessage className="sr-only" />
          </FormItem>
        );
      }}
    />
  );
}
