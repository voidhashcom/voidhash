"use client";
import { ColumnDef } from "@tanstack/react-table";
import { type getCustomers } from "@/lib/services/customers/queries";
import { format } from "date-fns";
// import { RouterOutputs } from "@/lib/trpc";

type Customer = Awaited<ReturnType<typeof getCustomers>>[number];

export const columns: ColumnDef<Customer>[] = [
	{
		accessorKey: "name",
		header: "Name",
	},
	{
		accessorKey: "email",
		header: "Email",
		cell: ({ row }) => {
			return (
				<span className="text-muted-foreground">{row.original.email}</span>
			);
		},
	},
	{
		accessorKey: "createdAt",
		header: "Created",
		cell: ({ row }) => {
			return (
				<span className="text-muted-foreground">
					{row.original.createdAt
						? format(new Date(row.original.createdAt), "MMM d, yyyy")
						: "N/A"}
				</span>
			);
		},
	},
];
