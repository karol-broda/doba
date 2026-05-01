'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { ShaderBackground } from '../shader'
import { heroButton } from '../hero-button'
import { ArrowRight, GitHubIcon } from '@/components/icons'
import { ease } from '@/lib/animation'

export function Hero() {
  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      <ShaderBackground />

      <div className="relative z-10 mx-auto max-w-xl px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease }}
          className="font-[family-name:var(--font-display)] text-[clamp(4.5rem,14vw,9rem)] italic leading-none tracking-tight text-white/90"
        >
          doba
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mt-4 text-sm uppercase tracking-[0.2em] text-white/35"
        >
          Schema registry for TypeScript
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-12 flex justify-center gap-3"
        >
          <Link href="/docs" className={heroButton({ variant: 'primary', className: 'group' })}>
            Docs
            <ArrowRight className="size-3 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
          </Link>
          <a
            href="https://github.com/karol-broda/doba"
            className={heroButton({ variant: 'secondary' })}
          >
            <GitHubIcon className="size-3.5" />
            GitHub
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="h-8 w-[1px] bg-gradient-to-b from-transparent to-white/20"
        />
      </motion.div>
    </section>
  )
}
