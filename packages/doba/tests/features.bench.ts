/* oxlint-disable no-await-in-loop -- benchmarks measure sequential throughput */
/* oxlint-disable unicorn/numeric-separators-style -- benchmark constants are clearer without separators */
/* oxlint-disable unicorn/consistent-function-scoping -- benchmark helper functions are co-located with their benchmarks */
import { bench, group, run, do_not_optimize } from 'mitata'
import { createRegistry, pipe } from '../src/index.js'
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr } from '../src/result.js'
import {
  userSchemas,
  userMigrations,
  sampleDatabaseUser,
  sampleFrontendUser,
  createMockSchema,
  dynamicMigrations,
  type DatabaseUser,
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

const sampleNode: Node = { id: 'test-1', data: 'payload' }

// ---------- registries ----------

const registry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
})

// registry with hooks
const hookedRegistry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
  hooks: {
    onWarning: () => {},
    onTransform: () => {},
    onStep: () => {},
  },
})

// registry with debug mode
const debugRegistry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
  debug: true,
})

// pipe builder registry
const pipeRegistry = createRegistry({
  schemas: {
    a: createMockSchema<{ id: string; userName: string; legacyId: string; isAdmin: boolean }>(
      (v) => {
        if (v === null || v === undefined || typeof v !== 'object') {
          return { ok: false, message: 'expected object' }
        }
        return {
          ok: true,
          value: v as { id: string; userName: string; legacyId: string; isAdmin: boolean },
        }
      },
    ),
    b: createMockSchema<{ id: string; name: string; email: string; role: string }>((v) => {
      if (v === null || v === undefined || typeof v !== 'object') {
        return { ok: false, message: 'expected object' }
      }
      return { ok: true, value: v as { id: string; name: string; email: string; role: string } }
    }),
  },
  migrations: {
    'a->b': {
      pipe: (p) =>
        p
          .rename('userName', 'name')
          .drop('legacyId')
          .add('email', 'unknown@example.com')
          .map('isAdmin', (v) => (v ? 'admin' : 'user')),
    },
  },
})

// bare function equivalent for comparison
const bareFnRegistry = createRegistry({
  schemas: {
    a: createMockSchema<{ id: string; userName: string; legacyId: string; isAdmin: boolean }>(
      (v) => {
        if (v === null || v === undefined || typeof v !== 'object') {
          return { ok: false, message: 'expected object' }
        }
        return {
          ok: true,
          value: v as { id: string; userName: string; legacyId: string; isAdmin: boolean },
        }
      },
    ),
    b: createMockSchema<{ id: string; name: string; email: string; role: string }>((v) => {
      if (v === null || v === undefined || typeof v !== 'object') {
        return { ok: false, message: 'expected object' }
      }
      return { ok: true, value: v as { id: string; name: string; email: string; role: string } }
    }),
  },
  migrations: {
    'a->b': (v) => ({
      id: v.id,
      name: v.userName,
      email: 'unknown@example.com',
      role: v.isAdmin ? 'admin' : 'user',
    }),
  },
})

const pipeInput = { id: 'u1', userName: 'alice', legacyId: 'old-1', isAdmin: true }

// bidirectional registry
const bidiRegistry = createRegistry({
  schemas: {
    celsius: createMockSchema<{ value: number }>((v) => {
      if (v === null || v === undefined || typeof v !== 'object') {
        return { ok: false, message: 'expected object' }
      }
      return { ok: true, value: v as { value: number } }
    }),
    fahrenheit: createMockSchema<{ value: number }>((v) => {
      if (v === null || v === undefined || typeof v !== 'object') {
        return { ok: false, message: 'expected object' }
      }
      return { ok: true, value: v as { value: number } }
    }),
  },
  migrations: dynamicMigrations({
    'celsius<->fahrenheit': {
      forward: (v: { value: number }) => ({ value: (v.value * 9) / 5 + 32 }),
      backward: (v: { value: number }) => ({ value: ((v.value - 32) * 5) / 9 }),
    },
  }),
})

// weighted graph registry (Dijkstra path)
function createWeightedRegistry() {
  return createRegistry({
    schemas: {
      a: nodeSchema,
      b: nodeSchema,
      c: nodeSchema,
      d: nodeSchema,
      e: nodeSchema,
    },
    migrations: dynamicMigrations({
      'a->b': { migrate: (v: Node) => v, cost: 10 },
      'b->c': { migrate: (v: Node) => v, cost: 1 },
      'c->d': { migrate: (v: Node) => v, cost: 1 },
      'd->e': { migrate: (v: Node) => v, cost: 1 },
      'a->c': { migrate: (v: Node) => v, preferred: true },
      'a->e': { migrate: (v: Node) => v, deprecated: 'use a->c->d->e' },
    }),
  })
}

const weightedRegistry = createWeightedRegistry()

// chain for explicit path benchmarks
function createChain(length: number) {
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

const chain25 = createChain(25)

// registry with context-heavy migrations
const contextRegistry = createRegistry({
  schemas: { a: nodeSchema, b: nodeSchema, c: nodeSchema },
  migrations: dynamicMigrations({
    'a->b': (
      v: Node,
      ctx: { warn: (m: string) => void; defaulted: (p: string[], m: string) => void },
    ) => {
      ctx.warn('step 1 warning')
      ctx.warn('step 1 second warning')
      ctx.defaulted(['extra'], 'added default')
      return v
    },
    'b->c': (
      v: Node,
      ctx: { warn: (m: string) => void; defaulted: (p: string[], m: string) => void },
    ) => {
      ctx.warn('step 2 warning')
      ctx.defaulted(['another'], 'added another default')
      ctx.defaulted(['third'], 'added third default')
      return v
    },
  }),
})

// ---------- benchmarks ----------

group('explain API', () => {
  bench('explain (direct, 1 hop)', () => {
    do_not_optimize(registry.explain('database', 'frontend'))
  })

  bench('explain (multi-hop, 3 hops)', () => {
    do_not_optimize(registry.explain('legacy', 'ai'))
  })

  bench('explain (no path)', () => {
    do_not_optimize(registry.explain('ai', 'database'))
  })

  bench('explain (same schema)', () => {
    do_not_optimize(registry.explain('database', 'database'))
  })

  bench('explain (25 hops)', () => {
    do_not_optimize(chain25.explain('s0', 's24'))
  })

  bench('explain (weighted graph)', () => {
    do_not_optimize(weightedRegistry.explain('a', 'e'))
  })
})

group('validate (standalone)', () => {
  bench('valid value', async () => {
    do_not_optimize(await registry.validate(sampleDatabaseUser, 'database'))
  })

  bench('valid value (frontend schema)', async () => {
    do_not_optimize(await registry.validate(sampleFrontendUser, 'frontend'))
  })

  bench('invalid value', async () => {
    do_not_optimize(await registry.validate({ bad: true }, 'database'))
  })
})

group('pipe builder vs bare function', () => {
  bench('pipe builder (rename + drop + add + map)', function* () {
    yield {
      0: () => ({ ...pipeInput }),
      async bench(v: typeof pipeInput) {
        do_not_optimize(await pipeRegistry.transform(v, 'a', 'b'))
      },
    }
  })

  bench('bare function (equivalent)', function* () {
    yield {
      0: () => ({ ...pipeInput }),
      async bench(v: typeof pipeInput) {
        do_not_optimize(await bareFnRegistry.transform(v, 'a', 'b'))
      },
    }
  })
})

group('hook overhead', () => {
  bench('no hooks', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        do_not_optimize(await registry.transform(user, 'database', 'frontend'))
      },
    }
  })

  bench('all hooks (noop)', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        do_not_optimize(await hookedRegistry.transform(user, 'database', 'frontend'))
      },
    }
  })
})

group('debug mode overhead', () => {
  bench('debug: false', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        do_not_optimize(await registry.transform(user, 'database', 'frontend'))
      },
    }
  })

  bench('debug: true (console hooks)', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        do_not_optimize(await debugRegistry.transform(user, 'database', 'frontend'))
      },
    }
  })
})

group('bidirectional migrations', () => {
  bench('forward (celsius -> fahrenheit)', function* () {
    yield {
      0: () => ({ value: 100 }),
      async bench(v: { value: number }) {
        do_not_optimize(await bidiRegistry.transform(v, 'celsius', 'fahrenheit'))
      },
    }
  })

  bench('backward (fahrenheit -> celsius)', function* () {
    yield {
      0: () => ({ value: 212 }),
      async bench(v: { value: number }) {
        do_not_optimize(await bidiRegistry.transform(v, 'fahrenheit', 'celsius'))
      },
    }
  })
})

group('weighted path resolution (Dijkstra vs BFS)', () => {
  bench('weighted: a->e (prefers a->c->d->e over deprecated)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await weightedRegistry.transform(node, 'a', 'e'))
      },
    }
  })

  bench('weighted: findPath a->e', () => {
    do_not_optimize(weightedRegistry.findPath('a', 'e'))
  })

  bench('weighted: createRegistry (with costs)', () => {
    do_not_optimize(createWeightedRegistry())
  }).gc('inner')
})

group('explicit path vs auto-resolution', () => {
  bench('auto-resolve (25 hops)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain25.transform(node, 's0', 's24'))
      },
    }
  })

  const explicitPath = Array.from({ length: 25 }, (_, i) => `s${i}`) as string[]

  bench('explicit path (25 hops)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await chain25.transform(node, 's0', 's24', { path: explicitPath }))
      },
    }
  })

  bench('explicit path + validatePath (25 hops)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(
          await chain25.transform(node, 's0', 's24', { path: explicitPath, validatePath: true }),
        )
      },
    }
  })
})

group('error paths', () => {
  bench('unknown source schema', async () => {
    do_not_optimize(
      await registry.transform(sampleDatabaseUser, 'nonexistent' as 'database', 'frontend'),
    )
  })

  bench('unknown target schema', async () => {
    do_not_optimize(
      await registry.transform(sampleDatabaseUser, 'database', 'nonexistent' as 'frontend'),
    )
  })

  bench('no path found', async () => {
    do_not_optimize(
      await registry.transform({ id: '1', email: 'a', isAdmin: true }, 'ai', 'database'),
    )
  })

  bench('validation failure', async () => {
    do_not_optimize(
      await registry.transform({ bad: true } as unknown as DatabaseUser, 'database', 'frontend'),
    )
  })
})

group('context operations (warn + defaulted)', () => {
  bench('no context calls', function* () {
    const plainRegistry = createRegistry({
      schemas: { a: nodeSchema, b: nodeSchema },
      migrations: { 'a->b': (v) => v },
    })
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await plainRegistry.transform(node, 'a', 'b'))
      },
    }
  })

  bench('heavy context (2 hops, 3 warns, 3 defaults)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await contextRegistry.transform(node, 'a', 'c'))
      },
    }
  })
})

group('same-schema transform (identity)', () => {
  bench('same schema, validate: end', async () => {
    do_not_optimize(await registry.transform(sampleDatabaseUser, 'database', 'database'))
  })

  bench('same schema, validate: none', async () => {
    do_not_optimize(
      await registry.transform(sampleDatabaseUser, 'database', 'database', { validate: 'none' }),
    )
  })
})

group('result helpers', () => {
  const okResult = ok('value', { path: ['a', 'b'] })
  const errResult = err([{ code: 'test', message: 'fail' }])

  bench('isOk (success)', () => {
    do_not_optimize(isOk(okResult))
  })

  bench('isErr (failure)', () => {
    do_not_optimize(isErr(errResult))
  })

  bench('unwrap (success)', () => {
    do_not_optimize(unwrap(okResult))
  })

  bench('unwrapOr (failure)', () => {
    do_not_optimize(unwrapOr(errResult, 'fallback'))
  })

  bench('map (success)', () => {
    do_not_optimize(map(okResult, (v) => v.toUpperCase()))
  })

  bench('mapErr (failure)', () => {
    do_not_optimize(mapErr(errResult, (issues) => issues.length))
  })

  bench('ok() constructor', () => {
    do_not_optimize(ok('value', { path: ['a'] }))
  })

  bench('err() constructor', () => {
    do_not_optimize(err([{ code: 'test', message: 'fail' }]))
  })
})

group('pipe builder (standalone)', () => {
  const p = pipe<{ id: string; userName: string; legacyId: string; isAdmin: boolean }>()
    .rename('userName', 'name')
    .drop('legacyId')
    .add('email', 'unknown@example.com')
    .map('isAdmin', (v) => (v ? 'admin' : 'user'))

  const mockCtx = {
    from: 'a',
    to: 'b',
    warn: () => {},
    defaulted: () => {},
  }

  bench('pipe execute (4 steps)', function* () {
    yield {
      0: () => ({ ...pipeInput }),
      bench(v: typeof pipeInput) {
        do_not_optimize(p(v, mockCtx as never))
      },
    }
  })

  const single = pipe<{ id: string; name: string }>().rename('name', 'title')

  bench('pipe execute (1 step)', function* () {
    yield {
      0: () => ({ id: '1', name: 'test' }),
      bench(v: { id: string; name: string }) {
        do_not_optimize(single(v, mockCtx as never))
      },
    }
  })

  bench('pipe build (4 steps)', () => {
    do_not_optimize(
      pipe<{ id: string; userName: string; legacyId: string; isAdmin: boolean }>()
        .rename('userName', 'name')
        .drop('legacyId')
        .add('email', 'default')
        .map('isAdmin', (v) => (v ? 'admin' : 'user')),
    )
  })
})

group('deprecated migration overhead', () => {
  const deprecatedRegistry = createRegistry({
    schemas: { a: nodeSchema, b: nodeSchema },
    migrations: dynamicMigrations({
      'a->b': { migrate: (v: Node) => v, deprecated: 'use something else' },
    }),
  })

  const normalRegistry = createRegistry({
    schemas: { a: nodeSchema, b: nodeSchema },
    migrations: { 'a->b': (v) => v },
  })

  bench('normal migration', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await normalRegistry.transform(node, 'a', 'b'))
      },
    }
  })

  bench('deprecated migration (emits warning)', function* () {
    yield {
      0: () => ({ ...sampleNode }),
      async bench(node: Node) {
        do_not_optimize(await deprecatedRegistry.transform(node, 'a', 'b'))
      },
    }
  })
})

await run()
