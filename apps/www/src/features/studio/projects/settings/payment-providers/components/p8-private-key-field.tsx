import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { PaymentProviderTextFileField } from "./payment-provider-text-file-field";

export function P8PrivateKeyField<TFieldValues extends FieldValues>({
  control,
  label,
  name,
  successMessage = "Private key was successfully attached",
  validationIndicator,
}: {
  control: Control<TFieldValues>;
  label?: string;
  name: FieldPath<TFieldValues>;
  successMessage?: string;
  validationIndicator?: ReactNode;
}) {
  return (
    <PaymentProviderTextFileField
      accept=".p8"
      control={control}
      label={label}
      maxSize={1024 * 1024}
      name={name}
      successMessage={successMessage}
      validationIndicator={validationIndicator}
    />
  );
}
