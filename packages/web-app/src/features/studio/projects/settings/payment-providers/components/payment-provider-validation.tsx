"use client";

import { cn, Tooltip, TooltipContent, TooltipTrigger } from "@voidhash/ui";
import { CheckIcon, CircleDotDashedIcon, TriangleAlertIcon } from "lucide-react";
import { get, type FieldErrors, type FieldPath, type FieldValues } from "react-hook-form";

import type { PaymentProviderDetailTab } from "./payment-provider-detail-tab-nav";

export type PaymentProviderFieldValidationStatus =
  | { state: "valid"; message: string }
  | { state: "invalid"; message: string }
  | { state: "optional"; message: string };

export function PaymentProviderFieldValidationIndicator({
  status,
}: {
  status: PaymentProviderFieldValidationStatus;
}) {
  if (status.state === "optional") {
    return null;
  }

  return <PaymentProviderValidationStatusIndicator status={status} />;
}

export function PaymentProviderValidationStatusIndicator({
  status,
}: {
  status: PaymentProviderFieldValidationStatus;
}) {
  const className = cn(
    "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
    status.state === "valid" && "border-primary bg-primary text-primary-foreground",
    status.state === "invalid" && "border-blaze-orange-500 bg-blaze-orange-500 text-black",
    status.state === "optional" && "border-border bg-muted text-muted-foreground",
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={status.message}
          className={className}
          onClick={(event) => event.preventDefault()}
          type="button"
        >
          {status.state === "valid" ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
          {status.state === "invalid" ? <TriangleAlertIcon className="size-3" /> : null}
          {status.state === "optional" ? <CircleDotDashedIcon className="size-3.5" /> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{status.message}</TooltipContent>
    </Tooltip>
  );
}

export function getPaymentProviderFieldValidationStatus<TFieldValues extends FieldValues>({
  disabled,
  errors,
  fieldLabels,
  name,
  optional = false,
  value,
}: {
  disabled?: boolean;
  errors: FieldErrors<TFieldValues>;
  fieldLabels: Partial<Record<string, string>>;
  name: FieldPath<TFieldValues>;
  optional?: boolean;
  value: unknown;
}): PaymentProviderFieldValidationStatus {
  if (disabled) {
    return { message: "Not required", state: "optional" };
  }

  const errorMessage = getPaymentProviderFieldErrorMessage(errors, name);
  if (errorMessage) {
    return { message: errorMessage, state: "invalid" };
  }

  if (optional && isEmptyPaymentProviderFieldValue(value)) {
    return { message: "Optional", state: "optional" };
  }

  if (!optional && isEmptyPaymentProviderFieldValue(value)) {
    const fieldLabel = fieldLabels[name] ?? "This field";

    return {
      message: `${fieldLabel} is required`,
      state: "invalid",
    };
  }

  return { message: "Valid", state: "valid" };
}

export function getPaymentProviderTabValidationSummary<TFieldValues extends FieldValues>({
  errors,
  fieldLabels,
  fields,
  isOptionalField,
  values,
}: {
  errors: FieldErrors<TFieldValues>;
  fieldLabels: Partial<Record<string, string>>;
  fields: readonly FieldPath<TFieldValues>[];
  isOptionalField: (field: FieldPath<TFieldValues>, values: TFieldValues) => boolean;
  values: TFieldValues;
}): Pick<PaymentProviderDetailTab, "message" | "status"> {
  if (fields.length === 0) {
    return { message: "Optional section", status: "optional" };
  }

  const fieldStatuses = fields.map((field) => ({
    field,
    status: getPaymentProviderFieldValidationStatus({
      errors,
      fieldLabels,
      name: field,
      optional: isOptionalField(field, values),
      value: get(values, field),
    }),
  }));
  const requiredFields = fields.filter((field) => !isOptionalField(field, values));

  if (
    requiredFields.length > 0 &&
    requiredFields.every((field) => isEmptyPaymentProviderFieldValue(get(values, field)))
  ) {
    return { message: "Section not started", status: "untouched" };
  }

  const invalidField = fieldStatuses.find(({ status }) => status.state === "invalid");

  if (invalidField) {
    return {
      message: `${fieldLabels[invalidField.field] ?? "Field"}: ${invalidField.status.message}`,
      status: "invalid",
    };
  }

  if (fieldStatuses.every(({ status }) => status.state === "optional")) {
    return { message: "Optional section", status: "optional" };
  }

  return { message: "Section complete", status: "valid" };
}

export function isEmptyPaymentProviderFieldValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function getPaymentProviderFieldErrorMessage<TFieldValues extends FieldValues>(
  errors: FieldErrors<TFieldValues>,
  name: FieldPath<TFieldValues>,
): string | undefined {
  const error = get(errors, name);
  const message = error?.message;

  return typeof message === "string" ? message : undefined;
}
