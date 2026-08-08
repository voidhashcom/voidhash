import { Link } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
  GradientAvatar,
  ScrollArea,
} from "@voidhash/ui";
import { PlusIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

import { EmptyState } from "./empty-state";
import { CreateProjectModal } from "../../projects/create-project-modal";
import { useState } from "react";

export const ProjectsList = ({
  organizationSlug,
  className,
}: {
  organizationSlug: string;
  className?: string;
}) => {
  const { user } = useAuth();
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);

  const activeOrganization = user.organizations.find(
    (organization) => organization.slug === organizationSlug,
  );
  if (!activeOrganization) {
    return (
      <VoidhashErrorCard
        error={{
          code: "NOT_FOUND",
          message: "Organization not found",
        }}
      />
    );
  }
  const projects = user.projects.filter(
    (project) => project.organizationId === activeOrganization?.id,
  );
  if (projects.length === 0) {
    return (
      <EmptyState organizationId={activeOrganization?.id} organizationSlug={organizationSlug} />
    );
  }
  return (
    <Card className={cn("min-h-0 justify-start flex-col", className)}>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
        <CardAction>
          <CreateProjectModal
            open={createProjectModalOpen}
            onClose={() => setCreateProjectModalOpen(false)}
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="cursor-pointer"
                onClick={() => setCreateProjectModalOpen(true)}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            }
            organizationId={activeOrganization.id}
            organizationSlug={organizationSlug}
          />
        </CardAction>
      </CardHeader>
      <CardContent className={cn("gap-0 p-0 min-h-0 flex-1 overflow-hidden")}>
        <ScrollArea className="h-full" fadeHint>
          <div className="divide-y divide-border">
            {projects?.map((project) => (
              <div className="group relative isolate px-6 py-4 hover:bg-accent/30" key={project.id}>
                <Link
                  className="absolute inset-0 h-full w-full"
                  params={{ organizationSlug, projectSlug: project.slug }}
                  to="/studio/$organizationSlug/$projectSlug"
                />
                <div className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GradientAvatar
                      alt={project.name}
                      className="h-8 w-8 rounded-lg text-xs"
                      fallback={project.id}
                      src={project.logo ?? undefined}
                    />
                    <div className="flex flex-col">
                      <p>{project.name}</p>
                      <p className="mt-1 text-muted-foreground text-sm">No URL specified</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
