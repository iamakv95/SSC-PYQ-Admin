import type { ReactNode } from 'react'

// The installed @tanstack/react-table is v9, whose useReactTable/getCoreRowModel API and
// TableFeatures-constrained generics are a substantially different shape than the classic v8
// API this admin app's screens don't actually need anything beyond (no sorting/filtering/
// virtualization is delegated to the table library anywhere here — every filter is handled by
// the Edge Function's own query). A small dependency-free table mirroring v8's cell-context
// shape (`row.original`, `getValue()`) is simpler and more transparent than fighting v9's new
// generics for zero functional benefit.
export interface ColumnDef<T> {
  id?: string
  accessorKey?: keyof T
  header: ReactNode
  /** Applied to both header and body cells for column-specific sizing/alignment. */
  className?: string
  cell?: (ctx: { row: { original: T }; getValue: <V = unknown>() => V }) => ReactNode
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  emptyMessage?: string
  /** Dims the whole table — used for the "Show archived" sub-table (admin doc §7). */
  dimmed?: boolean
  /** Lets flexible columns truncate inside the container instead of forcing max-content width. */
  fitContainer?: boolean
}

function columnKey<T>(col: ColumnDef<T>, index: number): string {
  if (col.id) return col.id
  if (col.accessorKey) return String(col.accessorKey)
  return String(index)
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = 'Nothing here yet.',
  dimmed = false,
  fitContainer = false,
}: DataTableProps<T>) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-slate-200 ${dimmed ? 'opacity-60' : ''}`}>
      <table className={`w-full text-left text-sm ${fitContainer ? '' : 'min-w-max'}`}>
        <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col, i) => (
              <th key={columnKey(col, i)} className={`whitespace-nowrap px-4 py-2.5 ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={rowIndex} className="text-slate-700">
                {columns.map((col, colIndex) => {
                  function getValue<V>(): V {
                    return col.accessorKey ? (row[col.accessorKey] as unknown as V) : (undefined as unknown as V)
                  }
                  const content = col.cell
                    ? col.cell({ row: { original: row }, getValue })
                    : col.accessorKey
                      ? String(row[col.accessorKey] ?? '')
                      : null
                  return (
                    <td
                      key={columnKey(col, colIndex)}
                      className={`whitespace-nowrap px-4 py-2.5 ${col.className ?? ''}`}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
