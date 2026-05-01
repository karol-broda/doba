/** Shared easing curve used across all motion components */
export const ease = [0.16, 1, 0.3, 1] as const

/** Standard viewport trigger config */
export const inView = { once: true, margin: '-80px' } as const

/** Reusable motion variants */
export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: inView,
  transition: { duration: 0.5, delay, ease },
})
