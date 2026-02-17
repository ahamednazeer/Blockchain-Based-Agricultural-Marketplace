import React from "react";
import { ArrowsDownUp } from "@phosphor-icons/react";

interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows?: T[];
  data?: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends { [key: string]: any; id?: string | number }>({
  columns,
  rows,
  data,
  onRowClick,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  const tableRows = rows ?? data ?? [];

  if (tableRows.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm text-center py-12">
        <p className="text-slate-500 font-mono">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-6 py-3 text-left text-xs font-mono text-slate-500 uppercase tracking-wider ${
                    column.className || ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && <ArrowsDownUp size={12} className="text-slate-600" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {tableRows.map((row, index) => (
              <tr
                key={row.id ?? index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`hover:bg-slate-800/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((column) => (
                  <td key={String(column.key)} className={`px-6 py-4 whitespace-nowrap text-sm ${column.className || ""}`}>
                    {column.render ? column.render(row) : String(row[column.key as keyof T] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
