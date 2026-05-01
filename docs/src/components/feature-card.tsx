import type { ReactNode } from 'react'
import Link from 'next/link'
import { card } from './card'

export function FeatureGrid({ children }: { children: ReactNode }) {
  return <div className="not-prose my-8 grid gap-3 sm:grid-cols-2">{children}</div>
}

export function Feature({
  title,
  description,
  href,
  icon,
}: {
  title: string
  description: string
  href?: string
  icon?: ReactNode
}) {
  const content = (
    <div className="flex items-start gap-3">
      {icon && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-fd-primary/10 text-fd-primary">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-[13px] font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-fd-muted-foreground">{description}</p>
      </div>
    </div>
  )

  const cls = card({ hover: true, padded: true })

  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    )
  }

  return <div className={cls}>{content}</div>
}
