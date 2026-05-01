import { createSearchAPI } from 'fumadocs-core/search/server'
import { source, type DocsPageData } from '@/lib/source'

export const { GET } = createSearchAPI('advanced', {
  indexes: source.getPages().map((page) => ({
    title: page.data.title ?? '',
    description: page.data.description ?? '',
    url: page.url,
    id: page.url,
    structuredData: (page.data as DocsPageData).structuredData,
  })),
})
