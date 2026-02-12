import React from "react";

interface Column<T> {
  key: keyof T | string;
  label: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends { [key: string]: any }>({
  columns,
  rows,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/50">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900/80">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`px-4 py-3 text-xs uppercase tracking-[0.2em] font-mono text-slate-400 ${
                  column.className || ""
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-t border-slate-800/60 text-slate-200 hover:bg-slate-800/40 transition ${
                onRowClick ? "cursor-pointer" : ""
              }`}
            >
              {columns.map((column) => (
                <td key={String(column.key)} className={`px-4 py-3 ${column.className || ""}`}>
                  {column.render ? column.render(row) : row[column.key as keyof T]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
