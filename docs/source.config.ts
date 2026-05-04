import { resolve } from 'node:path'
import { defineDocs, defineConfig } from 'fumadocs-mdx/config'
import { transformerTwoslash } from 'fumadocs-twoslash'
import { createFileSystemTypesCache } from 'fumadocs-twoslash/cache-fs'
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins'
import {
  remarkAutoTypeTable,
  createGenerator,
  createFileSystemGeneratorCache,
} from 'fumadocs-typescript'

const __dirname = import.meta.dirname

const generator = createGenerator({
  cache: createFileSystemGeneratorCache('.next/fumadocs-typescript'),
})

export const docs = defineDocs({
  dir: 'content/docs',
})

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [[remarkAutoTypeTable, { generator }]],
    rehypeCodeOptions: {
      themes: {
        light: 'rose-pine-dawn',
        dark: 'rose-pine',
      },
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        transformerTwoslash({
          typesCache: createFileSystemTypesCache(),
          twoslashOptions: {
            tsconfig: resolve(__dirname, 'tsconfig.twoslash.json'),
          },
        }),
      ],
      langs: ['ts', 'tsx', 'js', 'jsx'],
    },
  },
})
