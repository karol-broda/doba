import { tv } from 'tailwind-variants'

export const card = tv({
  base: 'rounded-xl border border-fd-border transition-colors',
  variants: {
    variant: {
      default: 'bg-fd-card/50',
      solid: 'bg-fd-card',
      ghost: 'bg-transparent',
    },
    hover: {
      true: 'hover:border-fd-primary/20 hover:bg-fd-card',
    },
    padded: {
      true: 'p-4',
      loose: 'p-6 md:p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export const mdxBlock = tv({
  base: 'not-prose my-6 overflow-hidden rounded-xl border border-fd-border',
})
