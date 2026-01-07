"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { Customer } from "@voidhash/rpc";
import { format } from "date-fns";

export const columns: ColumnDef<typeof Customer.Type>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
    header: "Email",
  },
  {
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.createdAt
          ? format(row.original.createdAt, "MMM d, yyyy")
          : "N/A"}
      </span>
    ),
    header: "Created",
  },
];
