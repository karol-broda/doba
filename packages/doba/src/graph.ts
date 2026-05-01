export type Edge<K extends string = string> = {
  readonly to: K
  readonly cost: number
}

export type Graph<K extends string = string> = ReadonlyMap<K, readonly Edge<K>[]>

function reconstructPath<K extends string>(prev: ReadonlyMap<K, K>, from: K, to: K): K[] {
  const path: K[] = [to]
  let node = to
  for (;;) {
    const p = prev.get(node)
    if (p === undefined) {
      break
    }
    path.push(p)
    node = p
  }
  path.reverse()
  return path[0] === from ? path : []
}

export function findPathBFS<K extends string>(graph: Graph<K>, from: K, to: K): K[] | null {
  if (from === to) {
    return [from]
  }

  const prev = new Map<K, K>()
  const visited = new Set<K>([from])
  const queue: K[] = [from]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      break
    }

    const edges = graph.get(current)
    if (edges === undefined) {
      continue
    }

    for (const edge of edges) {
      if (visited.has(edge.to)) {
        continue
      }
      prev.set(edge.to, current)
      if (edge.to === to) {
        return reconstructPath(prev, from, to)
      }
      visited.add(edge.to)
      queue.push(edge.to)
    }
  }

  return null
}

/** returns all nodes reachable from `start` via BFS (excludes `start` itself). */
export function reachableFrom<K extends string>(graph: Graph<K>, start: K): ReadonlySet<K> {
  const visited = new Set<K>()
  const queue: K[] = [start]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      break
    }
    const edges = graph.get(current)
    if (edges === undefined) {
      continue
    }
    for (const edge of edges) {
      if (!visited.has(edge.to) && edge.to !== start) {
        visited.add(edge.to)
        queue.push(edge.to)
      }
    }
  }
  return visited
}

/** returns a new graph with all edges reversed. */
export function reverseGraph<K extends string>(graph: Graph<K>): Graph<K> {
  const rev = new Map<K, Edge<K>[]>()
  for (const [node] of graph) {
    rev.set(node, [])
  }
  for (const [node, edges] of graph) {
    for (const edge of edges) {
      rev.get(edge.to)?.push({ to: node, cost: edge.cost })
    }
  }
  return rev
}

export function findPathDijkstra<K extends string>(graph: Graph<K>, from: K, to: K): K[] | null {
  if (from === to) {
    return [from]
  }

  const dist = new Map<K, number>([[from, 0]])
  const prev = new Map<K, K>()
  const visited = new Set<K>()

  for (;;) {
    let current: K | undefined = undefined
    let currentDist = Infinity
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < currentDist) {
        current = node
        currentDist = d
      }
    }

    if (current === undefined) {
      return null
    }
    if (current === to) {
      break
    }

    visited.add(current)

    const edges = graph.get(current)
    if (edges === undefined) {
      continue
    }

    for (const edge of edges) {
      if (visited.has(edge.to)) {
        continue
      }
      const newDist = currentDist + edge.cost
      const existing = dist.get(edge.to)
      if (existing === undefined || newDist < existing) {
        dist.set(edge.to, newDist)
        prev.set(edge.to, current)
      }
    }
  }

  const path = reconstructPath(prev, from, to)
  return path.length > 0 ? path : null
}
