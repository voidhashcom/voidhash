import {
  Badge,
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@voidhash/ui";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactElement, useState } from "react";

import { useFlagDraft } from "./flag-draft-context";

const IDENTITY_TYPE_LABELS: Record<number, string> = {
  1: "Person ID",
  2: "App User ID",
};

function AddOverridePopover({ trigger }: { trigger: ReactElement }) {
  const { addOverride } = useFlagDraft();
  const [open, setOpen] = useState(false);
  const [forcedEnabled, setForcedEnabled] = useState(true);
  const [identityType, setIdentityType] = useState("2");
  const [identityValue, setIdentityValue] = useState("");
  const [note, setNote] = useState("");

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addOverride({
              forcedEnabled,
              identityType: Number.parseInt(identityType, 10),
              identityValue: identityValue.trim(),
              note: note.trim(),
            });
            setIdentityValue("");
            setNote("");
            setOpen(false);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="override-identity-type">Identity</Label>
            <Select onValueChange={setIdentityType} value={identityType}>
              <SelectTrigger className="w-full" id="override-identity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Person ID</SelectItem>
                <SelectItem value="2">App User ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="override-identity-value">Value</Label>
            <Input
              id="override-identity-value"
              onChange={(event) => setIdentityValue(event.target.value)}
              placeholder="Enter identifier..."
              value={identityValue}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="override-forced-enabled">Force enabled</Label>
            <Switch
              checked={forcedEnabled}
              id="override-forced-enabled"
              onCheckedChange={setForcedEnabled}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="override-note">Note (optional)</Label>
            <Input
              id="override-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Reason for override..."
              value={note}
            />
          </div>
          <Button className="w-full" disabled={!identityValue.trim()} size="sm" type="submit">
            Add override
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Manage identity-specific value overrides for a feature flag. */
export function FlagOverridesPanel() {
  const { overrides, readOnly, removeOverride } = useFlagDraft();

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Overrides</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Pin the flag on or off for a single identity, usually while debugging.
          </p>
        </div>
        {!readOnly && overrides.length > 0 && (
          <AddOverridePopover
            trigger={
              <Button aria-label="Add override" size="icon-sm" variant="ghost">
                <PlusIcon />
              </Button>
            }
          />
        )}
      </div>

      {overrides.length === 0 ? (
        readOnly ? (
          <p className="text-muted-foreground text-sm">No overrides.</p>
        ) : (
          <AddOverridePopover
            trigger={
              <Button className="-ml-2.5 text-muted-foreground" variant="ghost">
                <PlusIcon />
                Add an override
              </Button>
            }
          />
        )
      ) : (
        <ul className="divide-y divide-border/60 border-border/60 border-y">
          {overrides.map((override) => (
            <li className="flex items-center justify-between gap-3 py-2.5" key={override.localId}>
              <span className="flex min-w-0 items-center gap-2">
                {override.forcedEnabled !== null && (
                  <Badge variant={override.forcedEnabled ? "secondary" : "destructive"}>
                    {override.forcedEnabled ? "Forced on" : "Forced off"}
                  </Badge>
                )}
                <span className="shrink-0 text-muted-foreground text-xs">
                  {IDENTITY_TYPE_LABELS[override.identityType]}
                </span>
                <span className="truncate font-mono text-sm">{override.identityValue}</span>
                {override.note && (
                  <span className="truncate text-muted-foreground text-xs">{override.note}</span>
                )}
              </span>
              <Button
                aria-label="Remove override"
                className="shrink-0 text-muted-foreground"
                disabled={readOnly}
                onClick={() => removeOverride(override.localId)}
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
