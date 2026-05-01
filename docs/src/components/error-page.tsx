import Link from 'next/link'
import { button } from './button'

export function ErrorPage({
  code,
  title,
  description,
  action,
}: {
  code: string
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fd-primary/[0.04] blur-[100px]" />
        <div className="absolute left-1/3 top-1/2 size-[300px] -translate-x-1/2 rounded-full bg-fd-primary/[0.03] blur-[80px]" />
      </div>

      <div className="relative text-center">
        <div className="font-[family-name:var(--font-display)] text-[clamp(6rem,20vw,12rem)] italic leading-none tracking-tighter text-fd-border">
          {code}
        </div>

        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl italic tracking-tight text-fd-foreground sm:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-fd-muted-foreground">
            {description}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          {action?.href && (
            <Link href={action.href} className={button()}>
              {action.label}
            </Link>
          )}
          {action?.onClick && (
            <button onClick={action.onClick} className={button()}>
              {action.label}
            </button>
          )}
          <Link href="/docs" className={button({ variant: 'secondary' })}>
            Docs
          </Link>
        </div>
      </div>
    </div>
  )
}
