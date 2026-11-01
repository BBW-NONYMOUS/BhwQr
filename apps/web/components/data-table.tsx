"use client";

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDownIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, SearchIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv, downloadCsv } from "@/lib/csv";

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Placeholder for the global search box; omit to hide search. */
  searchPlaceholder?: string;
  /** File name for CSV export; omit to hide the button. Uses `csv` columns when given. */
  csvFileName?: string;
  csv?: { header: string; value: (row: T) => string | number | null }[];
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
}

/**
 * TanStack data table in the shadcn pattern: global search, sortable headers, pagination,
 * CSV export. Used by every list page in the portal.
 */
export function DataTable<T>({
  columns,
  data,
  searchPlaceholder,
  csvFileName,
  csv,
  toolbar,
  emptyTitle = "Nothing to show yet",
  emptyDescription,
  pageSize = 25,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // TanStack Table returns non-memoizable functions by design; the React Compiler skips this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const filtered = table.getFilteredRowModel().rows.map((r) => r.original);

  return (
    <div className="space-y-3">
      {(searchPlaceholder || csvFileName || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center print:hidden">
          {searchPlaceholder ? (
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-8"
              />
            </div>
          ) : null}
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {csvFileName && csv ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(csvFileName, toCsv(filtered, csv))}
              disabled={filtered.length === 0}
            >
              <DownloadIcon data-icon="inline-start" />
              Export CSV
            </Button>
          ) : null}
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/50">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <ArrowUpDownIcon className="size-3 opacity-50" aria-hidden />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No matches.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="tabular-nums">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground print:hidden">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ·{" "}
            {table.getFilteredRowModel().rows.length} rows
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
