import { escapeQuoted } from '../escape.js'
import type { GraphSnapshot, NormalizedVisualizeOptions } from '../types.js'

function escapeDotIdentifier(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : `"${escapeQuoted(value)}"`
}

export function renderDot<K extends string>(
  snapshot: GraphSnapshot<K>,
  options: NormalizedVisualizeOptions,
): string {
  const lines = [
    `digraph ${escapeDotIdentifier(options.graphName)} {`,
    `  rankdir=${options.direction};`,
  ]

  for (const node of snapshot.nodes) {
    lines.push(`  "${escapeQuoted(node)}";`)
  }

  for (const edge of snapshot.edges) {
    const attrs = options.costs ? ` [label="cost: ${edge.cost}"]` : ''
    lines.push(`  "${escapeQuoted(edge.from)}" -> "${escapeQuoted(edge.to)}"${attrs};`)
  }

  lines.push('}')

  return lines.join('\n')
}
