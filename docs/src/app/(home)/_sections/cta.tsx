'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { button } from '@/components/button'
import { section } from '@/components/section'
import { ArrowRight } from '@/components/icons'
import { fadeUp } from '@/lib/animation'

export function CTA() {
  return (
    <section className={section({ spacing: 'md', border: 'top' })}>
      <div className="mx-auto max-w-md px-6 text-center">
        <motion.div {...fadeUp()}>
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            Get started
          </h2>
          <p className="mt-2 text-sm text-fd-muted-foreground">
            Install doba and start transforming schemas.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/docs" className={button({ className: 'group' })}>
              Read the docs
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/docs/quick-start" className={button({ variant: 'secondary' })}>
              Quick start
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
