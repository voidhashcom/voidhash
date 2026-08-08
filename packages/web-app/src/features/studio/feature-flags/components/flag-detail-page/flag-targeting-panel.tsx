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
} from "@voidhash/ui";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactElement, useState } from "react";

import { useFlagDraft } from "./flag-draft-context";

const IDENTITY_TYPE_LABELS: Record<number, string> = {
  1: "Person ID",
  2: "App User ID",
};

const ALLOW_LIST_TYPE = 1;

function AddTargetPopover({ trigger }: { trigger: ReactElement }) {
  const { addTarget } = useFlagDraft();
  const [open, setOpen] = useState(false);
  const [identityType, setIdentityType] = useState("2");
  const [identityValue, setIdentityValue] = useState("");
  const [listType, setListType] = useState("1");

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addTarget({
              identityType: Number.parseInt(identityType, 10),
              identityValue: identityValue.trim(),
              listType: Number.parseInt(listType, 10),
            });
            setIdentityValue("");
            setOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="target-list">List</Label>
              <Select onValueChange={setListType} value={listType}>
                <SelectTrigger className="w-full" id="target-list">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Allow</SelectItem>
                  <SelectItem value="2">Deny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-identity-type">Identity</Label>
              <Select onValueChange={setIdentityType} value={identityType}>
                <SelectTrigger className="w-full" id="target-identity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Person ID</SelectItem>
                  <SelectItem value="2">App User ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="target-identity-value">Value</Label>
            <Input
              id="target-identity-value"
              onChange={(event) => setIdentityValue(event.target.value)}
              placeholder="Enter identifier..."
              value={identityValue}
            />
          </div>
          <Button className="w-full" disabled={!identityValue.trim()} size="sm" type="submit">
            Add rule
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Manage direct allow- and deny-list targeting for a feature flag. */
export function FlagTargetingPanel() {
  const { readOnly, removeTarget, targets } = useFlagDraft();

  // Allow rules first: that is the order they are evaluated in.
  const ordered = [...targets].sort((a, b) => a.listType - b.listType);

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">Targeting</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">
            Identities that always or never get the flag, whatever the rollout says.
          </p>
        </div>
        {!readOnly && ordered.length > 0 && (
          <AddTargetPopover
            trigger={
              <Button aria-label="Add targeting rule" size="icon-sm" variant="ghost">
                <PlusIcon />
              </Button>
            }
          />
        )}
      </div>

      {ordered.length === 0 ? (
        readOnly ? (
          <p className="text-muted-foreground text-sm">No targeting rules.</p>
        ) : (
          <AddTargetPopover
            trigger={
              <Button className="-ml-2.5 text-muted-foreground" variant="ghost">
                <PlusIcon />
                Add a targeting rule
              </Button>
            }
          />
        )
      ) : (
        <ul className="divide-y divide-border/60 border-border/60 border-y">
          {ordered.map((target) => (
            <li className="flex items-center justify-between gap-3 py-2.5" key={target.localId}>
              <span className="flex min-w-0 items-center gap-2">
                <Badge variant={target.listType === ALLOW_LIST_TYPE ? "secondary" : "destructive"}>
                  {target.listType === ALLOW_LIST_TYPE ? "Allow" : "Deny"}
                </Badge>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {IDENTITY_TYPE_LABELS[target.identityType]}
                </span>
                <span className="truncate font-mono text-sm">{target.identityValue}</span>
              </span>
              <Button
                aria-label="Remove targeting rule"
                className="shrink-0 text-muted-foreground"
                disabled={readOnly}
                onClick={() => removeTarget(target.localId)}
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
