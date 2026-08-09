import { Button, cn, Input, Textarea } from "@voidhash/ui";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { FLAG_TYPE_NOUNS, type FlagType } from "../../lib/flag-type";
import { useFlagDraft } from "./flag-draft-context";

/** Editor for the values allowed by a non-boolean feature flag. */
export function FlagVariantsPanel({ flagType }: { flagType: Exclude<FlagType, "boolean"> }) {
  const { addVariant, invalidVariantIds, patchVariant, readOnly, removeVariant, variants } =
    useFlagDraft();

  const valueGridClassName = cn(
    "grid min-w-0 flex-1 gap-2",
    flagType !== "json" && "sm:grid-cols-2",
  );

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Variants</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            The values this flag can evaluate to, distributed evenly.
          </p>
        </div>
        {!readOnly && variants.length > 0 && (
          <Button aria-label="Add variant" onClick={addVariant} size="icon-sm" variant="ghost">
            <PlusIcon />
          </Button>
        )}
      </div>

      {variants.length === 0 ? (
        <Button
          className="-ml-2.5 text-muted-foreground"
          disabled={readOnly}
          onClick={addVariant}
          variant="ghost"
        >
          <PlusIcon />
          Add a variant
        </Button>
      ) : (
        <ul className="divide-y divide-border/60 border-border/60 border-y">
          {variants.map((variant, index) => (
            <li className="flex items-start gap-2 py-2.5" key={variant.localId}>
              <span className="w-6 shrink-0 pt-2 text-muted-foreground text-xs tabular-nums">
                #{index + 1}
              </span>
              <div className={valueGridClassName}>
                <div className="space-y-1">
                  {flagType === "json" ? (
                    <Textarea
                      aria-label={`Variant ${index + 1} value`}
                      className="font-mono text-sm"
                      disabled={readOnly}
                      onChange={(event) =>
                        patchVariant(variant.localId, { value: event.target.value })
                      }
                      rows={4}
                      value={variant.value}
                    />
                  ) : (
                    <Input
                      aria-label={`Variant ${index + 1} value`}
                      disabled={readOnly}
                      onChange={(event) =>
                        patchVariant(variant.localId, { value: event.target.value })
                      }
                      placeholder="Value"
                      step={flagType === "number" ? "any" : undefined}
                      type={flagType === "number" ? "number" : "text"}
                      value={variant.value}
                    />
                  )}
                  {invalidVariantIds.has(variant.localId) && (
                    <p className="text-destructive text-xs">
                      Enter a valid {FLAG_TYPE_NOUNS[flagType]} value.
                    </p>
                  )}
                </div>
                {flagType !== "json" && (
                  <Input
                    aria-label={`Variant ${index + 1} label`}
                    disabled={readOnly}
                    onChange={(event) =>
                      patchVariant(variant.localId, { label: event.target.value })
                    }
                    placeholder="Label (optional)"
                    value={variant.label}
                  />
                )}
              </div>
              <Button
                aria-label={`Remove variant ${index + 1}`}
                className="text-muted-foreground"
                disabled={readOnly}
                onClick={() => removeVariant(variant.localId)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
