import { tv, type VariantProps } from 'tailwind-variants'
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

export const button = tv({
  base: 'inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-medium transition-all',
  variants: {
    variant: {
      primary: 'bg-fd-primary text-fd-primary-foreground hover:opacity-90',
      secondary:
        'border border-fd-border text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground',
      ghost: 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground',
    },
    size: {
      sm: 'px-4 py-1.5',
      md: 'px-5 py-2',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

export type ButtonVariants = VariantProps<typeof button>

export function Button({
  variant,
  size,
  href,
  className,
  children,
  ...props
}: ButtonVariants & {
  href?: string
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'button'>, 'className'>) {
  const cls = button({ variant, size, className })

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  )
}
