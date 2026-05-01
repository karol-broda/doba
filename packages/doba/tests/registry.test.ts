import { describe, it, expect } from 'vitest'
import { createRegistry } from '../src/index.js'
import { DEPRECATED_COST } from '../src/migration.js'
import { userSchemas, userMigrations, createMockSchema } from './helpers.js'

describe('createRegistry', () => {
  it('exposes schemas', () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })
    expect(registry.schemas).toBe(userSchemas)
  })

  it('has returns true for known schemas', () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })
    expect(registry.has('database')).toBe(true)
    expect(registry.has('frontend')).toBe(true)
    expect(registry.has('ai')).toBe(true)
    expect(registry.has('legacy')).toBe(true)
  })

  it('has returns false for unknown schemas', () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })
    expect(registry.has('unknown')).toBe(false)
    expect(registry.has('')).toBe(false)
  })

  it('hasMigration checks direct migrations', () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })
    expect(registry.hasMigration('database', 'frontend')).toBe(true)
    expect(registry.hasMigration('database', 'ai')).toBe(true)
    expect(registry.hasMigration('frontend', 'database')).toBe(false)
    expect(registry.hasMigration('ai', 'frontend')).toBe(false)
  })

  it('works with empty migrations', () => {
    const registry = createRegistry({ schemas: userSchemas, migrations: {} })
    expect(registry.has('database')).toBe(true)
    expect(registry.hasMigration('database', 'frontend')).toBe(false)
    expect(registry.findPath('database', 'frontend')).toBe(null)
  })

  it('works with single schema and no migrations', () => {
    type V = { val: number }
    const schema = createMockSchema<V>((v) => ({ ok: true, value: v as V }))
    const registry = createRegistry({ schemas: { only: schema }, migrations: {} })
    expect(registry.has('only')).toBe(true)
    expect(registry.findPath('only', 'only')).toEqual(['only'])
  })
})

describe('findPath', () => {
  const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })

  it('finds direct path', () => {
    expect(registry.findPath('database', 'frontend')).toEqual(['database', 'frontend'])
  })

  it('finds multi-step path', () => {
    expect(registry.findPath('legacy', 'ai')).toEqual(['legacy', 'frontend', 'ai'])
  })

  it('returns [from] when from === to', () => {
    expect(registry.findPath('database', 'database')).toEqual(['database'])
  })

  it('returns null when no path exists', () => {
    expect(registry.findPath('ai', 'database')).toBe(null)
  })

  it('returns null for unknown from', () => {
    // @ts-expect-error testing runtime behavior
    expect(registry.findPath('unknown', 'frontend')).toBe(null)
  })

  it('returns null for unknown to', () => {
    // @ts-expect-error testing runtime behavior
    expect(registry.findPath('database', 'unknown')).toBe(null)
  })
})

describe('explain', () => {
  const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })

  it('explains a direct migration path', () => {
    const result = registry.explain('database', 'frontend')
    expect(result.path).toEqual(['database', 'frontend'])
    expect(result.totalCost).toBe(1)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]?.from).toBe('database')
    expect(result.steps[0]?.to).toBe('frontend')
    expect(result.steps[0]?.cost).toBe(1)
    expect(result.summary).toContain('database -> frontend')
    expect(result.summary).toContain('1 step')
  })

  it('explains a multi-step path', () => {
    const result = registry.explain('legacy', 'ai')
    expect(result.path).toEqual(['legacy', 'frontend', 'ai'])
    expect(result.totalCost).toBe(2)
    expect(result.steps).toHaveLength(2)
    expect(result.summary).toContain('2 steps')
  })

  it('returns helpful info when no path exists', () => {
    const result = registry.explain('ai', 'database')
    expect(result.path).toBe(null)
    expect(result.totalCost).toBe(null)
    expect(result.steps).toEqual([])
    expect(result.summary).toContain('No migration path')
    expect(result.summary).toContain('No schema has a path to "database"')
  })

  it('returns trivial result for from === to', () => {
    const result = registry.explain('database', 'database')
    expect(result.path).toEqual(['database'])
    expect(result.totalCost).toBe(0)
    expect(result.steps).toEqual([])
    expect(result.summary).toContain('already the target schema')
  })

  it('includes deprecation info', () => {
    type A = { v: number }
    type B = { v: string }
    const aSchema = createMockSchema<A>((v) => ({ ok: true, value: v as A }))
    const bSchema = createMockSchema<B>((v) => ({ ok: true, value: v as B }))

    const reg = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        'a->b': {
          migrate: (v) => ({ v: String(v.v) }),
          deprecated: 'use v2 path',
        },
      },
    })

    const result = reg.explain('a', 'b')
    expect(result.steps[0]?.deprecated).toBe('use v2 path')
    expect(result.summary).toContain('DEPRECATED: use v2 path')
  })

  it('includes labels', () => {
    type A = { v: number }
    type B = { v: string }
    const aSchema = createMockSchema<A>((v) => ({ ok: true, value: v as A }))
    const bSchema = createMockSchema<B>((v) => ({ ok: true, value: v as B }))

    const reg = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        'a->b': {
          migrate: (v) => ({ v: String(v.v) }),
          label: 'stringify value',
        },
      },
    })

    const result = reg.explain('a', 'b')
    expect(result.steps[0]?.label).toBe('stringify value')
    expect(result.summary).toContain('[stringify value]')
  })

  it('includes reachable schemas when path not found', () => {
    const result = registry.explain('database', 'legacy')
    expect(result.path).toBe(null)
    expect(result.summary).toContain('Reachable from "database"')
    expect(result.summary).toContain('No schema has a path to "legacy"')
  })

  it('shows deprecated: true in steps and summary', () => {
    type A = { v: number }
    type B = { v: string }
    const aSchema = createMockSchema<A>((v) => ({ ok: true, value: v as A }))
    const bSchema = createMockSchema<B>((v) => ({ ok: true, value: v as B }))

    const reg = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        'a->b': {
          migrate: (v) => ({ v: String(v.v) }),
          deprecated: true,
        },
      },
    })

    const result = reg.explain('a', 'b')
    // deprecated: true is stored as 'deprecated' string internally
    expect(result.steps[0]?.deprecated).toBe('deprecated')
    expect(result.summary).toContain('DEPRECATED')
    expect(result.totalCost).toBe(DEPRECATED_COST)
  })

  it('explain with preferred cost shows cost 0', () => {
    type A = { v: number }
    type B = { v: string }
    const aSchema = createMockSchema<A>((v) => ({ ok: true, value: v as A }))
    const bSchema = createMockSchema<B>((v) => ({ ok: true, value: v as B }))

    const reg = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        'a->b': {
          migrate: (v) => ({ v: String(v.v) }),
          preferred: true,
        },
      },
    })

    const result = reg.explain('a', 'b')
    expect(result.totalCost).toBe(0)
    expect(result.steps[0]?.cost).toBe(0)
  })

  it('explain with explicit cost uses that cost', () => {
    type A = { v: number }
    type B = { v: string }
    const aSchema = createMockSchema<A>((v) => ({ ok: true, value: v as A }))
    const bSchema = createMockSchema<B>((v) => ({ ok: true, value: v as B }))

    const reg = createRegistry({
      schemas: { a: aSchema, b: bSchema },
      migrations: {
        'a->b': {
          migrate: (v) => ({ v: String(v.v) }),
          cost: 42,
        },
      },
    })

    const result = reg.explain('a', 'b')
    expect(result.totalCost).toBe(42)
    expect(result.steps[0]?.cost).toBe(42)
  })

  it('explain sums cost across multi-step path', () => {
    type A = { v: number }
    const s = createMockSchema<A>((v) => ({ ok: true, value: v as A }))

    const reg = createRegistry({
      schemas: { a: s, b: s, c: s },
      migrations: {
        'a->b': { migrate: (v) => v, cost: 3 },
        'b->c': { migrate: (v) => v, cost: 7 },
      },
    })

    const result = reg.explain('a', 'c')
    expect(result.totalCost).toBe(10)
    expect(result.steps).toHaveLength(2)
  })

  it('explain shows isolated node with no outgoing', () => {
    type A = { v: number }
    const s = createMockSchema<A>((v) => ({ ok: true, value: v as A }))

    const reg = createRegistry({
      schemas: { a: s, b: s },
      migrations: {},
    })

    const result = reg.explain('a', 'b')
    expect(result.path).toBe(null)
    expect(result.summary).toContain('"a" has no outgoing migrations')
    expect(result.summary).toContain('No schema has a path to "b"')
  })
})
