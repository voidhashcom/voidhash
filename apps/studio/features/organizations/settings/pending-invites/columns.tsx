import type { ColumnDef } from '@tanstack/react-table';
import { Badge, CopyText } from '@voidhash/ui';
import { format } from 'date-fns';

const formatDate = (date: Date) => {
  return format(date, 'MM/dd/yyyy');
};

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export const invitationsColumns: ColumnDef<unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (props) => {
      return <span>{props.getValue() as string}</span>;
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (props) => {
      return (
        <Badge
          variant={props.getValue() === 'pending' ? 'default' : 'secondary'}
        >
          {props.getValue() as string}
        </Badge>
      );
    }
  },
  {
    accessorKey: 'invitedAt',
    header: 'Invited',
    cell: (props) => {
      return <span>{formatDate(props.getValue() as Date)}</span>;
    }
  },
  {
    accessorKey: 'id',
    header: 'Invite link',
    cell: (props) => {
      return (
        <CopyText
          text={`${process.env.NEXT_PUBLIC_APP_URL}/app/team/join/${props.getValue() as string}`}
        />
      );
    }
  }
];
