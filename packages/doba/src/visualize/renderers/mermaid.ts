import { escapeQuoted } from '../escape.js'
import type { GraphSnapshot, MermaidConfig, NormalizedVisualizeOptions } from '../types.js'

function formatYamlScalar(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(String(value))
}

function formatYamlValue(value: unknown, indent: number): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return [' '.repeat(indent) + '-', ...formatYamlObject(item, indent + 2)]
      }

      return [' '.repeat(indent) + `- ${formatYamlScalar(item)}`]
    })
  }

  if (typeof value === 'object' && value !== null) {
    return formatYamlObject(value, indent)
  }

  return [' '.repeat(indent) + formatYamlScalar(value)]
}

function formatYamlObject(config: object, indent: number): string[] {
  const lines: string[] = []

  for (const [key, value] of Object.entries(config)) {
    const prefix = ' '.repeat(indent) + `${key}:`

    if (typeof value === 'object' && value !== null) {
      lines.push(prefix, ...formatYamlValue(value, indent + 2))
      continue
    }

    lines.push(`${prefix} ${formatYamlScalar(value)}`)
  }

  return lines
}

function renderMermaidFrontmatter(config: MermaidConfig | undefined): string[] {
  if (config === undefined) {
    return []
  }

  return ['---', 'config:', ...formatYamlObject(config, 2), '---']
}

export function renderMermaid<K extends string>(
  snapshot: GraphSnapshot<K>,
  options: NormalizedVisualizeOptions,
): string {
  const nodeIds = new Map<K, string>()
  const lines = [
    ...renderMermaidFrontmatter(options.mermaidConfig),
    `flowchart ${options.direction}`,
  ]

  for (let index = 0; index < snapshot.nodes.length; index++) {
    const node = snapshot.nodes[index]
    if (node === undefined) {
      continue
    }

    const nodeId = `n${index}`
    nodeIds.set(node, nodeId)
    lines.push(`  ${nodeId}["${escapeQuoted(node)}"]`)
  }

  for (const edge of snapshot.edges) {
    const from = nodeIds.get(edge.from)
    const to = nodeIds.get(edge.to)
    if (from === undefined || to === undefined) {
      continue
    }

    const label = options.costs ? `|cost: ${edge.cost}|` : ''
    lines.push(`  ${from} -->${label} ${to}`)
  }

  return lines.join('\n')
}
