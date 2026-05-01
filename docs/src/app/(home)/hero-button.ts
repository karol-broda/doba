import { tv } from 'tailwind-variants'

export const heroButton = tv({
  base: 'flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-medium ring-1 ring-inset backdrop-blur transition-all',
  variants: {
    variant: {
      primary:
        'bg-white/[0.08] text-white/70 ring-white/[0.08] hover:bg-white/[0.14] hover:text-white/90',
      secondary:
        'bg-white/[0.04] text-white/40 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white/60',
    },
  },
})
