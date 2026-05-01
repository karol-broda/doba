'use client'

import { motion } from 'motion/react'
import { features } from '../data'
import { fadeUp } from '@/lib/animation'

export function Features() {
  return (
    <section className="bg-fd-background pb-24 md:pb-32">
      <div className="mx-auto max-w-2xl px-6">
        <div className="space-y-10">
          {features.map(([title, detail], i) => (
            <motion.div
              key={title}
              {...fadeUp(i * 0.04)}
              className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-8"
            >
              <h2 className="text-[13px] font-semibold">{title}</h2>
              <p className="text-[13px] leading-relaxed text-fd-muted-foreground">{detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
