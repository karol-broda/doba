import { describe, it, expect } from 'vitest'
import { createRegistry } from '../src/index.js'
import { createMockSchema } from './helpers.js'

type V = { val: number }
const schema = createMockSchema<V>((v) => {
  if (typeof (v as V)?.val !== 'number') {
    return { ok: false, message: 'val must be number' }
  }
  return { ok: true, value: v as V }
})

function makeSchemas(keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, schema])) as Record<string, typeof schema>
}

describe('deprecated migrations', () => {
  it('emits deprecation warning when used', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: {
        'a->b': { migrate: (v) => v, deprecated: 'use v2 path' },
      },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'b')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.warnings.some((w) => w.message.includes('deprecated'))).toBe(true)
      expect(result.meta.warnings.some((w) => w.message.includes('use v2 path'))).toBe(true)
    }
  })

  it('emits deprecation warning with boolean true', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: {
        'a->b': { migrate: (v) => v, deprecated: true },
      },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'b')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.warnings.some((w) => w.message.includes('deprecated'))).toBe(true)
      expect(result.meta.steps[0]?.deprecated).toBe('deprecated')
    }
  })

  it('step has no deprecated field when migration is not deprecated', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: { 'a->b': (v) => v },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'b')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.steps[0]?.deprecated).toBeUndefined()
    }
  })

  it('prefers non-deprecated over direct deprecated', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->c': { migrate: (v) => v, deprecated: true },
        'a->b': (v) => v,
        'b->c': (v) => v,
      },
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'b', 'c'])
  })

  it("falls back to deprecated when it's the only path", () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: {
        'a->b': { migrate: (v) => v, deprecated: true },
      },
    })
    expect(registry.findPath('a', 'b')).toEqual(['a', 'b'])
  })

  it('emits multiple deprecation warnings across multi-step path', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->b': { migrate: (v) => v, deprecated: 'dep1' },
        'b->c': { migrate: (v) => v, deprecated: 'dep2' },
      },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'c')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const depWarnings = result.meta.warnings.filter((w) => w.message.includes('deprecated'))
      expect(depWarnings).toHaveLength(2)
    }
  })

  it('fires onWarning hook for deprecated migrations', async () => {
    const hookCalls: string[] = []
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: {
        'a->b': { migrate: (v) => v, deprecated: 'old' },
      },
      hooks: { onWarning: (msg) => hookCalls.push(msg) },
    })
    await registry.transform({ val: 1 }, 'a', 'b')
    expect(hookCalls.some((m) => m.includes('deprecated'))).toBe(true)
  })
})

describe('preferred migrations', () => {
  it('prefers preferred 2-hop path over direct 1-hop', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->c': (v) => v,
        'a->b': { migrate: (v) => v, preferred: true },
        'b->c': { migrate: (v) => v, preferred: true },
      },
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'b', 'c'])
  })

  // oxlint-disable-next-line require-await -- async required to match migration function signature
  it('preferred has no effect when pathStrategy is direct', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->c': (v) => v,
        'a->b': { migrate: (v) => v, preferred: true },
        'b->c': { migrate: (v) => v, preferred: true },
      },
      pathStrategy: 'direct',
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'c'])
  })
})

describe('custom cost', () => {
  it('explicit cost overrides preferred', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->c': { migrate: (v) => v, cost: 0.1 },
        'a->b': { migrate: (v) => v, preferred: true },
        'b->c': { migrate: (v) => v, cost: 5 },
      },
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'c'])
  })

  it('explicit cost overrides deprecated', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->c': { migrate: (v) => v, deprecated: true, cost: 0.5 },
        'a->b': (v) => v,
        'b->c': (v) => v,
      },
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'c'])
  })

  it('cost 0 is valid', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: {
        'a->b': { migrate: (v) => v, cost: 0 },
      },
    })
    expect(registry.findPath('a', 'b')).toEqual(['a', 'b'])
  })
})

describe('labels', () => {
  it('label appears in step info', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: {
        'a->b': { migrate: (v) => v, label: 'my-migration' },
      },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'b')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.steps[0]?.label).toBe('my-migration')
    }
  })

  it('step has no label when migration has none', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: { 'a->b': (v) => v },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'b')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.steps[0]?.label).toBeUndefined()
    }
  })

  it('labels across multi-step path', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->b': { migrate: (v) => v, label: 'step-1' },
        'b->c': { migrate: (v) => v, label: 'step-2' },
      },
    })
    const result = await registry.transform({ val: 1 }, 'a', 'c')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.steps.map((s) => s.label)).toEqual(['step-1', 'step-2'])
    }
  })
})

describe('pathStrategy: direct', () => {
  it('finds direct migration', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b']),
      migrations: { 'a->b': (v) => v },
      pathStrategy: 'direct',
    })
    expect(registry.findPath('a', 'b')).toEqual(['a', 'b'])
  })

  it('returns null when only indirect path exists', () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->b': (v) => v,
        'b->c': (v) => v,
      },
      pathStrategy: 'direct',
    })
    expect(registry.findPath('a', 'c')).toBe(null)
  })

  it('per-call override to direct', async () => {
    const registry = createRegistry({
      schemas: makeSchemas(['a', 'b', 'c']),
      migrations: {
        'a->b': (v) => v,
        'b->c': (v) => v,
      },
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'b', 'c'])

    const result = await registry.transform({ val: 1 }, 'a', 'c', { pathStrategy: 'direct' })
    expect(result.ok).toBe(false)
  })
})

describe('feature interactions', () => {
  it('preferred + deprecated on same migration (preferred wins cost, but deprecated warning still fires)', async () => {
    const schemas = { a: schema, b: schema } as const
    const registry = createRegistry({
      schemas,
      migrations: {
        'a->b': { migrate: (v) => v, preferred: true, deprecated: 'old path' },
      },
    })
    expect(registry.findPath('a', 'b')).toEqual(['a', 'b'])

    const result = await registry.transform({ val: 1 }, 'a', 'b')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.steps[0]?.deprecated).toBe('old path')
      expect(result.meta.warnings.some((w) => w.message.includes('deprecated'))).toBe(true)
    }
  })

  it('reversible + preferred beats higher-cost direct', () => {
    const schemas = { a: schema, b: schema, c: schema } as const
    const registry = createRegistry({
      schemas,
      migrations: {
        'a<->b': {
          forward: (v) => v,
          backward: (v) => v,
          preferred: true,
        },
        'b->c': { migrate: (v) => v, preferred: true },
        'a->c': { migrate: (v) => v, cost: 5 },
      },
    })
    expect(registry.findPath('a', 'c')).toEqual(['a', 'b', 'c'])
  })

  it('reversible + cost', () => {
    const schemas = { a: schema, b: schema, c: schema } as const
    const registry = createRegistry({
      schemas,
      migrations: {
        'a<->b': {
          forward: (v) => v,
          backward: (v) => v,
          cost: 100,
        },
        'a->c': (v) => v,
        'c->b': (v) => v,
      },
    })
    expect(registry.findPath('a', 'b')).toEqual(['a', 'c', 'b'])
  })
})
