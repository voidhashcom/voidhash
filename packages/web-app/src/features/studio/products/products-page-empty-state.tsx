"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@voidhash/ui";
import { useState } from "react";

import { CreateProductModal } from "./create-product-modal";

export function ProductsPageEmptyState({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No products yet</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          Products are items people can purchase (e.g. Gold Monthly, Gold Yearly, All-Access Pass
          etc.). Get started by creating a product.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CreateProductModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
          open={open}
          projectId={projectId}
          trigger={<Button onClick={() => setOpen(true)}>Create product</Button>}
        />
      </CardContent>
    </Card>
  );
}
