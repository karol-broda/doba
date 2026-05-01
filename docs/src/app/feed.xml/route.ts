import { Feed } from 'feed'
import { source } from '@/lib/source'

const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://doba.karolbroda.com'

export function GET() {
  const feed = new Feed({
    title: 'doba | Type-safe schema registry',
    description:
      'Schema registry with flexible transformations. Type-safe migrations between any schemas, errors as values.',
    id: baseUrl,
    link: baseUrl,
    language: 'en',
    favicon: `${baseUrl}/icon.svg`,
    copyright: 'MIT',
    author: { name: 'Karol Broda', link: 'https://karolbroda.com' },
    feedLinks: {
      atom: `${baseUrl}/feed.xml`,
    },
  })

  for (const page of source.getPages()) {
    feed.addItem({
      title: page.data.title ?? '',
      id: `${baseUrl}${page.url}`,
      link: `${baseUrl}${page.url}`,
      description: page.data.description ?? undefined,
      date: new Date(),
    })
  }

  return new Response(feed.atom1(), {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
