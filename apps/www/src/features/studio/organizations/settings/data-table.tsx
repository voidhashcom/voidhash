"use client";

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voidhash/ui";
import { EllipsisIcon } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  actions?: {
    onClick: (data: TData) => void;
    label: string;
    icon: React.ReactNode;
  }[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "No data",
  actions = [],
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-lg border border-separator-2">
      <Table>
        <TableHeader className="bg-surface-2">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
              <th />
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow data-state={row.getIsSelected() && "selected"} key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}

                {/* Actions */}
                <td className="relative bg-white">
                  <span className="flex h-full w-full items-center justify-end px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          {/* <span className="mr-2">Actions</span> */}
                          <span className="flex items-center space-x-1">
                            <EllipsisIcon
                              className="text-onsurface-secondary"
                              size={16}
                              strokeWidth={2}
                            />
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {actions.map((action) => (
                          <DropdownMenuItem asChild className="cursor-pointer" key={action.label}>
                            <button
                              className="flex w-full cursor-pointer items-center gap-2 text-left"
                              onClick={() => action.onClick(row.original)}
                              type="button"
                            >
                              <span className="text-onsurface-secondary">{action.icon}</span>
                              <span>{action.label}</span>
                            </button>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </td>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell className="h-24 text-center" colSpan={columns.length}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
