import type { ReactNode } from 'react'
import { card, mdxBlock } from './card'

export function BenchmarkGrid({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="not-prose my-6">
      {title && (
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-fd-muted-foreground">
          {title}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  )
}

export function BenchmarkCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className={card({ hover: true, padded: true, className: 'group' })}>
      <div className="text-xl font-[350] tabular-nums tracking-tight text-fd-foreground">
        {value}
      </div>
      <div className="mt-1 text-[13px] font-medium">{label}</div>
      {detail && <div className="mt-0.5 text-[11px] text-fd-muted-foreground">{detail}</div>}
    </div>
  )
}

export function BenchmarkTable({
  rows,
}: {
  rows: { operation: string; time: string; throughput: string }[]
}) {
  return (
    <div className={mdxBlock()}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-fd-border bg-fd-card/50">
            <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">
              Operation
            </th>
            <th className="px-4 py-2.5 text-right font-medium text-fd-muted-foreground">Time</th>
            <th className="px-4 py-2.5 text-right font-medium text-fd-muted-foreground">
              Throughput
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.operation}
              className={`transition-colors hover:bg-fd-accent/30 ${
                i < rows.length - 1 ? 'border-b border-fd-border/50' : ''
              }`}
            >
              <td className="px-4 py-2.5 font-mono text-[12px]">{row.operation}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.time}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-fd-muted-foreground">
                {row.throughput}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ScalingTable({
  rows,
}: {
  rows: { dimension: string; scaling: string; notes: string }[]
}) {
  return (
    <div className={mdxBlock()}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-fd-border bg-fd-card/50">
            <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">
              Dimension
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">Scaling</th>
            <th className="px-4 py-2.5 text-left font-medium text-fd-muted-foreground">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.dimension}
              className={`transition-colors hover:bg-fd-accent/30 ${
                i < rows.length - 1 ? 'border-b border-fd-border/50' : ''
              }`}
            >
              <td className="px-4 py-2.5 font-medium">{row.dimension}</td>
              <td className="px-4 py-2.5">
                <span className="rounded-md bg-fd-primary/10 px-2 py-0.5 text-[11px] font-medium text-fd-primary">
                  {row.scaling}
                </span>
              </td>
              <td className="px-4 py-2.5 text-fd-muted-foreground">{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
