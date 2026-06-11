/**
 * Regression tests for bugs found during the full review. Each describe
 * block is keyed by the bug ID from the review (H1-H5, B1-B5, T1-T13) and
 * pins down the fixed behavior so the bugs can't be reintroduced silently.
 */
/* oxlint-disable unicorn/no-thenable -- the T11 regression test deliberately constructs a thenable */
import { describe, it, expect, vi } from 'vitest'
import { createRegistry, byField, match, tryParse, type TransformHookInfo } from '../src/index.js'
import { MigrationConflictError, resolveMigrations, DEFAULT_COST } from '../src/migration.js'
import { createMockSchema, userSchemas, sampleDatabaseUser, dynamicMigrations } from './helpers.js'

// ============================================================
// helpers
// ============================================================

/**
 * builds a thenable (NOT a real Promise) that resolves to `value`. used to
 * verify T11: the registry must await thenables returned by migrations, not
 * just values that are `instanceof Promise`.
 */
function makeThenable<T>(value: T): unknown {
  return {
    then(resolve: (v: T) => void): void {
      resolve(value)
    },
  }
}

// ============================================================
// H1/H2/H3/H5 — hook throws must not escape transform
// ============================================================

describe('H1-H5: throwing hooks surface as Result errors, not rejections', () => {
  it('onStep throw does not reject; onTransform still fires', async () => {
    const transformCalls: TransformHookInfo<string>[] = []
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ b: number }>((v) => ({ ok: true, value: v as { b: number } })),
        c: createMockSchema<{ c: number }>((v) => ({ ok: true, value: v as { c: number } })),
      },
      migrations: {
        'a->b': (v: { a: number }) => ({ b: v.a }),
        'b->c': (v: { b: number }) => ({ c: v.b }),
      },
      hooks: {
        onStep: () => {
          throw new Error('step boom')
        },
        onTransform: (info) => transformCalls.push(info),
      },
    })

    // must NOT reject
    const r = await reg.transform({ a: 1 }, 'a', 'c', { validate: 'none' })
    expect(r.ok).toBe(true)
    // onTransform still fired despite onStep throwing
    expect(transformCalls).toHaveLength(1)
    expect(transformCalls[0]?.ok).toBe(true)
  })

  it('onTransform throw does not reject the call', async () => {
    const reg = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.createdAt,
          role: u.role,
        }),
      },
      hooks: {
        onTransform: () => {
          throw new Error('transform boom')
        },
      },
    })

    const r = await reg.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(r.ok).toBe(true)
  })

  it('onWarning throw via deprecated migration does not reject', async () => {
    const reg = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': {
          migrate: (u) => ({
            id: u.id,
            email: u.email,
            createdAt: u.createdAt,
            role: u.role,
          }),
          deprecated: 'old',
        },
      },
      hooks: {
        onWarning: () => {
          throw new Error('warn boom')
        },
      },
    })

    const r = await reg.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(r.ok).toBe(true)
  })

  it('onWarning throw via ctx.warn is absorbed (presented as transform_failed in old code, now absorbed by safeCall)', async () => {
    const reg = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (u, ctx) => {
          ctx.warn('user warning')
          return {
            id: u.id,
            email: u.email,
            createdAt: u.createdAt,
            role: u.role,
          }
        },
      },
      hooks: {
        onWarning: () => {
          throw new Error('ctx warn boom')
        },
      },
    })

    // ctx.warn throwing is absorbed by the safeCall wrapper around the
    // onWarning invocation passed to createTransformContext. the migration
    // still completes successfully.
    const r = await reg.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(r.ok).toBe(true)
  })

  it('debug mode logs swallowed hook errors without rejecting', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const reg = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (u) => ({
          id: u.id,
          email: u.email,
          createdAt: u.createdAt,
          role: u.role,
        }),
      },
      debug: true,
      hooks: {
        onTransform: () => {
          throw new Error('swallowed boom')
        },
      },
    })

    const r = await reg.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(r.ok).toBe(true)
    const logs = spy.mock.calls.map((c) => c[0] as string)
    expect(logs.some((l) => l.includes('swallowed'))).toBe(true)
    spy.mockRestore()
  })
})

// ============================================================
// B1 — explicit path honored when from === to
// ============================================================

describe('B1: explicit path honored when from === to', () => {
  it('routes through the explicit path instead of returning identity', async () => {
    const warnings: string[] = []
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
      },
      migrations: {
        'a->b': (v) => v,
        'b->a': (v) => v,
      },
      hooks: { onWarning: (m) => warnings.push(m) },
    })

    const r = await reg.transform({ a: 1 }, 'a', 'a', {
      path: ['a', 'b', 'a'],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.meta.path).toEqual(['a', 'b', 'a'])
      expect(r.meta.steps).toHaveLength(2)
    }
  })

  it('still returns identity when no explicit path is given', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
      },
      migrations: {},
    })
    const r = await reg.transform({ a: 1 }, 'a', 'a')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.meta.path).toEqual(['a'])
    }
  })
})

// ============================================================
// B2 — validatePath defaults to true
// ============================================================

describe('B2: validatePath defaults to true', () => {
  it('rejects invalid explicit path upfront with no_path_found', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ b: number }>((v) => ({ ok: true, value: v as { b: number } })),
      },
      migrations: { 'a->b': (v: { a: number }) => ({ b: v.a }) },
    })
    const r = await reg.transform({ a: 1 }, 'a', 'b', {
      path: ['a', 'b', 'a', 'b'],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('no_path_found')
    }
  })

  it('can be disabled with validatePath: false', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ b: number }>((v) => ({ ok: true, value: v as { b: number } })),
      },
      migrations: { 'a->b': (v: { a: number }) => ({ b: v.a }) },
    })
    const r = await reg.transform({ a: 1 }, 'a', 'b', {
      path: ['a', 'b', 'a', 'b'],
      validatePath: false,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('transform_failed')
    }
  })
})

// ============================================================
// B4 / I3 — identify() handles throwing schemas and guards
// ============================================================

describe('B4/I3: identify handles throwing inputs as Result errors', () => {
  it('identify function that throws returns err, not rejection', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
      },
      migrations: {},
      identify: () => {
        throw new Error('identify boom')
      },
    })

    const r = await reg.identify({ a: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('identify_failed')
      expect(r.issues[0]?.message).toContain('identify boom')
    }
  })

  it('tryParse schema whose validate throws is treated as no match', async () => {
    const throwingSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'throwing',
        validate: () => {
          throw new Error('schema boom')
        },
      },
    }
    const okSchema = createMockSchema<{ x: number }>((v) => ({
      ok: true,
      value: v as { x: number },
    }))
    const reg = createRegistry({
      schemas: { good: okSchema, bad: throwingSchema },
      migrations: {},
      identify: {
        good: match.field('x'),
        bad: tryParse,
      },
    })

    // must not reject
    const r = await reg.identify({ x: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe('good')
    }
  })

  it('guard map guard that throws is treated as no match', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ b: number }>((v) => ({ ok: true, value: v as { b: number } })),
      },
      migrations: {},
      identify: {
        a: () => {
          throw new Error('guard boom')
        },
        b: match.field('b'),
      },
    })

    const r = await reg.identify({ b: 1 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toBe('b')
    }
  })
})

// ============================================================
// B5 — from===to with validate:'none' returns a shallow copy
// ============================================================

describe('B5: identity transform does not return input by reference', () => {
  it('from===to with validate:none returns a shallow copy', async () => {
    const input = { a: 1 }
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
      },
      migrations: {},
    })
    const r = await reg.transform(input, 'a', 'a', { validate: 'none' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual(input)
      expect(r.value).not.toBe(input)
    }
  })
})

// ============================================================
// T1 — hasMigration false for unknown schemas
// ============================================================

describe('T1: hasMigration rejects unknown schema endpoints', () => {
  it('returns false when from is not a registered schema', () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
      },
      migrations: {},
    })
    // @ts-expect-error testing runtime behavior
    expect(reg.hasMigration('nonexistent', 'a')).toBe(false)
  })

  it('returns false when to is not a registered schema', () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
      },
      migrations: {},
    })
    // @ts-expect-error testing runtime behavior
    expect(reg.hasMigration('a', 'nonexistent')).toBe(false)
  })
})

// ============================================================
// T2 — arrow-bearing migration keys are rejected
// ============================================================

describe('T2: malformed migration keys are rejected with a warning', () => {
  it('rejects "a->b->c" (multiple arrows)', () => {
    const { migrations, warnings } = resolveMigrations({
      'a->b->c': (v: unknown) => v,
    })
    expect(migrations.size).toBe(0)
    expect(warnings.some((w) => w.message.includes('malformed key'))).toBe(true)
  })

  it('rejects reversible keys with extra arrows', () => {
    const { migrations, warnings } = resolveMigrations({
      'a<->b<->c': {
        forward: (v: unknown) => v,
        backward: (v: unknown) => v,
      },
    })
    expect(migrations.size).toBe(0)
    expect(warnings.some((w) => w.message.includes('malformed key'))).toBe(true)
  })
})

// ============================================================
// T3 — validate:'each' validates the input schema
// ============================================================

describe('T3: validate each validates the input schema', () => {
  it('rejects malformed input with validate:each', async () => {
    const aSchema = createMockSchema<{ a: number }>((v) => {
      if (typeof (v as { a?: unknown })?.a !== 'number') {
        return { ok: false, message: 'a must be number' }
      }
      return { ok: true, value: v as { a: number } }
    })
    const bSchema = createMockSchema<{ b: number }>((v) => ({
      ok: true,
      value: v as { b: number },
    }))
    const reg = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        'a->b': (v: { a: number }) => ({ b: v.a }),
      },
    })

    const r = await reg.transform(
      // @ts-expect-error intentionally bad input
      { totallyWrong: true },
      'a',
      'b',
      { validate: 'each' },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('validation_failed')
    }
  })
})

// ============================================================
// T5 — malformed migration defs emit warnings (not silent skips)
// ============================================================

describe('T5: skipped migration definitions emit warnings', () => {
  it('warns when a reversible migration is missing backward', () => {
    const { warnings } = resolveMigrations({
      'a<->b': { forward: (v: unknown) => v },
    })
    expect(warnings.some((w) => w.message.includes('"forward" and "backward"'))).toBe(true)
  })

  it('warns when pipe callback returns non-function', () => {
    const { warnings } = resolveMigrations({
      'a->b': { pipe: () => 'not a function' as unknown },
    })
    expect(warnings.some((w) => w.message.includes('pipe callback must return a function'))).toBe(
      true,
    )
  })

  it('warns when migrate is not a function', () => {
    const { warnings } = resolveMigrations({
      'a->b': { migrate: 'not a function' },
    })
    expect(warnings.some((w) => w.message.includes('"migrate" must be a function'))).toBe(true)
  })
})

// ============================================================
// T6 — MigrationConflictError is a typed error
// ============================================================

describe('T6: MigrationConflictError is typed', () => {
  it('throws a MigrationConflictError with structured fields', () => {
    try {
      resolveMigrations({
        'a<->c': { forward: (v: unknown) => v, backward: (v: unknown) => v },
        'c<->a': { forward: (v: unknown) => v, backward: (v: unknown) => v },
      })
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(MigrationConflictError)
      const err = error as MigrationConflictError
      expect(err.edge).toBe('c->a')
      expect(err.sources).toEqual(['a<->c', 'c<->a'])
      expect(err.name).toBe('MigrationConflictError')
    }
  })
})

// ============================================================
// T8 — cost: NaN/Infinity/negative are rejected
// ============================================================

describe('T8: non-finite or negative costs fall back to default', () => {
  it('NaN cost falls back to DEFAULT_COST', () => {
    const { migrations } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, cost: NaN },
    })
    expect(migrations.get('a->b')?.cost).toBe(DEFAULT_COST)
  })

  it('Infinity cost falls back to DEFAULT_COST', () => {
    const { migrations } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, cost: Infinity },
    })
    expect(migrations.get('a->b')?.cost).toBe(DEFAULT_COST)
  })

  it('negative cost falls back to DEFAULT_COST', () => {
    const { migrations } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, cost: -5 },
    })
    expect(migrations.get('a->b')?.cost).toBe(DEFAULT_COST)
  })

  it('finite non-negative cost is honored', () => {
    const { migrations } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, cost: 0 },
    })
    expect(migrations.get('a->b')?.cost).toBe(0)
  })
})

// ============================================================
// T9 — pipe.add() object/array defaults are cloned per call
// ============================================================

describe('T9: pipe.add() defaults are not shared across transforms', () => {
  it('array default is fresh on each call', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ a: number; list: number[] }>((v) => ({
          ok: true,
          value: v as { a: number; list: number[] },
        })),
      },
      migrations: dynamicMigrations({
        'a->b': {
          pipe: (p: { add: (n: string, v: unknown) => unknown }) => p.add('list', [1, 2, 3]),
        },
      }),
    })

    const r1 = await reg.transform({ a: 1 }, 'a', 'b', { validate: 'none' })
    if (r1.ok) {
      r1.value.list.push(999)
    }
    const r2 = await reg.transform({ a: 2 }, 'a', 'b', { validate: 'none' })
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.value.list).toEqual([1, 2, 3])
    }
  })

  it('object default is fresh on each call', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ a: number; meta: { tag: string } }>((v) => ({
          ok: true,
          value: v as { a: number; meta: { tag: string } },
        })),
      },
      migrations: dynamicMigrations({
        'a->b': {
          pipe: (p: { add: (n: string, v: unknown) => unknown }) => p.add('meta', { tag: 'x' }),
        },
      }),
    })

    const r1 = await reg.transform({ a: 1 }, 'a', 'b', { validate: 'none' })
    if (r1.ok) {
      r1.value.meta.tag = 'MUTATED'
    }
    const r2 = await reg.transform({ a: 2 }, 'a', 'b', { validate: 'none' })
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.value.meta.tag).toBe('x')
    }
  })
})

// ============================================================
// T10 — ctx.defaulted() handles Symbol path entries
// ============================================================

describe('T10: ctx.defaulted() handles Symbol path entries', () => {
  it('does not throw when path contains a Symbol', async () => {
    const sym = Symbol('s')
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ a: number; b: number }>((v) => ({
          ok: true,
          value: v as { a: number; b: number },
        })),
      },
      migrations: {
        'a->b': (v, ctx) => {
          ctx.defaulted([0, sym, 'x'], 'mixed keys')
          return { ...v, b: 1 }
        },
      },
    })

    const r = await reg.transform({ a: 1 }, 'a', 'b', { validate: 'none' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.meta.defaults[0]?.message).toBe('mixed keys')
    }
  })
})

// ============================================================
// T11 — thenable returns are awaited
// ============================================================

describe('T11: thenable returns are awaited', () => {
  it('migration returning a thenable is awaited correctly', async () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ b: number }>((v) => ({ ok: true, value: v as { b: number } })),
      },
      migrations: dynamicMigrations({
        'a->b': () => makeThenable({ b: 42 }),
      }),
    })

    const r = await reg.transform({ a: 1 }, 'a', 'b', { validate: 'none' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({ b: 42 })
    }
  })
})

// ============================================================
// T12 — malformed schema results do not crash or silently succeed
// ============================================================

describe('T12: malformed schema results are rejected', () => {
  it('result with no value or issues is rejected', async () => {
    const malformedSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'malformed',
        validate: () => ({}) as unknown,
      },
    }
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: malformedSchema as never,
      },
      migrations: dynamicMigrations({
        'a->b': (v: { a: number }) => ({ ...v }),
      }),
    })

    const r = await reg.transform({ a: 1 }, 'a', 'b')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('validation_failed')
      expect(r.issues[0]?.message).toContain('malformed')
    }
  })

  it('schema.validate that throws is rejected, not crashed', async () => {
    const throwingSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'throwing',
        validate: () => {
          throw new Error('schema boom')
        },
      },
    }
    const reg = createRegistry({
      schemas: { a: throwingSchema as never },
      migrations: {},
    })

    const r = await reg.validate({ x: 1 }, 'a')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.issues[0]?.code).toBe('validation_failed')
      expect(r.issues[0]?.message).toContain('schema boom')
    }
  })
})

// ============================================================
// T13 — byField rejects non-string field values (covered in identify.test.ts)
// ============================================================

describe('T13: byField rejects non-string values', () => {
  it('returns null for object field value', () => {
    const fn = byField('tag')
    expect(fn({ tag: { x: 1 } })).toBe(null)
  })

  it('returns null for numeric field value', () => {
    const fn = byField('version')
    expect(fn({ version: 1 })).toBe(null)
  })
})

// ============================================================
// A5 — explain accepts pathStrategy override
// ============================================================

describe('A5: explain accepts pathStrategy override', () => {
  it('explain with direct pathStrategy reports no path for indirect routes', () => {
    const reg = createRegistry({
      schemas: {
        a: createMockSchema<{ a: number }>((v) => ({ ok: true, value: v as { a: number } })),
        b: createMockSchema<{ b: number }>((v) => ({ ok: true, value: v as { b: number } })),
        c: createMockSchema<{ c: number }>((v) => ({ ok: true, value: v as { c: number } })),
      },
      migrations: {
        'a->b': (v: { a: number }) => ({ b: v.a }),
        'b->c': (v: { b: number }) => ({ c: v.b }),
      },
    })

    const short = reg.explain('a', 'c')
    expect(short.path).toEqual(['a', 'b', 'c'])

    const direct = reg.explain('a', 'c', { pathStrategy: 'direct' })
    expect(direct.path).toBe(null)
  })
})
