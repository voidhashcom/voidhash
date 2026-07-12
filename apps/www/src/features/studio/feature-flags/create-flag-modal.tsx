import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from "@voidhash/ui";
import { useState } from "react";

import { createFeatureFlagOptions, queryKeys } from "@/features/studio/lib/tanstack-query";

export function CreateFlagModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();

  const createFlag = useMutation({
    ...createFeatureFlagOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.list({ projectId }),
      });
      setOpen(false);
      setName("");
      setKey("");
      setDescription("");
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    setKey(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>Create Flag</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Feature Flag</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createFlag.mutate({
              description: description || undefined,
              key,
              name,
              projectId,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="flag-name">Name</Label>
            <Input
              id="flag-name"
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Feature Flag"
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flag-key">Key</Label>
            <Input
              id="flag-key"
              onChange={(e) => setKey(e.target.value)}
              placeholder="my-feature-flag"
              value={key}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flag-description">Description (optional)</Label>
            <Textarea
              id="flag-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this flag control?"
              value={description}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={!name || !key || createFlag.isPending} type="submit">
              {createFlag.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
