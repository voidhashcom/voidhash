"use client";

import { useParams } from "@tanstack/react-router";
import { useAuth } from "@/features/studio/components/auth-context";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { Page } from "../shell";
import { CreatePersonButton } from "./create-person-button";
import { PersonsTable } from "./persons-table";

export const PersonsPage = () => {
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();

  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "The project you are looking for does not exist.",
          title: "Project not found",
        }}
      />
    );
  }

  return (
    <Page className="p-0 py-8">
      <div className="mx-auto flex max-w-4xl flex-row items-center justify-between">
        <h1 className="font-normal text-3xl tracking-right">People</h1>
        <CreatePersonButton projectId={project.id} />
      </div>

      <div className="mx-auto mt-8 max-w-4xl">
        <PersonsTable
          organizationSlug={organizationSlug as string}
          projectId={project.id}
          projectSlug={projectSlug as string}
        />
      </div>
    </Page>
  );
};
