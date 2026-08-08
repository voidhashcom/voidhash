"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@voidhash/ui";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteOrganizationModal } from "@/features/studio/organizations/delete-organization-modal";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";
import { queryKeys } from "@/features/studio/lib/tanstack-query";
import { deleteOrganizationOptions } from "@/features/studio/lib/tanstack-query/organizations";

export function TeamDelete({ organizationId }: { organizationId: string }) {
  const { organizationSlug } = useParams({
    strict: false,
  });
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const { mutate: deleteOrganization, status: deleteOrganizationStatus } = useMutation({
    ...deleteOrganizationOptions(),
    onSuccess: () => {
      toast.success("Organization deleted successfully");
      void queryClient.invalidateQueries({ queryKey: queryKeys.invalidateAll() });
      void navigate({ to: "/studio" });
    },
    onError: () => {
      toast.error("Failed to delete organization");
    },
  });

  const handleDelete = () => {
    deleteOrganization({
      organizationId,
    });
  };

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const isPending = deleteOrganizationStatus === "pending";

  if (typeof organizationSlug !== "string") {
    return null;
  }

  return (
    <SettingsSection title="Danger zone">
      <SettingsCard variant="destructive">
        <SettingsRow
          control={
            <DeleteOrganizationModal
              key={deleteModalOpen ? "open" : "closed"}
              onClose={() => setDeleteModalOpen(false)}
              onDelete={handleDelete}
              open={deleteModalOpen}
              organizationSlug={organizationSlug}
              trigger={
                <Button
                  disabled={isPending}
                  onClick={() => setDeleteModalOpen(true)}
                  size="sm"
                  variant="destructive"
                >
                  {isPending ? "Deleting..." : "Delete team"}
                </Button>
              }
            />
          }
          description="Permanently delete your team and all associated data. This action cannot be undone."
          destructive={true}
          title="Delete team"
        />
      </SettingsCard>
    </SettingsSection>
  );
}
