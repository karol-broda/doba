import type { Graph } from '../graph.js'
import type { GraphEdge, GraphSnapshot } from './types.js'

function compareEdges<K extends string>(left: GraphEdge<K>, right: GraphEdge<K>): number {
  const from = left.from.localeCompare(right.from)
  if (from !== 0) {
    return from
  }

  const to = left.to.localeCompare(right.to)
  if (to !== 0) {
    return to
  }

  return left.cost - right.cost
}

export function snapshotGraph<K extends string>(graph: Graph<K>): GraphSnapshot<K> {
  const nodes = new Set<K>()
  const edges: GraphEdge<K>[] = []

  for (const [from, outgoing] of graph) {
    nodes.add(from)
    for (const edge of outgoing) {
      nodes.add(edge.to)
      edges.push({ from, to: edge.to, cost: edge.cost })
    }
  }

  return {
    nodes: [...nodes].toSorted(),
    edges: edges.toSorted(compareEdges),
  }
}
