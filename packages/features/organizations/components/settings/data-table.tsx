"use client";

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@voidhash/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@voidhash/ui";
import { EllipsisIcon } from "lucide-react";
import { Button } from "@voidhash/ui";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	emptyMessage?: string;
	actions: {
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
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<div className="rounded-lg border border-separator-2">
			<Table>
				<TableHeader className="bg-surface-2">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => {
								return (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext()
												)}
									</TableHead>
								);
							})}
							<th></th>
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows?.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								data-state={row.getIsSelected() && "selected"}
							>
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
												<Button variant={"outline"}>
													{/* <span className="mr-2">Actions</span> */}
													<span className="flex items-center space-x-1">
														<EllipsisIcon
															size={16}
															strokeWidth={2}
															className="text-onsurface-secondary"
														/>
													</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-56">
												{actions.map((action) => (
													<DropdownMenuItem
														key={action.label}
														asChild
														className="cursor-pointer"
													>
														<button
															onClick={() => action.onClick(row.original)}
															className="flex w-full cursor-pointer items-center gap-2 text-left"
														>
															<span className="text-onsurface-secondary">
																{action.icon}
															</span>
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
							<TableCell colSpan={columns.length} className="h-24 text-center">
								{emptyMessage}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
