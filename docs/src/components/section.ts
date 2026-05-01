import { tv } from 'tailwind-variants'

export const section = tv({
  base: 'bg-fd-background',
  variants: {
    spacing: {
      sm: 'py-16',
      md: 'py-20 md:py-24',
      lg: 'py-24 md:py-32',
    },
    border: {
      top: 'border-t border-fd-border',
      bottom: 'border-b border-fd-border',
      both: 'border-y border-fd-border',
    },
    surface: {
      default: '',
      card: 'bg-fd-card',
    },
  },
  defaultVariants: {
    spacing: 'md',
  },
})
