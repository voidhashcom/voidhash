"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  cn,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@voidhash/ui";
import { Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { listProductsOptions } from "@/features/studio/lib/tanstack-query/products";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export interface ProductInputProps {
  value: { productId: string | null };
  onChange: (value: { productId: string | null }) => void;
  className?: string;
}

export function ProductInput({ value, onChange, className }: ProductInputProps) {
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string | null>(null);

  const project = useMemo(() => {
    if (!organizationSlug || !projectSlug) return null;
    return CurrentUser.getProjectBySlugs(user, organizationSlug as string, projectSlug as string);
  }, [user, organizationSlug, projectSlug]);

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    ...listProductsOptions({ projectId: project?.id ?? "" }),
    enabled: !!project?.id,
  });

  const selectedProduct = useMemo(() => {
    if (!value.productId || !products) return null;
    return products.find((p) => p.id === value.productId) ?? null;
  }, [value.productId, products]);

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (searchQuery === null || searchQuery === "") return products;
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, searchQuery]);

  // Display value: show search query when searching, otherwise show selected product name
  const displayValue = searchQuery !== null ? searchQuery : (selectedProduct?.name ?? "");

  const handleValueChange = (newValue: string | null) => {
    onChange({ productId: newValue });
    setSearchQuery(null); // Reset to show product name
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleFocus = () => {
    // When focused, start with empty search to show all products
    setSearchQuery("");
  };

  const handleBlur = () => {
    // When blurred without selection, reset to show product name
    setSearchQuery(null);
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex h-7 min-w-24 flex-1 items-center rounded-sm px-2 dark:bg-input/60",
          className,
        )}
      >
        <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div
        className={cn(
          "flex h-7 min-w-24 flex-1 items-center rounded-sm px-2 text-xs text-destructive dark:bg-input/60",
          className,
        )}
      >
        Failed to load products
      </div>
    );
  }

  return (
    <Combobox onValueChange={handleValueChange} value={value.productId}>
      <ComboboxInput
        className={cn(
          "h-7 min-w-24 flex-1 rounded-sm border-none text-xs dark:bg-input/60",
          className,
        )}
        onBlur={handleBlur}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder="Select product..."
        showTrigger
        value={displayValue}
      />
      <ComboboxContent>
        <ComboboxList>
          {filteredProducts.length === 0 && <ComboboxEmpty>No products found</ComboboxEmpty>}
          {filteredProducts.map((product) => (
            <ComboboxItem key={product.id} value={product.id}>
              <span>{product.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{product.type}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
