import { mdxBlock } from './card'

export function ResultDemo({
  ok,
  value,
  meta,
  issues,
}: {
  ok: boolean
  value?: string
  meta?: Record<string, string>
  issues?: string[]
}) {
  return (
    <div className={mdxBlock({ className: 'font-mono text-[13px]' })}>
      <div
        className={`flex items-center gap-2 border-b border-fd-border px-4 py-2.5 ${
          ok ? 'bg-emerald-500/5' : 'bg-red-500/5'
        }`}
      >
        <span
          className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
            ok
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/15 text-red-600 dark:text-red-400'
          }`}
        >
          {ok ? '\u2713' : '\u2717'}
        </span>
        <span className="text-[12px]">
          ok:{' '}
          <span
            className={
              ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }
          >
            {String(ok)}
          </span>
        </span>
      </div>

      <div className="space-y-0 divide-y divide-fd-border/50 bg-fd-background">
        {ok && value && (
          <div className="px-4 py-2.5">
            <span className="text-fd-muted-foreground">value: </span>
            <span className="text-fd-foreground">{value}</span>
          </div>
        )}

        {ok && meta && (
          <div className="px-4 py-2.5">
            <span className="text-fd-muted-foreground">meta: </span>
            <span className="text-fd-foreground">{'{'}</span>
            {Object.entries(meta).map(([k, v]) => (
              <div key={k} className="pl-4">
                <span className="text-fd-muted-foreground">{k}: </span>
                <span className="text-fd-foreground">{v}</span>
              </div>
            ))}
            <span className="text-fd-foreground">{'}'}</span>
          </div>
        )}

        {!ok && issues && (
          <div className="px-4 py-2.5">
            <span className="text-fd-muted-foreground">issues: </span>
            {issues.map((issue, i) => (
              <div key={i} className="pl-4 text-red-600/80 dark:text-red-400/70">
                - {issue}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
