"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { Paywall, RpcPaywallLocation } from "@voidhash/rpc";
import {
  Button,
  cn,
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  Phone,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@voidhash/ui";
import { MapPinIcon, PlusIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { Fragment, type ReactElement, useMemo, useState } from "react";

import {
  listPaywallDeploysOptions,
  listPaywallLocationsOptions,
  listPaywallsOptions,
} from "@/features/studio/lib/tanstack-query";

import { cellKey, type DraftCell, useExperimentDraft } from "./experiment-draft-context";

type PaywallRecord = typeof Paywall.Type;
type LocationRecord = typeof RpcPaywallLocation.Type;

// Fills carry the grouping — a tinted band for the header and footer, a
// lighter rail for the variant column — and rules are spent only where
// something genuinely divides: under the header, beside the rail, and between
// rows. Paywall columns lean on the header's pickers and their own spacing
// instead, which keeps a wide matrix from turning into a mesh of lines.
const HEADER_BAND = "bg-muted/50 border-border/60 border-b";
const VARIANT_RAIL = "bg-muted/30 border-border/60 border-r";
const ROW_DIVIDER = "border-border/60 border-t";

/** Sentinel option that empties a cell — the combobox's own "none" choice. */
const NO_PAYWALL = "__no_paywall__";

function PaywallThumbnail({
  className,
  paywall,
}: {
  className?: string;
  paywall: PaywallRecord | undefined;
}) {
  return (
    <Phone className={className} screenClassName="flex items-center justify-center bg-zinc-950">
      {paywall?.thumbnailUrl ? (
        <img
          alt={paywall.name}
          className="size-full object-cover object-top"
          loading="lazy"
          src={paywall.thumbnailUrl}
        />
      ) : (
        <SmartphoneIcon className="size-4 text-zinc-400 opacity-30" />
      )}
    </Phone>
  );
}

/** What a cell says under the paywall name about the version it will serve. */
interface LatestVersionLookup {
  isPending: boolean;
  versionForSlug: (slug: string) => number | undefined;
}

/**
 * Searchable paywall list for a cell. Hangs off a compact `trigger` rather than
 * the cell itself, so the popup anchors next to the button that opened it
 * instead of dropping out of the bottom of a tall cell.
 */
function PaywallPicker({
  currentPaywallId,
  onClear,
  onOpenChange,
  onSelect,
  paywalls,
  trigger,
}: {
  currentPaywallId: string | undefined;
  onClear: () => void;
  onOpenChange?: (open: boolean) => void;
  onSelect: (paywallId: string) => void;
  paywalls: readonly PaywallRecord[];
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      return paywalls;
    }
    return paywalls.filter((paywall) =>
      `${paywall.name} ${paywall.slug}`.toLowerCase().includes(needle),
    );
  }, [paywalls, query]);

  return (
    // The search text is driven through the root's `inputValue` rather than the
    // input element — Base UI owns that input's value, so controlling the
    // element directly fights it. No `items` prop, so filtering stays ours.
    <Combobox
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        onOpenChange?.(next);
        if (!next) {
          setQuery("");
        }
      }}
      onValueChange={(paywallId: null | string) => {
        if (paywallId === NO_PAYWALL) {
          onClear();
        } else if (paywallId != null) {
          onSelect(paywallId);
        }
        setOpen(false);
        onOpenChange?.(false);
      }}
      open={open}
      value={currentPaywallId ?? null}
    >
      <ComboboxTrigger render={trigger} showChevron={false} />
      {/* The trigger is a compact button, and the popup defaults to the
          anchor's width — give the list a readable one of its own. */}
      <ComboboxContent className="w-72">
        <ComboboxInput placeholder="Search paywalls..." showTrigger={false} />
        <ComboboxList>
          {currentPaywallId && <ComboboxItem value={NO_PAYWALL}>No paywall</ComboboxItem>}
          {matches.length === 0 ? (
            <p className="py-2 text-center text-muted-foreground text-sm">No paywalls found.</p>
          ) : (
            matches.map((paywall) => (
              <ComboboxItem key={paywall.id} value={paywall.id}>
                <span className="flex h-8 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-zinc-950">
                  {paywall.thumbnailUrl ? (
                    <img
                      alt={paywall.name}
                      className="size-full object-cover object-top"
                      loading="lazy"
                      src={paywall.thumbnailUrl}
                    />
                  ) : (
                    <SmartphoneIcon className="size-3 text-zinc-400 opacity-30" />
                  )}
                </span>
                <span className="truncate">{paywall.name}</span>
              </ComboboxItem>
            ))
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * One matrix cell: which paywall a variant serves at a location. A cell always
 * follows the paywall's latest published version, so the picker is just a
 * searchable paywall list — no version to manage. The cell itself is inert; the
 * button inside it is what opens the picker.
 */
function MatrixCell({
  disabled,
  latestVersions,
  locationId,
  paywalls,
  paywallsById,
  variantLocalId,
}: {
  disabled: boolean;
  latestVersions: LatestVersionLookup;
  locationId: string;
  paywalls: readonly PaywallRecord[];
  paywallsById: ReadonlyMap<string, PaywallRecord>;
  variantLocalId: number;
}) {
  const { cells, clearCell, setCell } = useExperimentDraft();
  // The Replace button only appears on hover, so it has to stay visible while
  // its own popup is open — otherwise moving the pointer into the list would
  // pull the anchor out from under it.
  const [pickerOpen, setPickerOpen] = useState(false);

  const cell: DraftCell | undefined = cells[cellKey(variantLocalId, locationId)];
  const selectedPaywall = cell ? paywallsById.get(cell.paywallId) : undefined;
  const latestVersion = selectedPaywall
    ? latestVersions.versionForSlug(selectedPaywall.slug)
    : undefined;

  const picker = (trigger: ReactElement) => (
    <PaywallPicker
      currentPaywallId={cell?.paywallId}
      onClear={() => clearCell(variantLocalId, locationId)}
      onOpenChange={setPickerOpen}
      onSelect={(paywallId) => setCell(variantLocalId, locationId, { paywallId })}
      paywalls={paywalls}
      trigger={trigger}
    />
  );

  if (!(cell && selectedPaywall)) {
    return (
      <div className="flex min-h-36 items-center justify-center p-3">
        {disabled ? (
          <span className="text-muted-foreground/70 text-sm">No paywall</span>
        ) : (
          picker(
            <Button variant="ghost">
              <PlusIcon />
              Select paywall
            </Button>,
          )
        )}
      </div>
    );
  }

  return (
    <div className="group/cell flex min-h-36 items-center gap-3 p-3">
      <PaywallThumbnail className="w-12 shrink-0" paywall={selectedPaywall} />
      <div className="relative min-w-0 flex-1">
        <div
          className={cn(
            "transition-opacity",
            !disabled && "group-focus-within/cell:opacity-0 group-hover/cell:opacity-0",
            pickerOpen && "opacity-0",
          )}
        >
          <p className="truncate font-medium text-sm">{selectedPaywall.name}</p>
          <p
            className={cn(
              "text-xs",
              latestVersions.isPending || latestVersion !== undefined
                ? "text-muted-foreground"
                : "text-amber-500",
            )}
          >
            {latestVersions.isPending
              ? "Latest version"
              : latestVersion !== undefined
                ? `Latest version (v${latestVersion})`
                : "Not published yet"}
          </p>
        </div>
        {!disabled && (
          <div
            className={cn(
              "absolute inset-0 flex items-center opacity-0 transition-opacity",
              "pointer-events-none group-hover/cell:pointer-events-auto group-focus-within/cell:pointer-events-auto",
              "group-focus-within/cell:opacity-100 group-hover/cell:opacity-100",
              pickerOpen && "pointer-events-auto opacity-100",
            )}
          >
            {picker(<Button variant="outline">Replace</Button>)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A column's location picker. Options are the locations no other column uses;
 * picking one on the placeholder column adds it, picking on an existing column
 * switches it (its cells carry over).
 */
function LocationColumnSelect({
  availableLocations,
  disabled,
  locationId,
  locationsById,
  onSelect,
}: {
  availableLocations: readonly LocationRecord[];
  disabled: boolean;
  locationId: string | null;
  locationsById: ReadonlyMap<string, LocationRecord>;
  onSelect: (nextLocationId: string) => void;
}) {
  const current = locationId ? locationsById.get(locationId) : undefined;

  return (
    <Select disabled={disabled} onValueChange={onSelect} value={locationId ?? ""}>
      <SelectTrigger className="h-8 min-w-0 flex-1 border-transparent bg-transparent font-medium shadow-none hover:bg-background/60">
        <span className="flex min-w-0 items-center gap-2">
          <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Select location" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {locationId && (
          <SelectItem value={locationId}>{current?.name ?? "Unknown location"}</SelectItem>
        )}
        {availableLocations.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The setup matrix: one column per paywall location the test runs at, one row
 * per variant, and in each cell the paywall that variant serves there — the
 * whole "who sees what where" of the test on a single surface. There is always
 * at least one column; before a location is chosen it renders as a placeholder
 * with its picker open for business. Edits stage into the draft; the bottom
 * action bar saves them.
 */
export function ExperimentMatrix({ projectId }: { projectId: string }) {
  const {
    addLocation,
    addVariant,
    locationIds,
    matrixLocked,
    removeLocation,
    removeVariant,
    renameVariant,
    replaceLocation,
    setVariantWeight,
    splitWeightsEvenly,
    variants,
  } = useExperimentDraft();

  const { data: locations } = useSuspenseQuery(
    listPaywallLocationsOptions({ includeArchived: true, projectId }),
  );
  const { data: paywalls } = useSuspenseQuery(listPaywallsOptions({ projectId }));
  // Display-only: the version number each "Latest version" cell currently
  // resolves to, reconstructed from the deploy history (there is no
  // list-releases RPC).
  const { data: deploys, isPending: isDeploysPending } = useQuery(
    listPaywallDeploysOptions({ projectId }),
  );

  const latestVersionBySlug = new Map<string, number>();
  for (const deploy of deploys ?? []) {
    for (const paywall of deploy.paywalls) {
      if (paywall.releaseId && paywall.version !== null) {
        latestVersionBySlug.set(
          paywall.slug,
          Math.max(latestVersionBySlug.get(paywall.slug) ?? 0, paywall.version),
        );
      }
    }
  }
  const latestVersions: LatestVersionLookup = {
    isPending: isDeploysPending,
    versionForSlug: (slug) => latestVersionBySlug.get(slug),
  };

  const locationsById = new Map<string, LocationRecord>(
    locations.map((location) => [location.id, location]),
  );
  const paywallsById = new Map<string, PaywallRecord>(
    paywalls.map((paywall) => [paywall.id, paywall]),
  );
  const availableLocations = locations.filter(
    (location) => location.archivedAt == null && !locationIds.includes(location.id),
  );

  // The matrix never renders columnless: with no locations chosen yet, one
  // placeholder column stands in so the location picker is right where the
  // first real column will be.
  const columns: (string | null)[] = locationIds.length > 0 ? locationIds : [null];
  // Fixed column widths rather than `1fr`: a single placement shouldn't stretch
  // across the whole page, and every column stays the same size as locations
  // are added — the matrix scrolls instead of reflowing.
  const gridTemplateColumns = `15rem repeat(${columns.length}, 17rem) 3.5rem`;
  const weightSum = variants.reduce((sum, variant) => sum + variant.weightPercent, 0);

  return (
    // Scrolls on both axes so many variants or many placements stay usable
    // without the matrix pushing the page around.
    <div className="max-h-[70svh] w-fit max-w-full overflow-auto overscroll-contain rounded-xl border border-border/60 bg-card">
      <div className="min-w-max">
        <div className="grid" style={{ gridTemplateColumns }}>
          <div className={cn(HEADER_BAND, "flex items-center justify-between gap-2 border-r p-3")}>
            <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Variants
            </span>
            {!matrixLocked && weightSum !== 100 && variants.length > 0 && (
              <Button onClick={splitWeightsEvenly} size="xs" variant="ghost">
                Split evenly
              </Button>
            )}
          </div>

          {columns.map((locationId) => (
            <div
              className={cn(HEADER_BAND, "group flex items-center gap-1 p-2")}
              key={locationId ?? "placeholder"}
            >
              <LocationColumnSelect
                availableLocations={availableLocations}
                disabled={matrixLocked}
                locationId={locationId}
                locationsById={locationsById}
                onSelect={(nextLocationId) => {
                  if (locationId) {
                    replaceLocation(locationId, nextLocationId);
                  } else {
                    addLocation(nextLocationId);
                  }
                }}
              />
              {!matrixLocked && locationId && (
                <Button
                  aria-label="Remove location"
                  className="shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  onClick={() => removeLocation(locationId)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <XIcon />
                </Button>
              )}
            </div>
          ))}

          <div className={cn(HEADER_BAND, "flex items-center justify-center p-2")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Add paywall location"
                  disabled={
                    matrixLocked || availableLocations.length === 0 || locationIds.length === 0
                  }
                  size="icon"
                  variant="ghost"
                >
                  <PlusIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {availableLocations.map((location) => (
                  <DropdownMenuItem key={location.id} onSelect={() => addLocation(location.id)}>
                    <MapPinIcon className="size-4 text-muted-foreground" />
                    {location.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {variants.map((variant, index) => (
            <Fragment key={variant.localId}>
              <div className={cn(VARIANT_RAIL, index > 0 && ROW_DIVIDER, "p-3")}>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Variant name"
                    className="min-w-0 flex-1"
                    disabled={matrixLocked}
                    onChange={(event) => renameVariant(variant.localId, event.target.value)}
                    value={variant.name}
                  />
                  <InputGroup className="w-20 shrink-0">
                    <InputGroupInput
                      aria-label="Weight percent"
                      className="text-right tabular-nums"
                      disabled={matrixLocked}
                      // `inputMode` over `type="number"` — the spinner arrows
                      // crowd a field this narrow and add nothing here.
                      inputMode="numeric"
                      onChange={(event) => {
                        const percent = Number(event.target.value);
                        if (Number.isFinite(percent)) {
                          setVariantWeight(variant.localId, percent);
                        }
                      }}
                      value={variant.weightPercent}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </div>

              {columns.map((locationId) => (
                <div className={cn(index > 0 && ROW_DIVIDER)} key={locationId ?? "placeholder"}>
                  {locationId ? (
                    <MatrixCell
                      disabled={matrixLocked}
                      latestVersions={latestVersions}
                      locationId={locationId}
                      paywalls={paywalls}
                      paywallsById={paywallsById}
                      variantLocalId={variant.localId}
                    />
                  ) : (
                    // No location picked for this column yet, so there is
                    // nothing a paywall could be bound to.
                    <div className="flex min-h-36 items-center justify-center p-3 text-muted-foreground/70 text-sm">
                      Pick a location first
                    </div>
                  )}
                </div>
              ))}

              {/* Aligned to the top of the row so it sits on the same line as
                  the variant name, matching the header's + button. */}
              <div className={cn("flex items-start justify-center p-2", index > 0 && ROW_DIVIDER)}>
                {!matrixLocked && variants.length > 1 && (
                  <Button
                    aria-label="Remove variant"
                    onClick={() => removeVariant(variant.localId)}
                    size="icon"
                    variant="ghost"
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
            </Fragment>
          ))}
        </div>

        <Button
          className="h-auto w-full rounded-none border-border/60 border-t bg-muted/50 py-3 font-normal"
          disabled={matrixLocked}
          onClick={addVariant}
          variant="ghost"
        >
          <PlusIcon />
          Add variant
        </Button>
      </div>
    </div>
  );
}
