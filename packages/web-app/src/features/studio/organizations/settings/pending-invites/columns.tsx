import type { ColumnDef } from "@tanstack/react-table";
import { Badge, CopyText } from "@voidhash/ui";
import { format } from "date-fns";

import { getAppUrl } from "@/lib/origin";

const formatDate = (date: Date) => format(date, "MM/dd/yyyy");

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export const invitationsColumns: ColumnDef<unknown>[] = [
  {
    accessorKey: "name",
    cell: (props) => <span>{props.getValue() as string}</span>,
    header: "Name",
  },
  {
    accessorKey: "status",
    cell: (props) => (
      <Badge variant={props.getValue() === "pending" ? "default" : "secondary"}>
        {props.getValue() as string}
      </Badge>
    ),
    header: "Status",
  },
  {
    accessorKey: "invitedAt",
    cell: (props) => <span>{formatDate(props.getValue() as Date)}</span>,
    header: "Invited",
  },
  {
    accessorKey: "id",
    cell: (props) => <CopyText text={getAppUrl(`/app/team/join/${props.getValue() as string}`)} />,
    header: "Invite link",
  },
];
