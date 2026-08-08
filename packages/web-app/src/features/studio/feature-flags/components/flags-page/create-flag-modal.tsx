import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
} from "@voidhash/ui";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { createFeatureFlagOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

import { FLAG_TYPE_LABELS, FLAG_TYPE_NOUNS, type FlagType } from "../../lib/flag-type";
import { FLAG_TYPE_PRESENTATION } from "../shared/flag-type-indicator";

interface CreateFlagModalProps {
  projectId: string;
  trigger?: React.ReactNode;
}

interface DraftVariant {
  id: number;
  label: string;
  value: string;
}

const FLAG_TYPE_OPTIONS: FlagType[] = ["boolean", "string", "number", "json"];

let nextVariantId = 0;

const createVariant = (type: FlagType): DraftVariant => ({
  id: nextVariantId++,
  label: "",
  value: type === "json" ? "{}" : "",
});

type VariantState = { state: "empty" } | { state: "invalid" } | { state: "valid"; value: unknown };

/** Reads a non-empty raw input as the flag's declared type; `invalid` when it cannot be parsed. */
const parseVariantValue = (type: FlagType, value: string): VariantState => {
  if (type === "string") {
    return { state: "valid", value };
  }
  if (type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return { state: "invalid" };
    }
    return { state: "valid", value: parsed };
  }
  return Effect.runSync(
    Effect.try(() => JSON.parse(value)).pipe(
      Effect.match({
        onFailure: (): VariantState => ({ state: "invalid" }),
        onSuccess: (parsed): VariantState => ({ state: "valid", value: parsed }),
      }),
    ),
  );
};

/**
 * An untouched variant reads as `empty` rather than `invalid`: it blocks
 * submission without showing an error on a field the user has not filled in
 * yet, which matters because non-boolean flags start with one variant seeded.
 */
const readVariantValue = (type: FlagType, raw: string): VariantState => {
  if (raw.trim() === "") {
    return { state: "empty" };
  }
  return parseVariantValue(type, raw);
};

/** Dialog for creating a typed feature flag and its initial variants. */
export function CreateFlagModal({ projectId, trigger }: CreateFlagModalProps) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FlagType>("boolean");
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const queryClient = useQueryClient();

  const reset = () => {
    setSlug("");
    setDescription("");
    setType("boolean");
    setVariants([]);
  };

  const createFlag = useMutation({
    ...createFeatureFlagOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.all,
      });
      setOpen(false);
      reset();
    },
  });

  // A typed flag evaluates to one of its variants, so it needs at least one;
  // boolean flags carry none at all.
  const changeType = (next: FlagType) => {
    setType(next);
    setVariants(next === "boolean" ? [] : [createVariant(next)]);
  };

  const patchVariant = (id: number, patch: Partial<DraftVariant>) =>
    setVariants(variants.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const variantStates = variants.map((variant) => readVariantValue(type, variant.value));
  const valueGridClassName = cn("grid min-w-0 flex-1 gap-3", type !== "json" && "sm:grid-cols-2");
  const canSubmit =
    slug.trim() !== "" &&
    (type === "boolean" || variants.length > 0) &&
    variantStates.every((variant) => variant.state === "valid");

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger ?? <Button>Create Flag</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            createFlag.mutate({
              description: description.trim() || undefined,
              projectId,
              slug: slug.trim(),
              type,
              variants: variants.map((variant, index) => {
                const parsed = variantStates[index];
                return {
                  ...(type !== "json" && variant.label.trim()
                    ? { label: variant.label.trim() }
                    : {}),
                  value: parsed?.state === "valid" ? parsed.value : null,
                };
              }),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="flag-slug">Slug</Label>
            <Input
              autoFocus
              id="flag-slug"
              onChange={(event) => setSlug(event.target.value)}
              placeholder="new-checkout"
              value={slug}
            />
            <p className="text-muted-foreground text-xs">
              Used to evaluate this flag in your application.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="flag-description">Description</Label>
            <Textarea
              id="flag-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this flag control?"
              value={description}
            />
          </div>

          <FieldSet>
            <FieldLegend variant="label">Type</FieldLegend>
            <FieldDescription>A flag&apos;s type cannot be changed after creation.</FieldDescription>
            <RadioGroup
              className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2"
              onValueChange={(value: string) => changeType(value as FlagType)}
              value={type}
            >
              {FLAG_TYPE_OPTIONS.map((option) => {
                const { accentClassName, icon: Icon } = FLAG_TYPE_PRESENTATION[option];

                return (
                  <FieldLabel htmlFor={`flag-type-${option}`} key={option}>
                    <Field orientation="horizontal">
                      <RadioGroupItem id={`flag-type-${option}`} value={option} />
                      <FieldTitle className="flex items-center gap-1.5">
                        <Icon className={cn("size-4 shrink-0", accentClassName)} />
                        {FLAG_TYPE_LABELS[option]}
                      </FieldTitle>
                    </Field>
                  </FieldLabel>
                );
              })}
            </RadioGroup>
          </FieldSet>

          {type !== "boolean" && (
            <div className="space-y-2">
              {/* Column headers, so each row can be inputs only and the remove
                  button lines up with them rather than with a per-row label. */}
              <div className="flex items-center gap-2">
                <div className={valueGridClassName}>
                  <span className="font-medium text-sm">Value</span>
                  {type !== "json" && (
                    <span className="font-medium text-muted-foreground text-sm">
                      Label (optional)
                    </span>
                  )}
                </div>
                <span aria-hidden="true" className="size-8 shrink-0" />
              </div>

              {variants.map((variant, index) => (
                <div className="flex items-start gap-2" key={variant.id}>
                  <div className={valueGridClassName}>
                    <div className="space-y-1">
                      {type === "json" ? (
                        <Textarea
                          aria-label={`Variant ${index + 1} value`}
                          className="font-mono text-sm"
                          onChange={(event) =>
                            patchVariant(variant.id, { value: event.target.value })
                          }
                          rows={3}
                          value={variant.value}
                        />
                      ) : (
                        <Input
                          aria-label={`Variant ${index + 1} value`}
                          onChange={(event) =>
                            patchVariant(variant.id, { value: event.target.value })
                          }
                          placeholder={`variant-${index + 1}`}
                          step={type === "number" ? "any" : undefined}
                          type={type === "number" ? "number" : "text"}
                          value={variant.value}
                        />
                      )}
                      {variantStates[index]?.state === "invalid" && (
                        <p className="text-destructive text-xs">
                          Enter a valid {FLAG_TYPE_NOUNS[type]} value.
                        </p>
                      )}
                    </div>
                    {type !== "json" && (
                      <Input
                        aria-label={`Variant ${index + 1} label`}
                        onChange={(event) => patchVariant(variant.id, { label: event.target.value })}
                        placeholder="Label"
                        value={variant.label}
                      />
                    )}
                  </div>
                  <Button
                    aria-label="Remove variant"
                    className="text-muted-foreground"
                    disabled={variants.length === 1}
                    onClick={() => setVariants(variants.filter((item) => item.id !== variant.id))}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}

              <Button
                className="-ml-2.5 text-muted-foreground"
                onClick={() => setVariants([...variants, createVariant(type)])}
                type="button"
                variant="ghost"
              >
                <Plus />
                Add variant
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={!canSubmit || createFlag.isPending} type="submit">
              {createFlag.isPending ? "Creating..." : "Create flag"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
