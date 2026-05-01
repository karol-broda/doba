import type { MDXComponents } from 'mdx/types'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { ImageZoom, type ImageZoomProps } from 'fumadocs-ui/components/image-zoom'
import * as TabsComponents from 'fumadocs-ui/components/tabs'
import {
  MigrationGraph,
  MigrationGraphComplex,
  GraphRow,
  GNode,
  GArrow,
} from '@/components/migration-graph'
import { BenchmarkGrid, BenchmarkCard, BenchmarkTable, ScalingTable } from '@/components/benchmark'
import { SchemaDiff } from '@/components/schema-diff'
import { FeatureGrid, Feature } from '@/components/feature-card'
import { ResultDemo } from '@/components/result-demo'

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    img: (props: React.ComponentProps<'img'>) => <ImageZoom {...(props as ImageZoomProps)} />,
    pre: ({ ref: _ref, ...props }: React.ComponentProps<'pre'>) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    MigrationGraph,
    MigrationGraphComplex,
    GraphRow,
    GNode,
    GArrow,
    BenchmarkGrid,
    BenchmarkCard,
    BenchmarkTable,
    ScalingTable,
    SchemaDiff,
    FeatureGrid,
    Feature,
    ResultDemo,
    ...components,
  }
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return getMDXComponents(components)
}
