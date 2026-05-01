'use client'

import { Hero } from './_sections/hero'
import { Install } from './_sections/install'
import { Features } from './_sections/features'
import { Benchmarks } from './_sections/benchmarks'
import { CodeExample } from './_sections/code-example'
import { CTA } from './_sections/cta'
import { Footer } from './_sections/footer'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Install />
      <Features />
      <Benchmarks />
      <CodeExample />
      <CTA />
      <Footer />
    </main>
  )
}
