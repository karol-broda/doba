import { docs } from 'collections/server'
import { loader, type PageData } from 'fumadocs-core/source'
import type { DocData } from 'fumadocs-mdx/runtime/types'

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})

export type DocsPageData = PageData & DocData
