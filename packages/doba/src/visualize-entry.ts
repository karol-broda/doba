import type { Graph } from './graph.js'
import { normalizeVisualizeOptions } from './visualize/options.js'
import { renderDot } from './visualize/renderers/dot.js'
import { renderMermaid } from './visualize/renderers/mermaid.js'
import { renderText } from './visualize/renderers/text.js'
import { snapshotGraph } from './visualize/snapshot.js'
import type { VisualizeInput } from './visualize/types.js'

export type {
  MermaidConfig,
  MermaidConfigValue,
  VisualizeCommonOptions,
  VisualizeDirection,
  VisualizeDotOptions,
  VisualizeFormat,
  VisualizeInput,
  VisualizeJsonOptions,
  VisualizeMermaidOptions,
  VisualizeOptions,
  VisualizeTextOptions,
} from './visualize/types.js'

export function visualizeRegistry<K extends string>(
  graph: Graph<K>,
  input?: VisualizeInput,
): string {
  const options = normalizeVisualizeOptions(input)
  const snapshot = snapshotGraph(graph)

  if (options.format === 'json') {
    return JSON.stringify(snapshot, null, options.space)
  }

  if (options.format === 'mermaid') {
    return renderMermaid(snapshot, options)
  }

  if (options.format === 'dot') {
    return renderDot(snapshot, options)
  }

  return renderText(snapshot, options)
}
