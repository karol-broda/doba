import { describe, it, expect } from 'vitest'
import {
  findPathBFS,
  findPathDijkstra,
  reachableFrom,
  reverseGraph,
  type Graph,
  type Edge,
} from '../src/graph.js'

function buildGraph<K extends string>(
  nodes: K[],
  edges: { from: K; to: K; cost?: number }[],
): Graph<K> {
  const graph = new Map<K, Edge<K>[]>()
  for (const node of nodes) {
    graph.set(node, [])
  }
  for (const e of edges) {
    graph.get(e.from)?.push({ to: e.to, cost: e.cost ?? 1 })
  }
  return graph
}

for (const [name, findPath] of [
  ['BFS', findPathBFS],
  ['Dijkstra', findPathDijkstra],
] as const) {
  describe(`findPath (${name})`, () => {
    it('returns [from] when from === to', () => {
      const graph = buildGraph(['a', 'b'], [{ from: 'a', to: 'b' }])
      expect(findPath(graph, 'a', 'a')).toEqual(['a'])
    })

    it('finds direct path', () => {
      const graph = buildGraph(['a', 'b'], [{ from: 'a', to: 'b' }])
      expect(findPath(graph, 'a', 'b')).toEqual(['a', 'b'])
    })

    it('finds multi-hop path', () => {
      const graph = buildGraph(
        ['a', 'b', 'c', 'd'],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'd' },
        ],
      )
      expect(findPath(graph, 'a', 'd')).toEqual(['a', 'b', 'c', 'd'])
    })

    it('returns null when no path exists', () => {
      const graph = buildGraph(['a', 'b'], [{ from: 'a', to: 'b' }])
      expect(findPath(graph, 'b', 'a')).toBe(null)
    })

    it('returns null for disconnected components', () => {
      const graph = buildGraph(
        ['a', 'b', 'c', 'd'],
        [
          { from: 'a', to: 'b' },
          { from: 'c', to: 'd' },
        ],
      )
      expect(findPath(graph, 'a', 'd')).toBe(null)
    })

    it('returns null when from is not in graph', () => {
      const graph = buildGraph(['a'], [])
      expect(findPath(graph, 'x' as 'a', 'a')).toBe(null)
    })

    it('handles orphaned nodes', () => {
      const graph = buildGraph(['a', 'b', 'orphan'], [{ from: 'a', to: 'b' }])
      expect(findPath(graph, 'a', 'orphan')).toBe(null)
      expect(findPath(graph, 'orphan', 'a')).toBe(null)
    })

    it('handles cycles without infinite loop', () => {
      const graph = buildGraph(
        ['a', 'b', 'c'],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'a' },
        ],
      )
      expect(findPath(graph, 'a', 'c')).toEqual(['a', 'b', 'c'])
    })

    it('finds shortest path (fewest hops) in unweighted graph', () => {
      const graph = buildGraph(
        ['a', 'b', 'c', 'd'],
        [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'd' },
          { from: 'a', to: 'c' },
          { from: 'c', to: 'd' },
        ],
      )
      const path = findPath(graph, 'a', 'd')
      expect(path).toHaveLength(3)
    })

    it('handles empty graph', () => {
      const graph: Graph = new Map()
      expect(findPath(graph, 'a', 'b')).toBe(null)
    })

    it('handles single-node graph', () => {
      const graph = buildGraph(['a'], [])
      expect(findPath(graph, 'a', 'a')).toEqual(['a'])
    })
  })
}

describe('findPathDijkstra (weighted)', () => {
  it('picks lowest-cost path over fewest-hop path', () => {
    const graph = buildGraph(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'c', cost: 100 },
        { from: 'a', to: 'b', cost: 1 },
        { from: 'b', to: 'c', cost: 1 },
      ],
    )
    expect(findPathDijkstra(graph, 'a', 'c')).toEqual(['a', 'b', 'c'])
  })

  it('picks direct path when it has lowest cost', () => {
    const graph = buildGraph(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'c', cost: 1 },
        { from: 'a', to: 'b', cost: 50 },
        { from: 'b', to: 'c', cost: 50 },
      ],
    )
    expect(findPathDijkstra(graph, 'a', 'c')).toEqual(['a', 'c'])
  })

  it('handles zero-cost edges', () => {
    const graph = buildGraph(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'b', cost: 0 },
        { from: 'b', to: 'c', cost: 0 },
        { from: 'a', to: 'c', cost: 1 },
      ],
    )
    expect(findPathDijkstra(graph, 'a', 'c')).toEqual(['a', 'b', 'c'])
  })

  it('handles mixed costs across longer chain', () => {
    const graph = buildGraph(
      ['a', 'b', 'c', 'd', 'e'],
      [
        { from: 'a', to: 'e', cost: 10 },
        { from: 'a', to: 'b', cost: 1 },
        { from: 'b', to: 'c', cost: 1 },
        { from: 'c', to: 'd', cost: 1 },
        { from: 'd', to: 'e', cost: 1 },
      ],
    )
    expect(findPathDijkstra(graph, 'a', 'e')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('reachableFrom', () => {
  it('returns all reachable nodes', () => {
    const graph = buildGraph(
      ['a', 'b', 'c', 'd'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    )
    expect(reachableFrom(graph, 'a')).toEqual(new Set(['b', 'c']))
  })

  it('returns empty set for isolated node', () => {
    const graph = buildGraph(['a', 'b'], [])
    expect(reachableFrom(graph, 'a')).toEqual(new Set())
  })

  it('does not include the start node', () => {
    const graph = buildGraph(
      ['a', 'b'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    )
    const result = reachableFrom(graph, 'a')
    expect(result.has('a')).toBe(false)
    expect(result.has('b')).toBe(true)
  })

  it('handles cycles without infinite loop', () => {
    const graph = buildGraph(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    )
    expect(reachableFrom(graph, 'a')).toEqual(new Set(['b', 'c']))
  })

  it('handles disconnected components', () => {
    const graph = buildGraph(
      ['a', 'b', 'c', 'd'],
      [
        { from: 'a', to: 'b' },
        { from: 'c', to: 'd' },
      ],
    )
    expect(reachableFrom(graph, 'a')).toEqual(new Set(['b']))
  })
})

describe('reachableFrom (edge cases)', () => {
  it('returns empty set when start node is not in graph', () => {
    const graph = buildGraph(['a', 'b'], [{ from: 'a', to: 'b' }])
    expect(reachableFrom(graph, 'x' as 'a')).toEqual(new Set())
  })

  it('handles diamond-shaped graph', () => {
    const graph = buildGraph(
      ['a', 'b', 'c', 'd'],
      [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ],
    )
    expect(reachableFrom(graph, 'a')).toEqual(new Set(['b', 'c', 'd']))
  })

  it('handles self-loop edge', () => {
    const graph = buildGraph(
      ['a', 'b'],
      [
        { from: 'a', to: 'a' },
        { from: 'a', to: 'b' },
      ],
    )
    const result = reachableFrom(graph, 'a')
    expect(result.has('a')).toBe(false) // excludes start
    expect(result.has('b')).toBe(true)
  })

  it('handles long chain', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'] as const
    type N = (typeof nodes)[number]
    const edges: { from: N; to: N }[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'e' },
    ]
    const graph = buildGraph([...nodes], edges)
    expect(reachableFrom(graph, 'a')).toEqual(new Set(['b', 'c', 'd', 'e']))
    expect(reachableFrom(graph, 'c')).toEqual(new Set(['d', 'e']))
    expect(reachableFrom(graph, 'e')).toEqual(new Set())
  })
})

describe('reverseGraph', () => {
  it('reverses all edges', () => {
    const graph = buildGraph(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'b', cost: 1 },
        { from: 'b', to: 'c', cost: 2 },
      ],
    )
    const rev = reverseGraph(graph)
    expect(rev.get('a')).toEqual([])
    expect(rev.get('b')).toEqual([{ to: 'a', cost: 1 }])
    expect(rev.get('c')).toEqual([{ to: 'b', cost: 2 }])
  })

  it('preserves all nodes even without edges', () => {
    const graph = buildGraph(['a', 'b', 'c'], [])
    const rev = reverseGraph(graph)
    expect(rev.size).toBe(3)
    expect(rev.get('a')).toEqual([])
    expect(rev.get('b')).toEqual([])
    expect(rev.get('c')).toEqual([])
  })

  it('handles bidirectional edges', () => {
    const graph = buildGraph(
      ['a', 'b'],
      [
        { from: 'a', to: 'b', cost: 1 },
        { from: 'b', to: 'a', cost: 2 },
      ],
    )
    const rev = reverseGraph(graph)
    expect(rev.get('a')).toEqual([{ to: 'b', cost: 2 }])
    expect(rev.get('b')).toEqual([{ to: 'a', cost: 1 }])
  })
})
