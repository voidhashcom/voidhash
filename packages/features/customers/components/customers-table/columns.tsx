import { ColumnDef } from "@tanstack/react-table";
import { RouterOutputs } from "@voidhash/trpc";

type Customer = RouterOutputs["customers"]["getCustomers"][number];

export const columns: ColumnDef<Customer>[] = [
	{
		accessorKey: "name",
		header: "Name",
	},
	{
		accessorKey: "email",
		header: "Email",
	},
];
