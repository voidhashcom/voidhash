'use client';
import type { ColumnDef } from '@tanstack/react-table';
import type { Customer } from '@voidhash/rpc';
import { format } from 'date-fns';

export const columns: ColumnDef<typeof Customer.Type>[] = [
  {
    accessorKey: 'name',
    header: 'Name'
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => {
      return (
        <span className="text-muted-foreground">{row.original.email}</span>
      );
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => {
      return (
        <span className="text-muted-foreground">
          {row.original.createdAt
            ? format(row.original.createdAt, 'MMM d, yyyy')
            : 'N/A'}
        </span>
      );
    }
  }
];
