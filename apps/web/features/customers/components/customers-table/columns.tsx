import { ColumnDef } from "@tanstack/react-table";
// import { RouterOutputs } from "@/lib/trpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Customer = any; //RouterOutputs["customers"]["getCustomers"][number];

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
