/* oxlint-disable no-await-in-loop -- benchmarks measure sequential throughput */
/* oxlint-disable unicorn/consistent-function-scoping -- benchmark helper functions are co-located with their benchmarks */
import { bench, group, run, do_not_optimize } from 'mitata'
import { createRegistry, match, tryParse, byField, firstMatch } from '../src/index.js'
import {
  userSchemas,
  userMigrations,
  sampleDatabaseUser,
  sampleFrontendUser,
  sampleAiUser,
  createMockSchema,
  type DatabaseUser,
} from './helpers.js'

// ---------- registries ----------

const guardMapRegistry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
  identify: {
    database: match.field('passwordHash'),
    frontend: match.fields('createdAt', 'role').test((v) => {
      const obj = v as Record<string, unknown>
      return !('passwordHash' in obj) && !('isAdmin' in obj)
    }),
    ai: match.field('isAdmin'),
  },
})

const fnIdentifyRegistry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
  identify: (value: unknown) => {
    if (typeof value !== 'object' || value === null) {
      return null
    }
    if ('passwordHash' in value) {
      return 'database'
    }
    if ('isAdmin' in value) {
      return 'ai'
    }
    if ('createdAt' in value) {
      return 'frontend'
    }
    return null
  },
})

const byFieldRegistry = createRegistry({
  schemas: {
    v1: createMockSchema<{ version: number; data: string }>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['version'] === 'number' && typeof obj['data'] === 'string') {
        return { ok: true, value: v as { version: number; data: string } }
      }
      return { ok: false, message: 'invalid v1' }
    }),
    v2: createMockSchema<{ version: number; data: string; extra: boolean }>((v) => {
      const obj = v as Record<string, unknown>
      if (
        typeof obj['version'] === 'number' &&
        typeof obj['data'] === 'string' &&
        typeof obj['extra'] === 'boolean'
      ) {
        return { ok: true, value: v as { version: number; data: string; extra: boolean } }
      }
      return { ok: false, message: 'invalid v2' }
    }),
  },
  migrations: {
    'v1->v2': (v) => ({ ...v, extra: true }),
  },
  identify: byField('version', { prefix: 'v' }),
})

const tryParseRegistry = createRegistry({
  schemas: {
    cat: createMockSchema<{ name: string; indoor: boolean }>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['name'] === 'string' && typeof obj['indoor'] === 'boolean') {
        return { ok: true, value: v as { name: string; indoor: boolean } }
      }
      return { ok: false, message: 'not a cat' }
    }),
    dog: createMockSchema<{ name: string; breed: string }>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['name'] === 'string' && typeof obj['breed'] === 'string') {
        return { ok: true, value: v as { name: string; breed: string } }
      }
      return { ok: false, message: 'not a dog' }
    }),
  },
  migrations: {},
  identify: { cat: tryParse, dog: tryParse },
})

const firstMatchRegistry = createRegistry({
  schemas: userSchemas,
  migrations: userMigrations,
  identify: firstMatch(byField('_tag'), (v) => {
    if (typeof v !== 'object' || v === null) {
      return null
    }
    if ('passwordHash' in v) {
      return 'database'
    }
    if ('isAdmin' in v) {
      return 'ai'
    }
    return null
  }),
})

// ---------- benchmarks ----------

group('identify (guard map via match)', () => {
  bench('identify database user', async () => {
    do_not_optimize(await guardMapRegistry.identify({ ...sampleDatabaseUser }))
  })

  bench('identify frontend user', async () => {
    do_not_optimize(await guardMapRegistry.identify({ ...sampleFrontendUser }))
  })

  bench('identify ai user', async () => {
    do_not_optimize(await guardMapRegistry.identify({ ...sampleAiUser }))
  })

  bench('identify miss (no match)', async () => {
    do_not_optimize(await guardMapRegistry.identify({ unknown: true }))
  })
})

group('identify (function form)', () => {
  bench('function identify database user', async () => {
    do_not_optimize(await fnIdentifyRegistry.identify({ ...sampleDatabaseUser }))
  })

  bench('function identify ai user', async () => {
    do_not_optimize(await fnIdentifyRegistry.identify({ ...sampleAiUser }))
  })

  bench('function identify miss', async () => {
    do_not_optimize(await fnIdentifyRegistry.identify('not an object'))
  })
})

group('identify (byField)', () => {
  bench('byField with prefix (hit)', async () => {
    do_not_optimize(await byFieldRegistry.identify({ version: '1', data: 'hello' }))
  })

  bench('byField with prefix (miss)', async () => {
    do_not_optimize(await byFieldRegistry.identify({ version: '99', data: 'hello' }))
  })
})

group('identify (tryParse)', () => {
  bench('tryParse single match', async () => {
    do_not_optimize(await tryParseRegistry.identify({ name: 'Rex', breed: 'Labrador' }))
  })

  bench('tryParse no match', async () => {
    do_not_optimize(await tryParseRegistry.identify({ totally: 'different' }))
  })
})

group('identify (firstMatch)', () => {
  bench('firstMatch hit on second fn', async () => {
    do_not_optimize(await firstMatchRegistry.identify({ ...sampleDatabaseUser }))
  })

  bench('firstMatch miss', async () => {
    do_not_optimize(await firstMatchRegistry.identify('no match'))
  })
})

group('identifyAndTransform vs identify + transform', () => {
  bench('identifyAndTransform (1 hop)', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        do_not_optimize(await guardMapRegistry.identifyAndTransform(user, 'frontend'))
      },
    }
  })

  bench('identify then transform (1 hop)', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        const id = await guardMapRegistry.identify(user)
        if (id.ok) {
          do_not_optimize(await guardMapRegistry.transform(user, id.value, 'frontend'))
        }
      },
    }
  })

  bench('identifyAndTransform (2 hops)', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        do_not_optimize(await guardMapRegistry.identifyAndTransform(user, 'ai'))
      },
    }
  })

  bench('identify then transform (2 hops)', function* () {
    yield {
      0: () => ({ ...sampleDatabaseUser }),
      async bench(user: DatabaseUser) {
        const id = await guardMapRegistry.identify(user)
        if (id.ok) {
          do_not_optimize(await guardMapRegistry.transform(user, id.value, 'ai'))
        }
      },
    }
  })

  bench('identifyAndTransform miss', async () => {
    do_not_optimize(await guardMapRegistry.identifyAndTransform({ unknown: true }, 'ai'))
  })
})

group('match chain (standalone)', () => {
  const singleField = match.field('passwordHash')
  const multiField = match.fields('id', 'email', 'createdAt', 'role')
  const chained = match
    .field('id')
    .field('email')
    .type('object')
    .test((v) => (v as Record<string, unknown>)['id'] !== '')

  bench('single field check (hit)', () => {
    do_not_optimize(singleField(sampleDatabaseUser))
  })

  bench('single field check (miss)', () => {
    do_not_optimize(singleField({ noMatch: true }))
  })

  bench('multi field check (hit)', () => {
    do_not_optimize(multiField(sampleFrontendUser))
  })

  bench('multi field check (miss)', () => {
    do_not_optimize(multiField({ id: '1' }))
  })

  bench('chained 4 conditions (hit)', () => {
    do_not_optimize(chained(sampleDatabaseUser))
  })

  bench('chained 4 conditions (miss on first)', () => {
    do_not_optimize(chained('not an object'))
  })

  bench('build match chain (4 steps)', () => {
    do_not_optimize(
      match
        .field('id')
        .field('email')
        .type('object')
        .test(() => true),
    )
  })
})

group('guard map vs function vs byField vs tryParse', () => {
  bench('guard map', async () => {
    do_not_optimize(await guardMapRegistry.identify({ ...sampleDatabaseUser }))
  })

  bench('function form', async () => {
    do_not_optimize(await fnIdentifyRegistry.identify({ ...sampleDatabaseUser }))
  })

  bench('byField', async () => {
    do_not_optimize(await byFieldRegistry.identify({ version: '1', data: 'hello' }))
  })

  bench('tryParse (schema validation)', async () => {
    do_not_optimize(await tryParseRegistry.identify({ name: 'Rex', breed: 'Labrador' }))
  })
})

await run()
