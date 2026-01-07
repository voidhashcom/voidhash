"use client";

import { Button } from "@voidhash/ui";
import { useState } from "react";

import { ProviderProductSheet } from "./provider-product-sheet";

export function ProductDetailAddProductButton({
  productId,
  providerId,
  paymentProviderConfigurationId,
  title,
  variant = "default",
}: {
  productId: string;
  paymentProviderConfigurationId: string;
  providerId: string;
  title: string;
  variant?: "default" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} type="submit" variant={variant}>
        Add {title} product
      </Button>
      <ProviderProductSheet
        mode="add"
        onClose={() => setOpen(false)}
        open={open}
        paymentProviderConfigurationId={paymentProviderConfigurationId}
        productId={productId}
        providerId={providerId}
      />
    </>
  );
}
