import { describe, it, expect, vi } from 'vitest'
import { createRegistry, type TransformHookInfo, type StepHookInfo } from '../src/index.js'
import {
  userSchemas,
  userMigrations,
  sampleDatabaseUser,
  sampleLegacyUser,
  createMockSchema,
} from './helpers.js'

describe('transform (basic)', () => {
  const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })

  it('transforms between schemas (direct path)', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        id: 'user-123',
        email: 'alice@example.com',
        createdAt: '2024-01-15T10:30:00Z',
        role: 'admin',
      })
      expect(result.meta.path).toEqual(['database', 'frontend'])
      expect(result.meta.steps).toHaveLength(1)
      expect(result.meta.steps[0]).toEqual({ from: 'database', to: 'frontend' })
    }
  })

  it('finds path automatically for multi-step transformation', async () => {
    const result = await registry.transform(sampleLegacyUser, 'legacy', 'ai')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.path).toEqual(['legacy', 'frontend', 'ai'])
      expect(result.meta.steps).toHaveLength(2)
    }
  })

  it('returns same value when from === to', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'database')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(sampleDatabaseUser)
      expect(result.meta.path).toEqual(['database'])
      expect(result.meta.steps).toEqual([])
    }
  })

  it('returns error when no path exists', async () => {
    const result = await registry.transform(
      { id: 'test', email: 'test@test.com', isAdmin: false },
      'ai',
      'database',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('no_path_found')
    }
  })

  it('returns error for unknown from schema', async () => {
    // @ts-expect-error testing runtime behavior
    const result = await registry.transform({}, 'unknown', 'frontend')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('unknown_schema')
      expect(result.issues[0]?.message).toContain('unknown')
    }
  })

  it('returns error for unknown to schema', async () => {
    // @ts-expect-error testing runtime behavior
    const result = await registry.transform(sampleDatabaseUser, 'database', 'unknown')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('unknown_schema')
    }
  })
})

describe('transform (from === to edge cases)', () => {
  it('validates when from === to and validate is not none', async () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: {} })
    const result = await registry.transform(
      // @ts-expect-error intentionally passing invalid data
      { bad: 'data' },
      'database',
      'database',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('validation_failed')
    }
  })

  it('skips validation when from === to and validate: none', async () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: {} })
    const result = await registry.transform(
      // @ts-expect-error intentionally passing invalid data
      { bad: 'data' },
      'database',
      'database',
      {
        validate: 'none',
      },
    )
    expect(result.ok).toBe(true)
  })
})

describe('transform (validation strategies)', () => {
  it('validates at end by default', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        // @ts-expect-error intentionally returning invalid type
        'database->frontend': () => ({ id: 123 }),
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('validation_failed')
    }
  })

  it('skips validation when validate: none', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        // @ts-expect-error intentionally returning invalid type
        'database->frontend': () => ({ id: 123 }),
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend', {
      validate: 'none',
    })
    expect(result.ok).toBe(true)
  })

  it('validates at each step when validate: each', async () => {
    type A = { value: number }
    type B = { value: string }
    type C = { value: boolean }

    const aSchema = createMockSchema<A>((v) => {
      if (typeof (v as A)?.value !== 'number') {
        return { ok: false, message: 'need number' }
      }
      return { ok: true, value: v as A }
    })
    const bSchema = createMockSchema<B>((v) => {
      if (typeof (v as B)?.value !== 'string') {
        return { ok: false, message: 'need string' }
      }
      return { ok: true, value: v as B }
    })
    const cSchema = createMockSchema<C>((v) => {
      if (typeof (v as C)?.value !== 'boolean') {
        return { ok: false, message: 'need boolean' }
      }
      return { ok: true, value: v as C }
    })

    const registry = createRegistry({
      schemas: { a: aSchema, b: bSchema, c: cSchema },
      migrations: {
        // @ts-expect-error returns wrong type for b
        'a->b': () => ({ value: 42 }),
        'b->c': () => ({ value: true }),
      },
    })

    const result = await registry.transform({ value: 1 }, 'a', 'c', { validate: 'each' })
    expect(result.ok).toBe(false)
  })
})

describe('transform (path options)', () => {
  const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })

  it('uses explicit path', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['database', 'frontend', 'ai'],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.path).toEqual(['database', 'frontend', 'ai'])
    }
  })

  it('errors if explicit path starts wrong', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['frontend', 'ai'],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('invalid_input')
    }
  })

  it('errors if explicit path ends wrong', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['database', 'frontend'],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('invalid_input')
    }
  })

  it('validates path upfront with validatePath: true', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['database', 'legacy', 'ai'],
      validatePath: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('no_path_found')
      expect(result.issues[0]?.message).toContain('database->legacy')
    }
  })

  it('fails at runtime without validatePath for invalid explicit path', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['database', 'legacy', 'ai'],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('transform_failed')
      expect(result.issues[0]?.message).toContain('missing migration')
    }
  })

  it('overrides pathStrategy per-call', async () => {
    const result = await registry.transform(sampleLegacyUser, 'legacy', 'ai', {
      pathStrategy: 'direct',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('no_path_found')
      expect(result.issues[0]?.message).toContain('direct')
    }
  })
})

describe('transform (error handling)', () => {
  it('catches sync errors', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': () => {
          throw new Error('sync boom')
        },
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('transform_failed')
      expect(result.issues[0]?.message).toContain('sync boom')
    }
  })

  it('catches async errors', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        // oxlint-disable-next-line require-await -- async required to match migration function signature
        'database->frontend': async () => {
          throw new Error('async boom')
        },
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('async boom')
    }
  })

  it('handles non-Error throws', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': () => {
          throw new Error('string error')
        },
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('string error')
    }
  })
})

describe('transform (async migrations)', () => {
  it('handles async migration functions', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': async (user) => {
          // oxlint-disable-next-line no-promise-executor-return -- intentional delay for async test
          await new Promise((resolve) => setTimeout(resolve, 5))
          return { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role }
        },
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.id).toBe('user-123')
    }
  })

  it('handles async object-form migration', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': {
          migrate: async (user) => {
            // oxlint-disable-next-line no-promise-executor-return -- intentional delay for async test
            await new Promise((resolve) => setTimeout(resolve, 5))
            return { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role }
          },
          label: 'async-strip',
        },
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.steps[0]?.label).toBe('async-strip')
    }
  })
})

describe('transform (context)', () => {
  it('collects warnings across multi-step path', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (user, ctx) => {
          ctx.warn('step 1 warning')
          return { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role }
        },
        'frontend->ai': (user, ctx) => {
          ctx.warn('step 2 warning')
          return { id: user.id, email: user.email, isAdmin: user.role === 'admin' }
        },
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['database', 'frontend', 'ai'],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.warnings).toHaveLength(2)
      expect(result.meta.warnings[0]?.from).toBe('database')
      expect(result.meta.warnings[1]?.from).toBe('frontend')
    }
  })

  it('calls onWarning hook for each warning', async () => {
    const hookCalls: string[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (user, ctx) => {
          ctx.warn('w1')
          ctx.defaulted(['x'], 'd1')
          return { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role }
        },
      },
      hooks: { onWarning: (msg) => hookCalls.push(msg) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(hookCalls).toEqual(['w1', 'defaulted x: d1'])
  })
})

describe('transform (enriched error messages)', () => {
  it('includes reachable schemas in no_path_found error', async () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })
    const result = await registry.transform(
      { id: 'test', email: 'test@test.com', isAdmin: false },
      'ai',
      'database',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const [issue] = result.issues
      expect(issue?.code).toBe('no_path_found')
      expect(issue?.message).toContain('"ai" has no outgoing migrations')
      expect(issue?.message).toContain('no schema has a migration path to "database"')
    }
  })

  it('includes meta with reachability arrays', async () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })
    const result = await registry.transform(
      { id: 'test', email: 'test@test.com', isAdmin: false },
      'ai',
      'database',
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const meta = result.issues[0]?.meta as
        | { reachableFromSource: string[]; reachableToTarget: string[] }
        | undefined
      expect(meta).toBeDefined()
      expect(Array.isArray(meta?.reachableFromSource)).toBe(true)
      expect(Array.isArray(meta?.reachableToTarget)).toBe(true)
    }
  })

  it('shows reachable targets when path is missing', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': userMigrations['database->frontend'],
      },
    })
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const [issue] = result.issues
      expect(issue?.message).toContain('schemas reachable from "database": frontend')
    }
  })
})

describe('transform (onTransform hook)', () => {
  it('calls onTransform on success', async () => {
    const calls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onTransform: (info) => calls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.from).toBe('database')
    expect(calls[0]?.to).toBe('frontend')
    expect(calls[0]?.ok).toBe(true)
    expect(calls[0]?.durationMs).toBeGreaterThanOrEqual(0)
    expect(calls[0]?.path).toEqual(['database', 'frontend'])
  })

  it('calls onTransform on failure', async () => {
    const calls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onTransform: (info) => calls.push(info) },
    })

    await registry.transform(
      { id: 'test', email: 'test@test.com', isAdmin: false },
      'ai',
      'database',
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ok).toBe(false)
  })

  it('calls onTransform for from === to', async () => {
    const calls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onTransform: (info) => calls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'database')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ok).toBe(true)
    expect(calls[0]?.path).toEqual(['database'])
  })

  it('calls onTransform for unknown schema errors', async () => {
    const calls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onTransform: (info) => calls.push(info) },
    })

    // @ts-expect-error testing runtime behavior
    await registry.transform({}, 'unknown', 'frontend')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ok).toBe(false)
    expect(calls[0]?.path).toBe(null)
  })
})

describe('transform (onStep hook)', () => {
  it('calls onStep for each migration step', async () => {
    const calls: StepHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onStep: (info) => calls.push(info) },
    })

    await registry.transform(sampleLegacyUser, 'legacy', 'ai')
    expect(calls).toHaveLength(2)
    expect(calls[0]?.from).toBe('legacy')
    expect(calls[0]?.to).toBe('frontend')
    expect(calls[0]?.index).toBe(0)
    expect(calls[0]?.total).toBe(2)
    expect(calls[0]?.ok).toBe(true)
    expect(calls[1]?.from).toBe('frontend')
    expect(calls[1]?.to).toBe('ai')
    expect(calls[1]?.index).toBe(1)
    expect(calls[1]?.total).toBe(2)
    expect(calls[1]?.ok).toBe(true)
  })

  it('calls onStep with ok: false when step throws', async () => {
    const calls: StepHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': () => {
          throw new Error('boom')
        },
      },
      hooks: { onStep: (info) => calls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ok).toBe(false)
    expect(calls[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('includes label in step hook info', async () => {
    const calls: StepHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': {
          migrate: (user) => ({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            role: user.role,
          }),
          label: 'strip-sensitive',
        },
      },
      hooks: { onStep: (info) => calls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(calls[0]?.label).toBe('strip-sensitive')
  })

  it('does not call onStep for from === to', async () => {
    const calls: StepHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onStep: (info) => calls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'database')
    expect(calls).toHaveLength(0)
  })
})

describe('transform (validate: each with successful intermediate)', () => {
  it('passes intermediate validation and completes', async () => {
    type A = { value: number }
    type B = { value: string }
    type C = { value: boolean }

    const aSchema = createMockSchema<A>((v) => {
      if (typeof (v as A)?.value !== 'number') {
        return { ok: false, message: 'need number' }
      }
      return { ok: true, value: v as A }
    })
    const bSchema = createMockSchema<B>((v) => {
      if (typeof (v as B)?.value !== 'string') {
        return { ok: false, message: 'need string' }
      }
      return { ok: true, value: v as B }
    })
    const cSchema = createMockSchema<C>((v) => {
      if (typeof (v as C)?.value !== 'boolean') {
        return { ok: false, message: 'need boolean' }
      }
      return { ok: true, value: v as C }
    })

    const registry = createRegistry({
      schemas: { a: aSchema, b: bSchema, c: cSchema },
      migrations: {
        'a->b': (v) => ({ value: String(v.value) }),
        'b->c': (v) => ({ value: v.value === 'true' }),
      },
    })

    const result = await registry.transform({ value: 1 }, 'a', 'c', { validate: 'each' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ value: false })
      expect(result.meta.path).toEqual(['a', 'b', 'c'])
    }
  })

  it('validate: each catches error at final step', async () => {
    type A = { value: number }
    type B = { value: string }

    const aSchema = createMockSchema<A>((v) => ({ ok: true, value: v as A }))
    const bSchema = createMockSchema<B>((v) => {
      if (typeof (v as B)?.value !== 'string') {
        return { ok: false, message: 'need string' }
      }
      return { ok: true, value: v as B }
    })

    const registry = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        // @ts-expect-error intentionally returning wrong type
        'a->b': (v) => ({ value: v.value }),
      },
    })

    const result = await registry.transform({ value: 42 }, 'a', 'b', { validate: 'each' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('validation_failed')
    }
  })
})

describe('transform (hooks interaction)', () => {
  it('onTransform includes path on validation failure at end', async () => {
    const calls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        // @ts-expect-error intentionally returning invalid type
        'database->frontend': () => ({ bad: 'data' }),
      },
      hooks: { onTransform: (info) => calls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ok).toBe(false)
    expect(calls[0]?.path).toEqual(['database', 'frontend'])
  })

  it('onStep and onTransform both fire on multi-step success', async () => {
    const stepCalls: StepHookInfo<string>[] = []
    const transformCalls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: {
        onStep: (info) => stepCalls.push(info),
        onTransform: (info) => transformCalls.push(info),
      },
    })

    await registry.transform(sampleLegacyUser, 'legacy', 'ai')
    expect(stepCalls).toHaveLength(2)
    expect(stepCalls.every((s) => s.ok)).toBe(true)
    expect(transformCalls).toHaveLength(1)
    expect(transformCalls[0]?.ok).toBe(true)
  })

  it('onStep fires for completed steps before a failing step', async () => {
    const stepCalls: StepHookInfo<string>[] = []
    type A = { v: number }
    const s = createMockSchema<A>((v) => ({ ok: true, value: v as A }))

    const registry = createRegistry({
      schemas: { a: s, b: s, c: s },
      migrations: {
        'a->b': (v) => v,
        'b->c': () => {
          throw new Error('step 2 fails')
        },
      },
      hooks: { onStep: (info) => stepCalls.push(info) },
    })

    await registry.transform({ v: 1 }, 'a', 'c', { validate: 'none' })
    expect(stepCalls).toHaveLength(2)
    expect(stepCalls[0]?.ok).toBe(true)
    expect(stepCalls[0]?.from).toBe('a')
    expect(stepCalls[1]?.ok).toBe(false)
    expect(stepCalls[1]?.from).toBe('b')
  })

  it('onTransform fires for explicit path with missing migration', async () => {
    const calls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      hooks: { onTransform: (info) => calls.push(info) },
    })

    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai', {
      path: ['database', 'legacy', 'ai'],
    })
    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.ok).toBe(false)
  })
})

describe('transform (deprecated migrations)', () => {
  it('collects deprecation warnings in meta', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': {
          migrate: (user) => ({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            role: user.role,
          }),
          deprecated: 'use v2 path instead',
        },
      },
    })

    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.warnings).toHaveLength(1)
      expect(result.meta.warnings[0]?.message).toContain('deprecated')
      expect(result.meta.warnings[0]?.message).toContain('use v2 path instead')
      expect(result.meta.steps[0]?.deprecated).toBe('use v2 path instead')
    }
  })

  it('deprecated: true adds generic warning', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': {
          migrate: (user) => ({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            role: user.role,
          }),
          deprecated: true,
        },
      },
    })

    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.warnings).toHaveLength(1)
      expect(result.meta.warnings[0]?.message).toContain('deprecated')
      expect(result.meta.warnings[0]?.message).not.toContain(':')
    }
  })
})

describe('transform (pathStrategy: direct)', () => {
  it('succeeds with direct migration', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      pathStrategy: 'direct',
    })

    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.path).toEqual(['database', 'frontend'])
    }
  })

  it('fails when no direct migration exists (registry-level)', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      pathStrategy: 'direct',
    })

    const result = await registry.transform(sampleLegacyUser, 'legacy', 'ai')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('no_path_found')
      expect(result.issues[0]?.message).toContain('direct')
    }
  })
})

describe('transform (debug mode)', () => {
  it('logs to console when debug: true', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      debug: true,
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')

    const logs = spy.mock.calls.map((c) => c[0] as string)
    expect(logs.some((l) => l.includes('[doba]') && l.includes('step'))).toBe(true)
    expect(logs.some((l) => l.includes('[doba] transform'))).toBe(true)
    spy.mockRestore()
  })

  it('fires user hooks alongside debug logging', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const userCalls: TransformHookInfo<string>[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      debug: true,
      hooks: { onTransform: (info) => userCalls.push(info) },
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')

    expect(userCalls).toHaveLength(1)
    expect(userCalls[0]?.ok).toBe(true)
    const logs = spy.mock.calls.map((c) => c[0] as string)
    expect(logs.some((l) => l.includes('[doba] transform'))).toBe(true)
    spy.mockRestore()
  })

  it('logs warnings in debug mode', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (user, ctx) => {
          ctx.warn('test warning')
          return { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role }
        },
      },
      debug: true,
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')

    const logs = spy.mock.calls.map((c) => c[0] as string)
    expect(logs.some((l) => l.includes('[doba] warn') && l.includes('test warning'))).toBe(true)
    spy.mockRestore()
  })

  it('does not log when debug is false or omitted', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
    })

    await registry.transform(sampleDatabaseUser, 'database', 'frontend')

    const logs = spy.mock.calls.map((c) => c[0] as string)
    expect(logs.some((l) => typeof l === 'string' && l.includes('[doba]'))).toBe(false)
    spy.mockRestore()
  })
})
