import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

const formatDate = (date: Date) => {
  return format(date, 'MM/dd/yyyy');
};

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export const membersColumns: ColumnDef<unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'email',
    header: 'Email'
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: (props) => {
      return <span>{props.getValue() as string}</span>;
    }
  },

  {
    accessorKey: 'invitedAt',
    header: 'Joined',
    cell: (props) => {
      return <span>{formatDate(props.getValue() as Date)}</span>;
    }
  }
];
