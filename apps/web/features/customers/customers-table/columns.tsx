'use client';
import type { ColumnDef } from '@tanstack/react-table';
import type { Customer } from '@voidhash/db';
import { format } from 'date-fns';

export const columns: ColumnDef<Customer>[] = [
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
            ? format(new Date(row.original.createdAt), 'MMM d, yyyy')
            : 'N/A'}
        </span>
      );
    }
  }
];
