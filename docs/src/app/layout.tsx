/* oxlint-disable new-cap -- Next.js font loaders are factory functions, not constructors */
import { RootProvider } from 'fumadocs-ui/provider/next'
import { Space_Grotesk, Instrument_Serif } from 'next/font/google'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import './global.css'

const body = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
})

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
})

const siteDescription =
  'Schema registry with flexible transformations. Type-safe migrations between any schemas, errors as values.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL ?? 'https://doba.karolbroda.com'),
  title: {
    template: '%s | doba',
    default: 'doba - Type-safe schema registry',
  },
  description: siteDescription,
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'doba - Type-safe schema registry',
    description: siteDescription,
    images: [{ url: '/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'doba - Type-safe schema registry',
    description: siteDescription,
    images: ['/og'],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${body.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareSourceCode',
              name: 'doba',
              description: siteDescription,
              url: 'https://doba.karolbroda.com',
              codeRepository: 'https://github.com/karol-broda/doba',
              programmingLanguage: 'TypeScript',
              runtimePlatform: 'Bun',
              license: 'https://opensource.org/licenses/MIT',
            }),
          }}
        />
      </head>
      <body className="font-[family-name:var(--font-body)] antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
