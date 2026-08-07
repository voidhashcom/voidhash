"use client";

import { useNavigate } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voidhash/ui";

interface DataTableProps<TData extends { distinctId: string }, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  organizationSlug: string;
  projectSlug: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  organizationSlug,
  projectSlug,
}: DataTableProps<TData & { distinctId: string }, TValue>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  const navigate = useNavigate();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                className="cursor-pointer"
                data-state={row.getIsSelected() && "selected"}
                key={row.id}
                onClick={() => {
                  void navigate({
                    params: {
                      id: row.original.distinctId,
                      organizationSlug,
                      projectSlug,
                    },
                    to: "/studio/$organizationSlug/$projectSlug/persons/$id",
                  });
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={columns.length}>
                No people in your project yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
