'use client'

import { motion } from 'motion/react'
import { stats } from '../data'
import { section } from '@/components/section'
import { ease, inView, fadeUp } from '@/lib/animation'

export function Benchmarks() {
  return (
    <section className={section({ spacing: 'md', border: 'both', surface: 'card' })}>
      <div className="mx-auto max-w-2xl px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inView}
          transition={{ duration: 0.5, ease }}
          className="text-center font-[family-name:var(--font-display)] text-lg text-fd-muted-foreground"
        >
          Benchmarks
        </motion.p>

        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} {...fadeUp(i * 0.06)} className="text-center">
              <div className="text-2xl font-[300] tabular-nums tracking-tight text-fd-foreground md:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-fd-muted-foreground">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
