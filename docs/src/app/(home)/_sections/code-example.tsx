'use client'

import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import { motion } from 'motion/react'
import { exampleCode } from '../data'
import { section } from '@/components/section'
import { fadeUp } from '@/lib/animation'

export function CodeExample() {
  return (
    <section className={section({ spacing: 'lg' })}>
      <div className="mx-auto max-w-2xl px-6">
        <motion.div {...fadeUp()}>
          <p className="mb-6 font-[family-name:var(--font-display)] text-lg text-fd-muted-foreground">
            Example
          </p>
          <div className="overflow-hidden rounded-lg border border-fd-border">
            <DynamicCodeBlock lang="ts" code={exampleCode} />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
