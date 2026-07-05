import type {
  NormalizedVisualizeOptions,
  VisualizeDotOptions,
  VisualizeInput,
  VisualizeJsonOptions,
  VisualizeMermaidOptions,
  VisualizeTextOptions,
} from './types.js'

export function normalizeVisualizeOptions(input: VisualizeInput = {}): NormalizedVisualizeOptions {
  const format = typeof input === 'string' ? input : (input.format ?? 'text')

  if (format === 'json') {
    const options: Partial<VisualizeJsonOptions> =
      typeof input === 'object' && input.format === 'json' ? input : {}

    return {
      format,
      direction: 'LR',
      costs: true,
      title: 'Registry graph',
      graphName: 'Registry',
      space: options.space ?? 2,
      mermaidConfig: undefined,
    }
  }

  if (format === 'dot') {
    const options: Partial<VisualizeDotOptions> =
      typeof input === 'object' && input.format === 'dot' ? input : {}

    return {
      format,
      direction: options.direction ?? 'LR',
      costs: options.costs ?? true,
      title: 'Registry graph',
      graphName: options.graphName ?? 'Registry',
      space: 2,
      mermaidConfig: undefined,
    }
  }

  if (format === 'mermaid') {
    const options: Partial<VisualizeMermaidOptions> =
      typeof input === 'object' && input.format === 'mermaid' ? input : {}

    return {
      format,
      direction: options.direction ?? 'LR',
      costs: options.costs ?? true,
      title: 'Registry graph',
      graphName: 'Registry',
      space: 2,
      mermaidConfig: options.config,
    }
  }

  const options: Partial<VisualizeTextOptions> =
    typeof input === 'object' && (input.format === undefined || input.format === 'text')
      ? input
      : {}

  return {
    format,
    direction: 'LR',
    costs: options.costs ?? true,
    title: options.title ?? 'Registry graph',
    graphName: 'Registry',
    space: 2,
    mermaidConfig: undefined,
  }
}
