/* oxlint-disable no-console -- stress benchmarks log progress to stdout */
/* oxlint-disable no-await-in-loop -- benchmarks measure sequential transform throughput */
/* oxlint-disable unicorn/numeric-separators-style -- benchmark constants are clearer without separators */
/* oxlint-disable unicorn/number-literal-case -- hex constants formatted for readability */
/* oxlint-disable unicorn/consistent-function-scoping -- benchmark helper functions are co-located with their benchmarks */
import { bench, group, run, do_not_optimize } from 'mitata'
import { createRegistry } from '../src/index.js'
import { createMockSchema, dynamicMigrations } from './helpers.js'

// large object with many fields
type LargeObject = {
  id: string
  timestamp: number
  data: Record<string, string>
  tags: string[]
  metadata: {
    version: number
    source: string
    flags: boolean[]
  }
}

// recursive tree structure
type TreeNode = {
  id: string
  value: number
  children: TreeNode[]
}

// deeply nested object
type DeeplyNested = {
  level: number
  data: string
  child: DeeplyNested | undefined
}

// linked list node
type ListNode = {
  id: string
  value: number
  next: ListNode | null
}

// graph node with adjacency
type GraphNode = {
  id: string
  edges: string[]
  metadata: Record<string, unknown>
}

function createLargeObject(id: string, fieldCount: number): LargeObject {
  const data: Record<string, string> = {}
  for (let i = 0; i < fieldCount; i++) {
    data[`field_${i}`] = `value_${i}_${Math.random().toString(36).slice(2)}`
  }
  return {
    id,
    timestamp: Date.now(),
    data,
    tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
    metadata: {
      version: 1,
      source: 'stress-test',
      flags: Array.from({ length: 10 }, () => Math.random() > 0.5),
    },
  }
}

const largeObjectSchema = createMockSchema<LargeObject>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as LargeObject }
})

type SimpleNode = { id: string }

const simpleSchema = createMockSchema<SimpleNode>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as SimpleNode }
})

const treeSchema = createMockSchema<TreeNode>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as TreeNode }
})

const nestedSchema = createMockSchema<DeeplyNested>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as DeeplyNested }
})

const listSchema = createMockSchema<ListNode>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as ListNode }
})

const graphNodeSchema = createMockSchema<GraphNode>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as GraphNode }
})

// create a tree with specified depth and branching factor
function createTree(depth: number, branching: number, prefix = 'node'): TreeNode {
  const node: TreeNode = {
    id: `${prefix}-${depth}`,
    value: depth * branching,
    children: [],
  }
  if (depth > 0) {
    for (let i = 0; i < branching; i++) {
      node.children.push(createTree(depth - 1, branching, `${prefix}-${i}`))
    }
  }
  return node
}

// create deeply nested object
function createNestedObject(depth: number): DeeplyNested {
  if (depth <= 0) {
    return { level: 0, data: 'leaf', child: undefined }
  }
  return {
    level: depth,
    data: `level-${depth}-${'x'.repeat(100)}`,
    child: createNestedObject(depth - 1),
  }
}

// create linked list
function createLinkedList(length: number): ListNode {
  const head: ListNode = { id: 'head', value: 0, next: null }
  let current = head
  for (let i = 1; i < length; i++) {
    current.next = { id: `node-${i}`, value: i, next: null }
    current = current.next
  }
  return head
}

// create graph node with many edges
function createGraphNodeData(edgeCount: number): GraphNode {
  return {
    id: 'graph-node',
    edges: Array.from({ length: edgeCount }, (_, i) => `edge-${i}`),
    metadata: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`key-${i}`, `value-${i}`])),
  }
}

// create a linear chain of n schemas
function createLinearChain(length: number) {
  const schemas: Record<string, typeof simpleSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let i = 0; i < length; i++) {
    schemas[`s${i}`] = simpleSchema
  }

  for (let i = 0; i < length - 1; i++) {
    migrations[`s${i}->s${i + 1}`] = (v: SimpleNode) => v
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

// create a fully connected graph (every node connects to every other node)
function createFullyConnectedGraph(nodeCount: number) {
  const schemas: Record<string, typeof simpleSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let i = 0; i < nodeCount; i++) {
    schemas[`n${i}`] = simpleSchema
  }

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      if (i !== j) {
        migrations[`n${i}->n${j}`] = (v: SimpleNode) => v
      }
    }
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

// create a diamond/lattice graph with multiple paths
function createLatticeGraph(width: number, depth: number) {
  const schemas: Record<string, typeof simpleSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let d = 0; d < depth; d++) {
    for (let w = 0; w < width; w++) {
      schemas[`l${d}_${w}`] = simpleSchema
    }
  }

  // connect each node to all nodes in the next layer
  for (let d = 0; d < depth - 1; d++) {
    for (let w = 0; w < width; w++) {
      for (let nw = 0; nw < width; nw++) {
        migrations[`l${d}_${w}->l${d + 1}_${nw}`] = (v: SimpleNode) => v
      }
    }
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

// create a sparse random graph
function createSparseGraph(nodeCount: number, edgeProbability: number) {
  const schemas: Record<string, typeof simpleSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let i = 0; i < nodeCount; i++) {
    schemas[`r${i}`] = simpleSchema
  }

  // random edges with given probability
  const seed = 12345
  let rand = seed
  const random = () => {
    rand = (rand * 1103515245 + 12345) & 0x7fffffff
    return rand / 0x7fffffff
  }

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      if (i !== j && random() < edgeProbability) {
        migrations[`r${i}->r${j}`] = (v: SimpleNode) => v
      }
    }
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

// create registry with large object schemas and complex migrations
function createLargeObjectRegistry(schemaCount: number) {
  const schemas: Record<string, typeof largeObjectSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let i = 0; i < schemaCount; i++) {
    schemas[`big${i}`] = largeObjectSchema
  }

  for (let i = 0; i < schemaCount - 1; i++) {
    migrations[`big${i}->big${i + 1}`] = (v: LargeObject) => ({
      ...v,
      id: `${v.id}-transformed`,
      timestamp: v.timestamp + 1,
      metadata: {
        ...v.metadata,
        version: v.metadata.version + 1,
      },
    })
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

console.log('Setting up stress test registries...\n')

// pre-create registries to measure transform performance, not creation
const chain200 = createLinearChain(200)
const chain500 = createLinearChain(500)
const chain1000 = createLinearChain(1000)

const fullyConnected20 = createFullyConnectedGraph(20) // 20 nodes, 380 edges
const fullyConnected50 = createFullyConnectedGraph(50) // 50 nodes, 2450 edges
const fullyConnected100 = createFullyConnectedGraph(100) // 100 nodes, 9900 edges

const lattice10x10 = createLatticeGraph(10, 10) // 100 nodes, 900 edges
const lattice20x10 = createLatticeGraph(20, 10) // 200 nodes, 3600 edges
const lattice10x20 = createLatticeGraph(10, 20) // 200 nodes, 1900 edges (deeper)

const sparse100 = createSparseGraph(100, 0.1) // ~1000 edges
const sparse500 = createSparseGraph(500, 0.02) // ~5000 edges
const sparse1000 = createSparseGraph(1000, 0.005) // ~5000 edges

const largeObj10 = createLargeObjectRegistry(10)
const largeObj25 = createLargeObjectRegistry(25)

const sampleNode: SimpleNode = { id: 'test-node' }
const smallObject = createLargeObject('small', 10)
const mediumObject = createLargeObject('medium', 100)
const largeObject = createLargeObject('large', 1000)
const hugeObject = createLargeObject('huge', 10000)

console.log('Registries created. Starting benchmarks...\n')

// registry creation at extreme scale
group('registry creation (extreme)', () => {
  bench('200 schemas linear', () => {
    do_not_optimize(createLinearChain(200))
  }).gc('inner')

  bench('500 schemas linear', () => {
    do_not_optimize(createLinearChain(500))
  }).gc('inner')

  bench('1000 schemas linear', () => {
    do_not_optimize(createLinearChain(1000))
  }).gc('inner')

  bench('fully connected 20 nodes (380 edges)', () => {
    do_not_optimize(createFullyConnectedGraph(20))
  }).gc('inner')

  bench('fully connected 50 nodes (2450 edges)', () => {
    do_not_optimize(createFullyConnectedGraph(50))
  }).gc('inner')

  bench('lattice 10x10 (100 nodes, 900 edges)', () => {
    do_not_optimize(createLatticeGraph(10, 10))
  }).gc('inner')

  bench('lattice 20x10 (200 nodes, 3600 edges)', () => {
    do_not_optimize(createLatticeGraph(20, 10))
  }).gc('inner')
})

// findPath in very long chains
group('findPath (extreme linear chains)', () => {
  bench('200 hops', () => {
    do_not_optimize(chain200.findPath('s0', 's199'))
  })

  bench('500 hops', () => {
    do_not_optimize(chain500.findPath('s0', 's499'))
  })

  bench('1000 hops', () => {
    do_not_optimize(chain1000.findPath('s0', 's999'))
  })
})

// findPath in fully connected graphs (BFS with many options)
group('findPath (fully connected graphs)', () => {
  bench('20 nodes (shortest = 1 hop, 380 edges to consider)', () => {
    do_not_optimize(fullyConnected20.findPath('n0', 'n19'))
  })

  bench('50 nodes (shortest = 1 hop, 2450 edges to consider)', () => {
    do_not_optimize(fullyConnected50.findPath('n0', 'n49'))
  })

  bench('100 nodes (shortest = 1 hop, 9900 edges to consider)', () => {
    do_not_optimize(fullyConnected100.findPath('n0', 'n99'))
  })
})

// findPath in lattice graphs (many possible paths)
group('findPath (lattice graphs - many paths)', () => {
  bench('10x10 lattice (diagonal traversal)', () => {
    do_not_optimize(lattice10x10.findPath('l0_0', 'l9_9'))
  })

  bench('20x10 lattice (wide)', () => {
    do_not_optimize(lattice20x10.findPath('l0_0', 'l9_19'))
  })

  bench('10x20 lattice (deep)', () => {
    do_not_optimize(lattice10x20.findPath('l0_0', 'l19_9'))
  })
})

// findPath in sparse random graphs
group('findPath (sparse random graphs)', () => {
  bench('100 nodes, ~1000 edges', () => {
    do_not_optimize(sparse100.findPath('r0', 'r99'))
  })

  bench('500 nodes, ~5000 edges', () => {
    do_not_optimize(sparse500.findPath('r0', 'r499'))
  })

  bench('1000 nodes, ~5000 edges', () => {
    do_not_optimize(sparse1000.findPath('r0', 'r999'))
  })
})

// transform through very long chains
group('transform (extreme chain depth)', () => {
  bench('100 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain200.transform(node, 's0', 's100'))
      },
    }
  })

  bench('200 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain200.transform(node, 's0', 's199'))
      },
    }
  })

  bench('500 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain500.transform(node, 's0', 's499'))
      },
    }
  })

  bench('1000 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain1000.transform(node, 's0', 's999'))
      },
    }
  })
})

// transform with large objects
group('transform (large objects)', () => {
  bench('small object (10 fields)', function* () {
    yield {
      0: () => ({ ...smallObject }),
      async bench(obj: LargeObject) {
        do_not_optimize(await largeObj10.transform(obj, 'big0', 'big9'))
      },
    }
  })

  bench('medium object (100 fields)', function* () {
    yield {
      0: () => ({ ...mediumObject }),
      async bench(obj: LargeObject) {
        do_not_optimize(await largeObj10.transform(obj, 'big0', 'big9'))
      },
    }
  })

  bench('large object (1000 fields)', function* () {
    yield {
      0: () => ({ ...largeObject }),
      async bench(obj: LargeObject) {
        do_not_optimize(await largeObj10.transform(obj, 'big0', 'big9'))
      },
    }
  })

  bench('huge object (10000 fields)', function* () {
    yield {
      0: () => ({ ...hugeObject }),
      async bench(obj: LargeObject) {
        do_not_optimize(await largeObj10.transform(obj, 'big0', 'big9'))
      },
    }
  })
})

// transform large objects through longer chains
group('transform (large objects, longer chains)', () => {
  bench('medium object, 25 hops', function* () {
    yield {
      0: () => ({ ...mediumObject }),
      async bench(obj: LargeObject) {
        do_not_optimize(await largeObj25.transform(obj, 'big0', 'big24'))
      },
    }
  })

  bench('large object, 25 hops', function* () {
    yield {
      0: () => ({ ...largeObject }),
      async bench(obj: LargeObject) {
        do_not_optimize(await largeObj25.transform(obj, 'big0', 'big24'))
      },
    }
  })
})

// batch processing at extreme scale
group('batch transform (extreme)', () => {
  const batch1k = Array.from({ length: 1000 }, (_, i) => ({ id: `node-${i}` }))
  const batch10k = Array.from({ length: 10000 }, (_, i) => ({ id: `node-${i}` }))
  const batch100k = Array.from({ length: 100000 }, (_, i) => ({
    id: `node-${i}`,
  }))

  bench('1k items, 1 hop', async () => {
    for (const item of batch1k) {
      do_not_optimize(await chain200.transform(item, 's0', 's1'))
    }
  })

  bench('10k items, 1 hop', async () => {
    for (const item of batch10k) {
      do_not_optimize(await chain200.transform(item, 's0', 's1'))
    }
  })

  bench('100k items, 1 hop', async () => {
    for (const item of batch100k) {
      do_not_optimize(await chain200.transform(item, 's0', 's1'))
    }
  })

  bench('1k items, 10 hops', async () => {
    for (const item of batch1k) {
      do_not_optimize(await chain200.transform(item, 's0', 's10'))
    }
  })

  bench('10k items, 10 hops', async () => {
    for (const item of batch10k) {
      do_not_optimize(await chain200.transform(item, 's0', 's10'))
    }
  })
})

// validation overhead at scale
group('validation overhead (extreme)', () => {
  bench('100 hops, validate: none', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain200.transform(node, 's0', 's100', { validate: 'none' }))
      },
    }
  })

  bench('100 hops, validate: end', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain200.transform(node, 's0', 's100', { validate: 'end' }))
      },
    }
  })

  bench('100 hops, validate: each', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain200.transform(node, 's0', 's100', { validate: 'each' }))
      },
    }
  })

  bench('500 hops, validate: none', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain500.transform(node, 's0', 's499', { validate: 'none' }))
      },
    }
  })

  bench('500 hops, validate: end', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: SimpleNode) {
        do_not_optimize(await chain500.transform(node, 's0', 's499', { validate: 'end' }))
      },
    }
  })
})

// has/hasMigration with extreme schema counts
group('lookups (extreme scale)', () => {
  bench('has in 200 schema registry', function* () {
    yield {
      0: () => 's100',
      bench(key: string) {
        do_not_optimize(chain200.has(key))
      },
    }
  })

  bench('has in 500 schema registry', function* () {
    yield {
      0: () => 's250',
      bench(key: string) {
        do_not_optimize(chain500.has(key))
      },
    }
  })

  bench('has in 1000 schema registry', function* () {
    yield {
      0: () => 's500',
      bench(key: string) {
        do_not_optimize(chain1000.has(key))
      },
    }
  })

  bench('hasMigration in fully connected 100 (9900 migrations)', function* () {
    yield {
      0: () => ['n50', 'n75'] as const,
      bench(keys: readonly [string, string]) {
        do_not_optimize(fullyConnected100.hasMigration(keys[0], keys[1]))
      },
    }
  })

  bench('hasMigration in lattice 20x10 (3600 migrations)', function* () {
    yield {
      0: () => ['l5_10', 'l6_15'] as const,
      bench(keys: readonly [string, string]) {
        do_not_optimize(lattice20x10.hasMigration(keys[0], keys[1]))
      },
    }
  })
})

// worst case: path that doesn't exist in large graph
group('findPath (no path exists)', () => {
  // create graphs with disconnected components
  const disconnected = (() => {
    const schemas: Record<string, typeof simpleSchema> = {}
    const migrations: Record<string, unknown> = {}

    // component A: nodes 0-99
    for (let i = 0; i < 100; i++) {
      schemas[`a${i}`] = simpleSchema
      if (i > 0) {
        migrations[`a${i - 1}->a${i}`] = (v: SimpleNode) => v
      }
    }

    // component B: nodes 0-99 (disconnected from A)
    for (let i = 0; i < 100; i++) {
      schemas[`b${i}`] = simpleSchema
      if (i > 0) {
        migrations[`b${i - 1}->b${i}`] = (v: SimpleNode) => v
      }
    }

    return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
  })()

  bench('search in disconnected graph (200 nodes, no path)', () => {
    do_not_optimize(disconnected.findPath('a0', 'b99'))
  })

  bench('search backwards in linear chain (no path)', () => {
    do_not_optimize(chain500.findPath('s499', 's0'))
  })
})

// memory stress: create many registries rapidly
group('memory stress', () => {
  bench('create/discard 1000 tiny registries', () => {
    for (let i = 0; i < 1000; i++) {
      do_not_optimize(createLinearChain(3))
    }
  }).gc('inner')

  bench('create/discard 100 medium registries (50 schemas)', () => {
    for (let i = 0; i < 100; i++) {
      do_not_optimize(createLinearChain(50))
    }
  }).gc('inner')

  bench('create/discard 10 large registries (200 schemas)', () => {
    for (let i = 0; i < 10; i++) {
      do_not_optimize(createLinearChain(200))
    }
  }).gc('inner')
})

// concurrent transforms
group('concurrent transforms', () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({ id: `item-${i}` }))

  bench('1000 concurrent transforms (Promise.all)', async () => {
    do_not_optimize(await Promise.all(items.map((item) => chain200.transform(item, 's0', 's10'))))
  }).gc('inner')

  bench('1000 concurrent transforms through fully connected', async () => {
    do_not_optimize(
      await Promise.all(items.map((item) => fullyConnected50.transform(item, 'n0', 'n49'))),
    )
  }).gc('inner')
})

// recursive/tree schema tests
const treeRegistry = createRegistry({
  schemas: {
    treeA: treeSchema,
    treeB: treeSchema,
    treeC: treeSchema,
  },
  migrations: {
    'treeA->treeB': (node) => ({
      ...node,
      id: `${node.id}-transformed`,
      children: node.children.map((child) => ({
        ...child,
        id: `${child.id}-transformed`,
        children: child.children,
      })),
    }),
    'treeB->treeC': (node) => ({
      ...node,
      value: node.value * 2,
      children: node.children.map((child) => ({
        ...child,
        value: child.value * 2,
        children: child.children,
      })),
    }),
  },
})

const smallTree = createTree(3, 2) // 15 nodes
const mediumTree = createTree(5, 3) // 364 nodes
const largeTree = createTree(7, 2) // 255 nodes
const wideTree = createTree(3, 10) // 1111 nodes

group('recursive tree schemas', () => {
  bench('small tree (depth=3, branch=2, 15 nodes)', function* () {
    yield {
      0: () => smallTree,
      async bench(tree: TreeNode) {
        do_not_optimize(await treeRegistry.transform(tree, 'treeA', 'treeC'))
      },
    }
  })

  bench('medium tree (depth=5, branch=3, 364 nodes)', function* () {
    yield {
      0: () => mediumTree,
      async bench(tree: TreeNode) {
        do_not_optimize(await treeRegistry.transform(tree, 'treeA', 'treeC'))
      },
    }
  })

  bench('large tree (depth=7, branch=2, 255 nodes)', function* () {
    yield {
      0: () => largeTree,
      async bench(tree: TreeNode) {
        do_not_optimize(await treeRegistry.transform(tree, 'treeA', 'treeC'))
      },
    }
  })

  bench('wide tree (depth=3, branch=10, 1111 nodes)', function* () {
    yield {
      0: () => wideTree,
      async bench(tree: TreeNode) {
        do_not_optimize(await treeRegistry.transform(tree, 'treeA', 'treeC'))
      },
    }
  })
})

// deeply nested object tests
const nestedRegistry = createRegistry({
  schemas: {
    nestedA: nestedSchema,
    nestedB: nestedSchema,
  },
  migrations: {
    'nestedA->nestedB': (obj) => {
      const transform = (n: DeeplyNested): DeeplyNested => ({
        level: n.level,
        data: n.data.toUpperCase(),
        child: n.child ? transform(n.child) : undefined,
      })
      return transform(obj)
    },
  },
})

const nested10 = createNestedObject(10)
const nested50 = createNestedObject(50)
const nested100 = createNestedObject(100)
const nested500 = createNestedObject(500)

group('deeply nested objects', () => {
  bench('10 levels deep', function* () {
    yield {
      0: () => nested10,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await nestedRegistry.transform(obj, 'nestedA', 'nestedB'))
      },
    }
  })

  bench('50 levels deep', function* () {
    yield {
      0: () => nested50,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await nestedRegistry.transform(obj, 'nestedA', 'nestedB'))
      },
    }
  })

  bench('100 levels deep', function* () {
    yield {
      0: () => nested100,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await nestedRegistry.transform(obj, 'nestedA', 'nestedB'))
      },
    }
  })

  bench('500 levels deep', function* () {
    yield {
      0: () => nested500,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await nestedRegistry.transform(obj, 'nestedA', 'nestedB'))
      },
    }
  })
})

// linked list tests
const listRegistry = createRegistry({
  schemas: {
    listA: listSchema,
    listB: listSchema,
  },
  migrations: {
    'listA->listB': (head) => {
      const transform = (n: ListNode | null): ListNode | null => {
        if (n === null) {
          return null
        }
        return {
          id: `${n.id}-v2`,
          value: n.value * 2,
          next: transform(n.next),
        }
      }
      return transform(head) as ListNode
    },
  },
})

const list100 = createLinkedList(100)
const list1000 = createLinkedList(1000)
const list10000 = createLinkedList(10000)

group('linked list traversal', () => {
  bench('100 nodes', function* () {
    yield {
      0: () => list100,
      async bench(list: ListNode) {
        do_not_optimize(await listRegistry.transform(list, 'listA', 'listB'))
      },
    }
  })

  bench('1000 nodes', function* () {
    yield {
      0: () => list1000,
      async bench(list: ListNode) {
        do_not_optimize(await listRegistry.transform(list, 'listA', 'listB'))
      },
    }
  })

  bench('10000 nodes', function* () {
    yield {
      0: () => list10000,
      async bench(list: ListNode) {
        do_not_optimize(await listRegistry.transform(list, 'listA', 'listB'))
      },
    }
  })
})

// graph node with varying edge counts
const graphRegistry = createRegistry({
  schemas: {
    graphA: graphNodeSchema,
    graphB: graphNodeSchema,
  },
  migrations: {
    'graphA->graphB': (node) => ({
      id: node.id,
      edges: node.edges.map((e) => `${e}-mapped`),
      metadata: {
        ...node.metadata,
        transformed: true,
        timestamp: Date.now(),
      },
    }),
  },
})

const graph10 = createGraphNodeData(10)
const graph100 = createGraphNodeData(100)
const graph1000 = createGraphNodeData(1000)
const graph10000 = createGraphNodeData(10000)

group('graph nodes with many edges', () => {
  bench('10 edges', function* () {
    yield {
      0: () => graph10,
      async bench(node: GraphNode) {
        do_not_optimize(await graphRegistry.transform(node, 'graphA', 'graphB'))
      },
    }
  })

  bench('100 edges', function* () {
    yield {
      0: () => graph100,
      async bench(node: GraphNode) {
        do_not_optimize(await graphRegistry.transform(node, 'graphA', 'graphB'))
      },
    }
  })

  bench('1000 edges', function* () {
    yield {
      0: () => graph1000,
      async bench(node: GraphNode) {
        do_not_optimize(await graphRegistry.transform(node, 'graphA', 'graphB'))
      },
    }
  })

  bench('10000 edges', function* () {
    yield {
      0: () => graph10000,
      async bench(node: GraphNode) {
        do_not_optimize(await graphRegistry.transform(node, 'graphA', 'graphB'))
      },
    }
  })
})

// complex nested transformations with multiple schema hops
const complexNestedRegistry = createRegistry({
  schemas: {
    raw: nestedSchema,
    normalized: nestedSchema,
    enriched: nestedSchema,
    final: nestedSchema,
  },
  migrations: {
    'raw->normalized': (obj) => {
      const normalize = (n: DeeplyNested): DeeplyNested => ({
        level: n.level,
        data: n.data.trim().toLowerCase(),
        child: n.child ? normalize(n.child) : undefined,
      })
      return normalize(obj)
    },
    'normalized->enriched': (obj) => {
      const enrich = (n: DeeplyNested): DeeplyNested => ({
        level: n.level,
        data: `[L${n.level}] ${n.data}`,
        child: n.child ? enrich(n.child) : undefined,
      })
      return enrich(obj)
    },
    'enriched->final': (obj) => {
      const finalize = (n: DeeplyNested): DeeplyNested => ({
        level: n.level,
        data: n.data.replaceAll(/\s+/g, '_'),
        child: n.child ? finalize(n.child) : undefined,
      })
      return finalize(obj)
    },
  },
})

group('complex nested multi-hop transforms', () => {
  bench('50 levels, 3 hops', function* () {
    yield {
      0: () => nested50,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await complexNestedRegistry.transform(obj, 'raw', 'final'))
      },
    }
  })

  bench('100 levels, 3 hops', function* () {
    yield {
      0: () => nested100,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await complexNestedRegistry.transform(obj, 'raw', 'final'))
      },
    }
  })
})

// mixed: batch of recursive structures
group('batch recursive structures', () => {
  const batchTrees = Array.from({ length: 100 }, () => createTree(4, 3))
  const batchLists = Array.from({ length: 100 }, () => createLinkedList(100))

  bench('100 trees (depth=4, branch=3)', async () => {
    for (const tree of batchTrees) {
      do_not_optimize(await treeRegistry.transform(tree, 'treeA', 'treeC'))
    }
  })

  bench('100 linked lists (100 nodes each)', async () => {
    for (const list of batchLists) {
      do_not_optimize(await listRegistry.transform(list, 'listA', 'listB'))
    }
  })
})

// edge case: empty/minimal structures
const emptyTree: TreeNode = { id: 'empty', value: 0, children: [] }
const singleNested: DeeplyNested = { level: 0, data: 'single', child: undefined }
const singleList: ListNode = { id: 'single', value: 1, next: null }

group('edge cases (minimal structures)', () => {
  bench('empty tree (no children)', function* () {
    yield {
      0: () => emptyTree,
      async bench(tree: TreeNode) {
        do_not_optimize(await treeRegistry.transform(tree, 'treeA', 'treeC'))
      },
    }
  })

  bench('single nested (no child)', function* () {
    yield {
      0: () => singleNested,
      async bench(obj: DeeplyNested) {
        do_not_optimize(await nestedRegistry.transform(obj, 'nestedA', 'nestedB'))
      },
    }
  })

  bench('single list node (no next)', function* () {
    yield {
      0: () => singleList,
      async bench(list: ListNode) {
        do_not_optimize(await listRegistry.transform(list, 'listA', 'listB'))
      },
    }
  })
})

await run()
