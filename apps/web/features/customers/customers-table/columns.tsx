"use client";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { type Customer } from "@voidhash/db";

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
