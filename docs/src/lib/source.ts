import { docs } from 'collections/server'
import { loader, type Page, type PageData } from 'fumadocs-core/source'
import type { DocData, DocMethods } from 'fumadocs-mdx/runtime/types'

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
})

// fumadocs-mdx adds DocData & DocMethods at runtime, but the generated
// .source/server.ts uses @ts-nocheck so the types don't flow through loader()
export type DocsPageData = PageData & DocData & DocMethods
export type DocsPage = Page<undefined, DocsPageData>

export function getDocsPage(slugs?: string[]) {
  return source.getPage(slugs) as DocsPage | undefined
}

export function getDocsPages() {
  return source.getPages() as DocsPage[]
}
