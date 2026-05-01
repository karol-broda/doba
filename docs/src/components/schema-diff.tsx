import { mdxBlock } from './card'

type Field = {
  name: string
  type: string
  removed?: boolean
  added?: boolean
}

export function SchemaDiff({
  from,
  to,
  fromLabel,
  toLabel,
  fields,
}: {
  from: string
  to: string
  fromLabel?: string
  toLabel?: string
  fields: Field[]
}) {
  return (
    <div className={mdxBlock()}>
      <div className="flex items-center gap-2 border-b border-fd-border bg-fd-card/50 px-4 py-2.5">
        <span className="text-[13px] font-medium">{fromLabel || from}</span>
        <svg width="20" height="10" viewBox="0 0 20 10" className="text-fd-muted-foreground">
          <line x1="0" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="14,1.5 20,5 14,8.5" fill="currentColor" />
        </svg>
        <span className="text-[13px] font-medium">{toLabel || to}</span>
      </div>
      <div className="divide-y divide-fd-border/50">
        {fields.map((f) => (
          <div
            key={f.name}
            /* oxlint-disable no-nested-ternary, unicorn/no-nested-ternary -- ternary chain maps 3 visual states (removed/added/unchanged) to CSS classes */
            className={`flex items-center justify-between px-4 py-2 text-[13px] transition-colors ${
              f.removed
                ? 'bg-red-500/5 text-red-600/80 dark:text-red-400/70'
                : f.added
                  ? 'bg-emerald-500/5 text-emerald-600/80 dark:text-emerald-400/70'
                  : 'hover:bg-fd-accent/30'
            }`}
            /* oxlint-enable no-nested-ternary, unicorn/no-nested-ternary */
          >
            <div className="flex items-center gap-2">
              {f.removed && (
                <span className="flex size-4 items-center justify-center text-[10px] font-bold">
                  -
                </span>
              )}
              {f.added && (
                <span className="flex size-4 items-center justify-center text-[10px] font-bold">
                  +
                </span>
              )}
              {!f.removed && !f.added && <span className="w-4" />}
              <span className="font-mono text-[12px]">{f.name}</span>
            </div>
            <span className="font-mono text-[11px] text-fd-muted-foreground">{f.type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
