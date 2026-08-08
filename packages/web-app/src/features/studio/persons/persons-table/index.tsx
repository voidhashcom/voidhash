"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Person } from "@voidhash/rpc";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { listPersonsOptions } from "@/features/studio/lib/tanstack-query/persons";

import { columns } from "./columns";
import { DataTable } from "./data-table";
import { PersonsTableSkeleton } from "./skeleton";

export const PersonsTable = ({
  projectId,
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string;
  projectSlug: string;
  projectId: string;
}) => {
  const { data, status } = useQuery(listPersonsOptions({ projectId }));
  const persons = useMemo(() => normalizePersons(data ?? []), [data]);

  if (status === "pending") {
    return <PersonsTableSkeleton />;
  }

  if (status === "error") {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
          message: "An error occured loading people",
        }}
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={persons}
      organizationSlug={organizationSlug}
      projectSlug={projectSlug}
    />
  );
};

const normalizePersons = (persons: ReadonlyArray<typeof Person.Type>) =>
  Array.from(
    persons
      .reduce((deduped, person) => {
        deduped.set(person.personId, person);
        return deduped;
      }, new Map<string, typeof Person.Type>())
      .values(),
  ).sort((left, right) => getCreatedAtTime(right) - getCreatedAtTime(left));

const getCreatedAtTime = (person: typeof Person.Type) => person.createdAt?.getTime() ?? 0;
