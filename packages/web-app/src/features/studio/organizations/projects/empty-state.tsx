"use client";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@voidhash/ui";
import { useState } from "react";
import { CreateProjectModal } from "@/features/studio/projects/create-project-modal";

export function EmptyState({
  organizationId,
  organizationSlug,
}: {
  organizationId: string;
  organizationSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No projects yet</CardTitle>
        <CardDescription>Create a project to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <CreateProjectModal
          onClose={() => setOpen(false)}
          open={open}
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          trigger={<Button onClick={() => setOpen(true)}>Create project</Button>}
        />
      </CardContent>
    </Card>
  );
}
