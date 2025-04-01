import { ColumnDef } from "@tanstack/react-table";
import { getCustomersQuery } from "../../../server/queries";
import { QueryData } from "../../../../lib/types";

type Customer = QueryData<typeof getCustomersQuery>[number];

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
