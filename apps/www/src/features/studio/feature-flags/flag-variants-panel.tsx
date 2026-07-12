import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@voidhash/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { queryKeys, updateFeatureFlagVariantsOptions } from "@/features/studio/lib/tanstack-query";

import type { FlagType } from "./flag-type";

type Variant = {
  _id: string;
  key: string;
  name: string;
  payload?: unknown;
  weightBps: number;
};

type FeatureFlagVariant = {
  key: string;
  name: string;
  payload: unknown;
  weightBps: number;
};

const VARIANT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

let variantCounter = 0;

export function FlagVariantsPanel({
  featureFlagId,
  flagType,
  readOnly,
  variants,
}: {
  featureFlagId: string;
  flagType: FlagType;
  readOnly?: boolean;
  variants: FeatureFlagVariant[];
}) {
  const [localVariants, setLocalVariants] = useState<Variant[]>(
    variants.map((variant) => ({
      _id: `v-${variantCounter++}`,
      key: variant.key,
      name: variant.name,
      payload: variant.payload,
      weightBps: variant.weightBps,
    })),
  );
  const queryClient = useQueryClient();

  const updateVariants = useMutation({
    ...updateFeatureFlagVariantsOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.getFlag(featureFlagId),
      });
    },
  });

  const totalWeight = localVariants.reduce((sum, variant) => sum + variant.weightBps, 0);
  const isValid = localVariants.length === 0 || totalWeight === 10000;
  const isJsonMode = flagType === "json";

  const addVariant = () => {
    setLocalVariants([
      ...localVariants,
      { _id: `v-${variantCounter++}`, key: "", name: "", weightBps: 0 },
    ]);
  };

  const removeVariant = (index: number) => {
    setLocalVariants(localVariants.filter((_, variantIndex) => variantIndex !== index));
  };

  const updateVariant = (index: number, updates: Partial<Variant>) => {
    setLocalVariants(
      localVariants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...updates } : variant,
      ),
    );
  };

  const distributeEvenly = () => {
    if (localVariants.length === 0) {
      return;
    }

    const baseWeight = Math.floor(10000 / localVariants.length);
    const remainder = 10000 - baseWeight * localVariants.length;
    setLocalVariants(
      localVariants.map((variant, index) => ({
        ...variant,
        weightBps: baseWeight + (index < remainder ? 1 : 0),
      })),
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Variants</CardTitle>
        <div className="flex gap-2">
          {localVariants.length > 1 && (
            <Button disabled={readOnly} onClick={distributeEvenly} size="sm" variant="outline">
              Distribute Evenly
            </Button>
          )}
          {!isJsonMode && (
            <Button disabled={readOnly} onClick={addVariant} size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" />
              Add Variant
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {localVariants.length === 0 ? (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              No variants configured. The flag behaves as a boolean toggle.
            </p>
            {isJsonMode && (
              <Button
                disabled={readOnly}
                onClick={() => {
                  setLocalVariants([
                    {
                      _id: `v-${variantCounter++}`,
                      key: "value",
                      name: "Value",
                      payload: {},
                      weightBps: 10000,
                    },
                  ]);
                }}
                size="sm"
                variant="outline"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add JSON Value
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {isJsonMode && (
              <p className="text-muted-foreground text-sm">
                JSON flags return a single value to the SDK.
              </p>
            )}

            {localVariants.map((variant, index) => (
              <div className="space-y-3 rounded-md border p-3" key={variant._id}>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label>Name</Label>
                    <Input
                      disabled={readOnly}
                      onChange={(event) =>
                        updateVariant(index, {
                          name: event.target.value,
                        })
                      }
                      placeholder="Variant name"
                      value={variant.name}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label>Key</Label>
                    <Input
                      disabled={readOnly}
                      onChange={(event) =>
                        updateVariant(index, {
                          key: event.target.value,
                        })
                      }
                      placeholder="variant-key"
                      value={variant.key}
                    />
                  </div>
                  {!isJsonMode && (
                    <div className="w-24 space-y-1">
                      <Label>Weight</Label>
                      <div className="relative">
                        <Input
                          className="pr-6"
                          disabled={readOnly}
                          onChange={(event) => {
                            const percent = Number.parseFloat(event.target.value) || 0;
                            updateVariant(index, {
                              weightBps: Math.round(percent * 100),
                            });
                          }}
                          step="0.1"
                          type="number"
                          value={(variant.weightBps / 100).toFixed(1)}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground text-sm">
                          %
                        </span>
                      </div>
                    </div>
                  )}
                  {!isJsonMode && (
                    <Button
                      disabled={readOnly}
                      onClick={() => removeVariant(index)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {isJsonMode && (
                  <div className="space-y-1">
                    <Label>Payload (JSON)</Label>
                    <Textarea
                      className="font-mono text-sm"
                      disabled={readOnly}
                      onChange={(event) => {
                        try {
                          const parsed = JSON.parse(event.target.value);
                          updateVariant(index, {
                            payload: parsed,
                          });
                        } catch {
                          // Allow typing invalid JSON temporarily
                        }
                      }}
                      placeholder='{ "key": "value" }'
                      rows={4}
                      value={
                        variant.payload !== null && variant.payload !== undefined
                          ? JSON.stringify(variant.payload, null, 2)
                          : ""
                      }
                    />
                  </div>
                )}

                {!isJsonMode && variant.weightBps > 0 && (
                  <div
                    className={`h-1 rounded-full ${VARIANT_COLORS[index % VARIANT_COLORS.length]}`}
                    style={{
                      width: `${Math.min((variant.weightBps / 10000) * 100, 100)}%`,
                    }}
                  />
                )}
              </div>
            ))}

            {!isJsonMode && localVariants.length > 0 && (
              <div className="space-y-2">
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {localVariants.map((variant, index) => (
                    <div
                      className={`${VARIANT_COLORS[index % VARIANT_COLORS.length]} transition-all`}
                      key={variant._id}
                      style={{
                        width: `${(variant.weightBps / 10000) * 100}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="text-sm">
                  <span className={isValid ? "text-muted-foreground" : "text-destructive"}>
                    Total: {(totalWeight / 100).toFixed(1)}%
                  </span>
                  {!isValid && <span className="ml-2 text-destructive">— must sum to 100%</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end border-t pt-4">
        <Button
          disabled={readOnly || !isValid || updateVariants.isPending}
          onClick={() =>
            updateVariants.mutate({
              featureFlagId,
              variants: localVariants.map(({ _id: _variantId, ...variant }) => variant),
            })
          }
        >
          {updateVariants.isPending ? "Saving..." : "Save Variants"}
        </Button>
      </CardFooter>
    </Card>
  );
}
