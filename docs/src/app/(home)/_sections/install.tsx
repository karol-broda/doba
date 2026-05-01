'use client'

import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import { motion } from 'motion/react'
import { section } from '@/components/section'
import { fadeUp } from '@/lib/animation'

export function Install() {
  return (
    <section className={section({ spacing: 'sm' })}>
      <div className="mx-auto max-w-xs px-6">
        <motion.div {...fadeUp()}>
          <DynamicCodeBlock lang="bash" code="bun add doba" />
        </motion.div>
      </div>
    </section>
  )
}
