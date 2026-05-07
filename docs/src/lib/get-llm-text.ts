import type { DocsPage } from '@/lib/source'

export async function getLLMText(page: DocsPage) {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title} (${page.url})

${processed}`
}
