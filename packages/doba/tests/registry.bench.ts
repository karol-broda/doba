/* oxlint-disable no-await-in-loop -- benchmarks measure sequential transform throughput */
/* oxlint-disable unicorn/numeric-separators-style -- benchmark constants are clearer without separators */
/* oxlint-disable unicorn/consistent-function-scoping -- benchmark helper functions are co-located with their benchmarks */
import { bench, group, run, do_not_optimize } from 'mitata'
import { createRegistry } from '../src/index.js'
import {
  userSchemas,
  userMigrations,
  sampleDatabaseUser,
  sampleLegacyUser,
  createMockSchema,
  dynamicMigrations,
} from './helpers.js'

type Node = { id: string; data: string }

const nodeSchema = createMockSchema<Node>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  const rec = value as Record<string, unknown>
  if (typeof rec['id'] !== 'string') {
    return { ok: false, message: 'id must be string' }
  }
  if (typeof rec['data'] !== 'string') {
    return { ok: false, message: 'data must be string' }
  }
  return { ok: true, value: value as Node }
})

function createLinearChain(length: number) {
  const schemas: Record<string, typeof nodeSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let i = 0; i < length; i++) {
    schemas[`s${i}`] = nodeSchema
  }

  for (let i = 0; i < length - 1; i++) {
    migrations[`s${i}->s${i + 1}`] = (v: Node) => ({ id: v.id, data: `${v.data}.` })
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

function createWideGraph(width: number, depth: number) {
  const schemas: Record<string, typeof nodeSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let d = 0; d < depth; d++) {
    for (let w = 0; w < width; w++) {
      schemas[`s${d}_${w}`] = nodeSchema
    }
  }

  for (let d = 0; d < depth - 1; d++) {
    for (let w = 0; w < width; w++) {
      for (let nw = 0; nw < width; nw++) {
        migrations[`s${d}_${w}->s${d + 1}_${nw}`] = (v: Node) => ({
          id: v.id,
          data: `${v.data}.`,
        })
      }
    }
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

function createManySchemas(count: number) {
  const schemas: Record<string, typeof nodeSchema> = {}
  const migrations: Record<string, unknown> = {}

  for (let i = 0; i < count; i++) {
    schemas[`schema${i}`] = nodeSchema
  }

  for (let i = 0; i < count - 1; i++) {
    migrations[`schema${i}->schema${i + 1}`] = (v: Node) => v
  }

  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

const registry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
})

const directOnlyRegistry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
  pathStrategy: 'direct',
})

const chain10 = createLinearChain(10)
const chain25 = createLinearChain(25)
const chain50 = createLinearChain(50)
const chain100 = createLinearChain(100)

const wide5x5 = createWideGraph(5, 5)
const wide10x5 = createWideGraph(10, 5)

const schemas50 = createManySchemas(50)
const schemas100 = createManySchemas(100)
const schemas500 = createManySchemas(500)

const sampleNode: Node = { id: 'test-1', data: 'payload' }

const batchSmall = Array.from({ length: 100 }, (_, i) => ({
  ...sampleDatabaseUser,
  id: `user-${i}`,
}))

const batchMedium = Array.from({ length: 1000 }, (_, i) => ({
  ...sampleDatabaseUser,
  id: `user-${i}`,
}))

const batchLarge = Array.from({ length: 10000 }, (_, i) => ({
  ...sampleDatabaseUser,
  id: `user-${i}`,
}))

group('baseline', () => {
  bench('noop', () => {})

  bench('object spread', function* () {
    yield {
      0: () => sampleNode,
      bench(node: Node) {
        do_not_optimize({ ...node, data: `${node.data}.` })
      },
    }
  })

  bench('function call overhead', function* () {
    const fn = (v: Node) => v
    yield {
      0: () => sampleNode,
      bench(node: Node) {
        do_not_optimize(fn(node))
      },
    }
  })
})

group('createRegistry scaling', () => {
  bench('4 schemas (baseline)', () => {
    do_not_optimize(createRegistry({ schemas: userSchemas, migrations: userMigrations }))
  }).gc('inner')

  bench('10 schemas linear', () => {
    do_not_optimize(createLinearChain(10))
  }).gc('inner')

  bench('25 schemas linear', () => {
    do_not_optimize(createLinearChain(25))
  }).gc('inner')

  bench('50 schemas linear', () => {
    do_not_optimize(createLinearChain(50))
  }).gc('inner')

  bench('100 schemas linear', () => {
    do_not_optimize(createLinearChain(100))
  }).gc('inner')
})

group('findPath scaling (linear chains)', () => {
  bench('10 nodes, 9 hops', () => {
    do_not_optimize(chain10.findPath('s0', 's9'))
  })

  bench('25 nodes, 24 hops', () => {
    do_not_optimize(chain25.findPath('s0', 's24'))
  })

  bench('50 nodes, 49 hops', () => {
    do_not_optimize(chain50.findPath('s0', 's49'))
  })

  bench('100 nodes, 99 hops', () => {
    do_not_optimize(chain100.findPath('s0', 's99'))
  })
})

group('findPath scaling (wide graphs)', () => {
  bench('5x5 graph (25 schemas, 100 migrations)', () => {
    do_not_optimize(wide5x5.findPath('s0_0', 's4_4'))
  })

  bench('10x5 graph (50 schemas, 400 migrations)', () => {
    do_not_optimize(wide10x5.findPath('s0_0', 's4_9'))
  })
})

group('transform scaling (chain depth)', () => {
  bench('1 hop', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain10.transform(node, 's0', 's1'))
      },
    }
  })

  bench('5 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain10.transform(node, 's0', 's5'))
      },
    }
  })

  bench('10 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain25.transform(node, 's0', 's10'))
      },
    }
  })

  bench('25 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain50.transform(node, 's0', 's25'))
      },
    }
  })

  bench('50 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain100.transform(node, 's0', 's50'))
      },
    }
  })

  bench('99 hops', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain100.transform(node, 's0', 's99'))
      },
    }
  })
})

group('validation overhead', () => {
  bench('validate: end (default)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain25.transform(node, 's0', 's24'))
      },
    }
  })

  bench('validate: none', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain25.transform(node, 's0', 's24', { validate: 'none' }))
      },
    }
  })

  bench('validate: each (24 validations)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain25.transform(node, 's0', 's24', { validate: 'each' }))
      },
    }
  })
})

group('batch transform (100 items)', () => {
  bench('sequential', async () => {
    for (const item of batchSmall) {
      do_not_optimize(await registry.transform(item, 'database', 'frontend'))
    }
  })

  bench('Promise.all', async () => {
    do_not_optimize(
      await Promise.all(batchSmall.map((item) => registry.transform(item, 'database', 'frontend'))),
    )
  }).gc('inner')
})

group('batch transform (1000 items)', () => {
  bench('sequential', async () => {
    for (const item of batchMedium) {
      do_not_optimize(await registry.transform(item, 'database', 'frontend'))
    }
  })

  bench('Promise.all', async () => {
    do_not_optimize(
      await Promise.all(
        batchMedium.map((item) => registry.transform(item, 'database', 'frontend')),
      ),
    )
  }).gc('inner')
})

group('batch transform (10000 items)', () => {
  bench('sequential', async () => {
    for (const item of batchLarge) {
      do_not_optimize(await registry.transform(item, 'database', 'frontend'))
    }
  })

  bench('Promise.all', async () => {
    do_not_optimize(
      await Promise.all(batchLarge.map((item) => registry.transform(item, 'database', 'frontend'))),
    )
  }).gc('inner')
})

group('has/hasMigration with many schemas', () => {
  bench('has (50 schemas)', function* () {
    yield {
      0: () => 'schema25',
      bench(key: string) {
        do_not_optimize(schemas50.has(key))
      },
    }
  })

  bench('has (100 schemas)', function* () {
    yield {
      0: () => 'schema50',
      bench(key: string) {
        do_not_optimize(schemas100.has(key))
      },
    }
  })

  bench('has (500 schemas)', function* () {
    yield {
      0: () => 'schema250',
      bench(key: string) {
        do_not_optimize(schemas500.has(key))
      },
    }
  })

  bench('hasMigration (50 schemas)', function* () {
    yield {
      0: () => ['schema0', 'schema1'] as const,
      bench(keys: readonly [string, string]) {
        do_not_optimize(schemas50.hasMigration(keys[0], keys[1]))
      },
    }
  })

  bench('hasMigration (100 schemas)', function* () {
    yield {
      0: () => ['schema0', 'schema1'] as const,
      bench(keys: readonly [string, string]) {
        do_not_optimize(schemas100.hasMigration(keys[0], keys[1]))
      },
    }
  })

  bench('hasMigration (500 schemas)', function* () {
    yield {
      0: () => ['schema0', 'schema1'] as const,
      bench(keys: readonly [string, string]) {
        do_not_optimize(schemas500.hasMigration(keys[0], keys[1]))
      },
    }
  })
})

group('pathStrategy', () => {
  bench('shortest finds path', function* () {
    yield {
      0: () => ({ ...sampleLegacyUser }),
      async bench(user: typeof sampleLegacyUser) {
        do_not_optimize(await registry.transform(user, 'legacy', 'ai'))
      },
    }
  })

  bench('direct no path (fails fast)', function* () {
    yield {
      0: () => ({ ...sampleLegacyUser }),
      async bench(user: typeof sampleLegacyUser) {
        do_not_optimize(await directOnlyRegistry.transform(user, 'legacy', 'ai'))
      },
    }
  })

  bench('direct succeeds', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: typeof sampleDatabaseUser) {
        do_not_optimize(await directOnlyRegistry.transform(user, 'database', 'frontend'))
      },
    }
  })
})

group('memory pressure', () => {
  bench('create/discard 100 small registries', () => {
    for (let i = 0; i < 100; i++) {
      do_not_optimize(createRegistry({ schemas: userSchemas, migrations: userMigrations }))
    }
  }).gc('inner')

  bench('create/discard 10 medium registries (25 schemas)', () => {
    for (let i = 0; i < 10; i++) {
      do_not_optimize(createLinearChain(25))
    }
  }).gc('inner')
})

group('migration function complexity', () => {
  const simpleRegistry = createRegistry({
    schemas: { a: nodeSchema, b: nodeSchema },
    migrations: {
      'a->b': (v) => v,
    },
  })

  const complexRegistry = createRegistry({
    schemas: { a: nodeSchema, b: nodeSchema },
    migrations: {
      'a->b': (v) => {
        const parts = v.data.split('.')
        const processed = parts.map((p) => p.toUpperCase()).join('-')
        return {
          id: `${v.id}-transformed-${Date.now()}`,
          data: `${processed}-${Math.random().toString(36).slice(2)}`,
        }
      },
    },
  })

  bench('simple passthrough migration', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await simpleRegistry.transform(node, 'a', 'b'))
      },
    }
  })

  bench('complex migration (string ops, Date, Math.random)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await complexRegistry.transform(node, 'a', 'b'))
      },
    }
  })
})

await run()
