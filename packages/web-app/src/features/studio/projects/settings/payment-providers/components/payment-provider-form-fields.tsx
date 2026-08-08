"use client";

import {
  Button,
  Calendar,
  cn,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from "@voidhash/ui";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@voidhash/ui/input-group";
import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import type {
  Control,
  ControllerRenderProps,
  FieldErrors,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { WhereToFindGuide } from "@/features/docs/components/where-to-find-guide";
import { SettingsRow } from "@/features/studio/settings";

import {
  getPaymentProviderFieldValidationStatus,
  PaymentProviderFieldValidationIndicator,
  PaymentProviderValidationStatusIndicator,
} from "./payment-provider-validation";

export function PaymentProviderTextFieldRow<TFieldValues extends FieldValues>({
  control,
  description,
  disabled = false,
  errors,
  fieldLabels,
  guide,
  name,
  optional = false,
  placeholder,
  prefix,
  showOptionalIndicator = false,
  showValidationIndicator = true,
  title,
  type = "text",
}: {
  control: Control<TFieldValues>;
  description?: ReactNode;
  disabled?: boolean;
  errors: FieldErrors<TFieldValues>;
  fieldLabels: Partial<Record<string, string>>;
  guide?: string;
  name: FieldPath<TFieldValues>;
  optional?: boolean;
  placeholder?: string;
  prefix?: ReactNode;
  showOptionalIndicator?: boolean;
  showValidationIndicator?: boolean;
  title: ReactNode;
  type?: "password" | "text" | "url";
}) {
  return (
    <SettingsRow
      control={
        <div className="flex w-full items-center gap-4 sm:w-auto">
          {prefix}
          <FormField
            control={control}
            name={name}
            render={({ field }) => {
              const { value, ...fieldProps } = field;
              const status = getPaymentProviderFieldValidationStatus({
                disabled,
                errors,
                fieldLabels,
                name,
                optional,
                value,
              });
              const shouldRenderIndicator =
                showValidationIndicator &&
                (showOptionalIndicator || status.state !== "optional");

              return (
                <FormItem className="w-full sm:w-96">
                  <FormControl>
                    <InputGroup>
                      <InputGroupInput
                        disabled={disabled}
                        placeholder={placeholder}
                        type={type}
                        value={String(value ?? "")}
                        {...fieldProps}
                      />
                      {shouldRenderIndicator ? (
                        <InputGroupAddon align="inline-end">
                          {showOptionalIndicator ? (
                            <PaymentProviderValidationStatusIndicator status={status} />
                          ) : (
                            <PaymentProviderFieldValidationIndicator status={status} />
                          )}
                        </InputGroupAddon>
                      ) : null}
                    </InputGroup>
                  </FormControl>
                  <FormMessage className="sr-only" />
                </FormItem>
              );
            }}
          />
        </div>
      }
      description={description}
      status={guide ? <WhereToFindGuide fieldLabel={title} guide={guide} /> : undefined}
      title={title}
    />
  );
}

export function PaymentProviderDateFieldRow<TFieldValues extends FieldValues>({
  control,
  description,
  disabled = false,
  errors,
  fieldLabels,
  fromYear = 2008,
  guide,
  name,
  optional = false,
  prefix,
  showOptionalIndicator = false,
  showValidationIndicator = true,
  title,
  toYear = new Date().getFullYear() + 20,
}: {
  control: Control<TFieldValues>;
  description?: ReactNode;
  disabled?: boolean;
  errors: FieldErrors<TFieldValues>;
  fieldLabels: Partial<Record<string, string>>;
  fromYear?: number;
  guide?: string;
  name: FieldPath<TFieldValues>;
  optional?: boolean;
  prefix?: ReactNode;
  showOptionalIndicator?: boolean;
  showValidationIndicator?: boolean;
  title: ReactNode;
  toYear?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <SettingsRow
      control={
        <div className="flex w-full items-center gap-4 sm:w-auto">
          {prefix}
          <FormField
            control={control}
            name={name}
            render={({ field }) => {
              const selectedDate =
                typeof field.value === "string" ? parseIsoDate(field.value) : undefined;
              const status = getPaymentProviderFieldValidationStatus({
                disabled,
                errors,
                fieldLabels,
                name,
                optional,
                value: field.value,
              });

              return (
                <FormItem className="w-full sm:w-96">
                  <div className="flex w-full items-center gap-2">
                    <Popover onOpenChange={setOpen} open={open}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            className={cn(
                              "min-w-0 flex-1 justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground",
                            )}
                            disabled={disabled}
                            type="button"
                            variant="outline"
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP") : <span>Select date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          captionLayout="dropdown"
                          fromYear={fromYear}
                          mode="single"
                          onSelect={(date) => {
                            field.onChange(date ? toIsoDate(date) : "");
                            setOpen(false);
                          }}
                          selected={selectedDate}
                          toYear={toYear}
                        />
                      </PopoverContent>
                    </Popover>
                    {selectedDate ? (
                      <Button
                        aria-label="Clear date"
                        disabled={disabled}
                        onClick={() => field.onChange("")}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {showValidationIndicator ? (
                      showOptionalIndicator ? (
                        <PaymentProviderValidationStatusIndicator status={status} />
                      ) : (
                        <PaymentProviderFieldValidationIndicator status={status} />
                      )
                    ) : null}
                  </div>
                  <FormMessage className="sr-only" />
                </FormItem>
              );
            }}
          />
        </div>
      }
      description={description}
      status={guide ? <WhereToFindGuide fieldLabel={title} guide={guide} /> : undefined}
      title={title}
    />
  );
}

export function PaymentProviderSwitchRow<TFieldValues extends FieldValues>({
  control,
  description,
  disabled = false,
  name,
  onCheckedChange,
  title,
}: {
  control: Control<TFieldValues>;
  description?: ReactNode;
  disabled?: boolean;
  name: FieldPath<TFieldValues>;
  onCheckedChange?: (
    checked: boolean,
    field: ControllerRenderProps<TFieldValues, FieldPath<TFieldValues>>,
  ) => void;
  title: ReactNode;
}) {
  return (
    <SettingsRow
      control={
        <FormField
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Switch
                  checked={Boolean(field.value)}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    if (onCheckedChange) {
                      onCheckedChange(checked, field);
                      return;
                    }

                    field.onChange(checked);
                  }}
                />
              </FormControl>
              <FormMessage className="sr-only" />
            </FormItem>
          )}
        />
      }
      description={description}
      title={title}
    />
  );
}

function parseIsoDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
