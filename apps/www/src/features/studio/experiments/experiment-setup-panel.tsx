import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@voidhash/ui";
import { Info, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { queryKeys, replaceExperimentVariantsOptions } from "@/features/studio/lib/tanstack-query";

type LocalVariant = {
  _id: string;
  key: string;
  name: string;
  isControl: boolean;
  weightBps: number;
};

type ExperimentVariant = {
  key: string;
  name: string;
  isControl: boolean;
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

export function ExperimentSetupPanel({
  experimentId,
  readOnly,
  variants,
}: {
  experimentId: string;
  readOnly?: boolean;
  variants: ExperimentVariant[];
}) {
  const [localVariants, setLocalVariants] = useState<LocalVariant[]>(
    variants.map((variant) => ({
      _id: `v-${variantCounter++}`,
      key: variant.key,
      name: variant.name,
      isControl: variant.isControl,
      weightBps: variant.weightBps,
    })),
  );
  const queryClient = useQueryClient();

  const replaceVariants = useMutation({
    ...replaceExperimentVariantsOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.experiment.getExperiment(experimentId),
      });
    },
  });

  const totalWeight = localVariants.reduce((sum, variant) => sum + variant.weightBps, 0);
  const controlCount = localVariants.filter((variant) => variant.isControl).length;
  const hasBlankKey = localVariants.some((variant) => variant.key.trim().length === 0);
  const isValid =
    localVariants.length >= 2 &&
    totalWeight === 10000 &&
    controlCount === 1 &&
    !hasBlankKey;

  const addVariant = () => {
    setLocalVariants([
      ...localVariants,
      {
        _id: `v-${variantCounter++}`,
        key: "",
        name: "",
        isControl: localVariants.length === 0,
        weightBps: 0,
      },
    ]);
  };

  const removeVariant = (index: number) => {
    setLocalVariants(localVariants.filter((_, variantIndex) => variantIndex !== index));
  };

  const updateVariant = (index: number, updates: Partial<LocalVariant>) => {
    setLocalVariants(
      localVariants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...updates } : variant,
      ),
    );
  };

  // Only one variant may be the control; setting a new one clears the rest.
  const setControl = (index: number) => {
    setLocalVariants(
      localVariants.map((variant, variantIndex) => ({
        ...variant,
        isControl: variantIndex === index,
      })),
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
          <Button disabled={readOnly} onClick={addVariant} size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" />
            Add Variant
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {readOnly && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Variants and weights are locked while the experiment is running. Pause it to make
              changes.
            </AlertDescription>
          </Alert>
        )}

        {localVariants.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No variants yet. Add at least a control and one treatment variant.
          </p>
        ) : (
          <div className="space-y-4">
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
                  <Button
                    disabled={readOnly}
                    onClick={() => removeVariant(index)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={variant.isControl}
                    disabled={readOnly || variant.isControl}
                    id={`control-${variant._id}`}
                    onCheckedChange={() => setControl(index)}
                  />
                  <Label className="text-muted-foreground text-sm" htmlFor={`control-${variant._id}`}>
                    Control
                  </Label>
                </div>

                {variant.weightBps > 0 && (
                  <div
                    className={`h-1 rounded-full ${VARIANT_COLORS[index % VARIANT_COLORS.length]}`}
                    style={{
                      width: `${Math.min((variant.weightBps / 10000) * 100, 100)}%`,
                    }}
                  />
                )}
              </div>
            ))}

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
                <span className={totalWeight === 10000 ? "text-muted-foreground" : "text-destructive"}>
                  Total: {(totalWeight / 100).toFixed(1)}%
                </span>
                {totalWeight !== 10000 && (
                  <span className="ml-2 text-destructive">— must sum to 100%</span>
                )}
                {controlCount !== 1 && (
                  <span className="ml-2 text-destructive">— exactly one control required</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end border-t pt-4">
        <Button
          disabled={readOnly || !isValid || replaceVariants.isPending}
          onClick={() =>
            replaceVariants.mutate({
              experimentId,
              variants: localVariants.map(({ _id: _variantId, ...variant }) => variant),
            })
          }
        >
          {replaceVariants.isPending ? "Saving..." : "Save Variants"}
        </Button>
      </CardFooter>
    </Card>
  );
}
