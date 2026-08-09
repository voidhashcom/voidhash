import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

const formatDate = (date: Date) => format(date, "MM/dd/yyyy");

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export const membersColumns: ColumnDef<unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    cell: (props) => <span>{props.getValue() as string}</span>,
    header: "Role",
  },

  {
    accessorKey: "invitedAt",
    cell: (props) => <span>{formatDate(props.getValue() as Date)}</span>,
    header: "Joined",
  },
];
