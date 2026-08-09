"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteProjectModal } from "@/features/studio/projects/delete-project-modal";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import { deleteProjectOptions } from "@/features/studio/lib/tanstack-query/projects";

export function ProjectDelete({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { organizationSlug, projectSlug } = useParams({
    strict: false,
  });

  const queryClient = useQueryClient();
  const { mutate: deleteProject, status: deleteProjectStatus } = useMutation({
    ...deleteProjectOptions(),
    onSuccess: () => {
      toast.success("Project deleted successfully");
      void queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
      void navigate({
        to: "/studio",
      });
    },
    onError: () => {
      toast.error("Failed to delete project");
    },
  });

  const handleDelete = () => {
    deleteProject({
      id: projectId,
    });
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const isPending = deleteProjectStatus === "pending";

  if (typeof organizationSlug !== "string" || typeof projectSlug !== "string") {
    return null;
  }

  return (
    <SettingsSection title="Danger zone">
      <SettingsCard variant="destructive">
        <SettingsRow
          control={
            <DeleteProjectModal
              key={deleteModalOpen ? "open" : "closed"}
              onClose={() => setDeleteModalOpen(false)}
              onDelete={handleDelete}
              open={deleteModalOpen}
              organizationSlug={organizationSlug}
              projectSlug={projectSlug}
              trigger={
                <Button
                  disabled={isPending}
                  onClick={() => setDeleteModalOpen(true)}
                  size="sm"
                  variant="destructive"
                >
                  {isPending ? "Deleting..." : "Delete project"}
                </Button>
              }
            />
          }
          description="Permanently delete this project and all associated data. This action cannot be undone."
          destructive={true}
          title="Delete project"
        />
      </SettingsCard>
    </SettingsSection>
  );
}
