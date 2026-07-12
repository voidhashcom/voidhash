"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { Variable, VariableType } from "@voidhash/mimic-schema";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@voidhash/ui";
import { InputGroup, InputGroupInput } from "@voidhash/ui/input-group";
import { MinusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { listProductsOptions } from "@/features/studio/lib/tanstack-query/products";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { LiteralInput } from "@/features/studio/paywalls/designer/components/variables/literal-input";
import { PopoverHeader } from "../../../components/ui/popover-header";

function useProductName(productId: string | null): string | null {
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();

  const project = useMemo(() => {
    if (!organizationSlug || !projectSlug) return null;
    return CurrentUser.getProjectBySlugs(user, organizationSlug as string, projectSlug as string);
  }, [user, organizationSlug, projectSlug]);

  const { data: products } = useQuery({
    ...listProductsOptions({ projectId: project?.id ?? "" }),
    enabled: !!project?.id && !!productId,
  });

  return useMemo(() => {
    if (!productId || !products) return null;
    return products.find((p) => p.id === productId)?.name ?? null;
  }, [productId, products]);
}

function getValueDisplayText(value: VariableType, productName: string | null): string {
  switch (value.key) {
    case "string":
      return value.value || '""';
    case "number":
      return String(value.value);
    case "boolean":
      return value.value ? "True" : "False";
    case "product":
      if (!value.value.productId) return "None";
      return productName ?? "...";
  }
}

export interface VariableRowProps {
  variable: Variable;
  onUpdateName: (newName: string) => void;
  onUpdateValue: (newValue: VariableType) => void;
  onRemove: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VariableRow({
  variable,
  onUpdateName,
  onUpdateValue,
  onRemove,
  isOpen,
  onOpenChange,
}: VariableRowProps) {
  // Local editing state - only persisted when popover closes
  const [editName, setEditName] = useState(variable.name);
  const [editValue, setEditValue] = useState<VariableType>(variable.value);

  // Reset local state when popover opens or variable changes from outside
  useEffect(() => {
    if (isOpen) {
      setEditName(variable.name);
      setEditValue(variable.value);
    }
  }, [isOpen, variable.name, variable.value]);

  const displayProductId =
    variable.value.key === "product" ? (variable.value.value.productId ?? null) : null;
  const productName = useProductName(displayProductId);
  const valueDisplay = getValueDisplayText(variable.value, productName);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Persist changes when closing
      if (editName !== variable.name) {
        onUpdateName(editName);
      }
      if (JSON.stringify(editValue) !== JSON.stringify(variable.value)) {
        onUpdateValue(editValue);
      }
    }
    onOpenChange(open);
  };

  return (
    <div className="flex flex-row items-center gap-2">
      <Popover onOpenChange={handleOpenChange} open={isOpen}>
        <PopoverTrigger asChild>
          <Button className="flex-1 justify-start gap-0 px-0" size="sm" variant="secondary">
            <span className="flex-1 truncate border-r border-border px-2 text-left text-xs">
              {variable.name || "Unnamed"}
            </span>
            <span className="flex-1 truncate px-2 text-left text-xs text-muted-foreground">
              {valueDisplay}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="left"
          sideOffset={4}
        >
          <PopoverHeader title="Variable" onClose={() => handleOpenChange(false)} />
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">Name</span>
              <InputGroup className="h-7 rounded-sm border-none dark:bg-input/60">
                <InputGroupInput
                  aria-label="Variable name"
                  className="h-7 px-1 py-0 pl-2 text-xs"
                  onChange={(e) => setEditName(e.target.value)}
                  value={editName}
                />
              </InputGroup>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">Value</span>
              <LiteralInput
                className="flex flex-row gap-1"
                onChange={setEditValue}
                value={editValue}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button onClick={onRemove} size="icon-sm" variant="secondary">
        <MinusIcon />
      </Button>
    </div>
  );
}
