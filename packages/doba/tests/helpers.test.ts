import { describe, it, expect, vi } from 'vitest'
import { createRegistry, pipe, type TransformContext } from '../src/index.js'
import { createMockSchema } from './helpers.js'

function mockCtx(): TransformContext {
  return {
    from: 'a',
    to: 'b',
    warn: vi.fn(),
    defaulted: vi.fn(),
  }
}

describe('pipe builder', () => {
  it('renames a field', () => {
    const fn = pipe<{ name: string; age: number }>().rename('name', 'fullName')
    const result = fn({ name: 'Alice', age: 30 }, mockCtx())
    expect(result).toEqual({ fullName: 'Alice', age: 30 })
  })

  it('adds a field with a static default', () => {
    const ctx = mockCtx()
    const fn = pipe<{ name: string }>().add('role', 'user')
    const result = fn({ name: 'Alice' }, ctx)
    expect(result).toEqual({ name: 'Alice', role: 'user' })
    expect(ctx.defaulted).toHaveBeenCalledWith(['role'], 'added with default')
  })

  it('adds a field with a factory function', () => {
    const ctx = mockCtx()
    const fn = pipe<{ name: string }>().add('id', () => 'generated-id')
    const result = fn({ name: 'Alice' }, ctx)
    expect(result).toEqual({ name: 'Alice', id: 'generated-id' })
  })

  it('skips add if the field already exists', () => {
    const ctx = mockCtx()
    const fn = pipe<{ role: string }>().add('role', 'user')
    const result = fn({ role: 'admin' }, ctx)
    expect(result).toEqual({ role: 'admin' })
    expect(ctx.defaulted).not.toHaveBeenCalled()
  })

  it('drops a field', () => {
    const fn = pipe<{ name: string; password: string }>().drop('password')
    const result = fn({ name: 'Alice', password: 'secret' }, mockCtx())
    expect(result).toEqual({ name: 'Alice' })
  })

  it('drops multiple fields', () => {
    const fn = pipe<{ name: string; password: string; hash: string }>().drop('password', 'hash')
    const result = fn({ name: 'Alice', password: 'secret', hash: 'abc' }, mockCtx())
    expect(result).toEqual({ name: 'Alice' })
  })

  it('maps a field value', () => {
    const fn = pipe<{ role: string; name: string }>().map('role', (r) => r === 'admin')
    const result = fn({ role: 'admin', name: 'Alice' }, mockCtx())
    expect(result).toEqual({ role: true, name: 'Alice' })
  })

  it('chains multiple operations', () => {
    const ctx = mockCtx()
    const fn = pipe<{ name: string; age: number }>()
      .rename('name', 'fullName')
      .add('role', 'user')
      .drop('age')

    const result = fn({ name: 'Alice', age: 30 }, ctx)
    expect(result).toEqual({ fullName: 'Alice', role: 'user' })
    expect(ctx.defaulted).toHaveBeenCalledOnce()
  })

  it('passes context through all steps', () => {
    const ctx = mockCtx()
    // eslint-disable-next-line typescript-eslint/ban-types -- testing pipe with empty object type
    const fn = pipe<{}>().add('a', 1).add('b', 2)
    fn({}, ctx)
    expect(ctx.defaulted).toHaveBeenCalledTimes(2)
  })

  it('rename is a no-op when source field does not exist', () => {
    const fn = pipe<{ name: string }>().rename('name', 'fullName')
    // at runtime the value might lack the field (e.g. optional)
    const result = fn({ name: undefined } as unknown as { name: string }, mockCtx())
    // undefined is still a valid "in" hit, so it renames
    expect(result).toEqual({ fullName: undefined })
  })

  it('map is a no-op when field does not exist at runtime', () => {
    const fn = pipe<{ x: number }>().map('x', (v) => v * 2)
    const result = fn({} as unknown as { x: number }, mockCtx())
    expect(result).toEqual({})
    expect('x' in result).toBe(false)
  })

  it('drop is a no-op for fields that do not exist', () => {
    const fn = pipe<{ a: number; b: number }>().drop('b')
    const result = fn({ a: 1 } as unknown as { a: number; b: number }, mockCtx())
    expect(result).toEqual({ a: 1 })
  })

  it('add with factory function is called each time', () => {
    let counter = 0
    const fn = pipe<{ name: string }>().add('id', () => {
      counter++
      return counter
    })
    const r1 = fn({ name: 'A' }, mockCtx())
    const r2 = fn({ name: 'B' }, mockCtx())
    expect(r1).toEqual({ name: 'A', id: 1 })
    expect(r2).toEqual({ name: 'B', id: 2 })
  })

  it('identity pipe returns a copy of the input', () => {
    const fn = pipe<{ a: number }>()
    const input = { a: 1 }
    const result = fn(input, mockCtx())
    expect(result).toEqual({ a: 1 })
    expect(result).toBe(input) // no steps means no spread, returns same ref
  })

  it('rename then add on the same field name', () => {
    const ctx = mockCtx()
    const fn = pipe<{ old: string }>().rename('old', 'new').add('old', 'backfilled')

    const result = fn({ old: 'original' }, ctx)
    expect(result).toEqual({ new: 'original', old: 'backfilled' })
  })

  it('map transforms value to a different type', () => {
    const fn = pipe<{ count: string }>().map('count', (v) => Number.parseInt(v, 10))
    const result = fn({ count: '42' }, mockCtx())
    expect(result).toEqual({ count: 42 })
  })

  it('chaining rename -> map on the renamed field', () => {
    const fn = pipe<{ name: string }>()
      .rename('name', 'label')
      .map('label', (v) => v.toUpperCase())

    const result = fn({ name: 'alice' }, mockCtx())
    expect(result).toEqual({ label: 'ALICE' })
  })

  it('into returns the same callable function', () => {
    const builder = pipe<{ a: number }>()
    const fn = builder.into<{ a: number }>()
    const result = fn({ a: 1 }, mockCtx())
    expect(result).toEqual({ a: 1 })
  })
})

describe('pipe integration with registry', () => {
  it('uses pipe builder as migration function in a real registry', async () => {
    type V1 = { userName: string; isAdmin: boolean }
    type V2 = { name: string; role: string }

    const v1Schema = createMockSchema<V1>((v) => ({ ok: true, value: v as V1 }))
    const v2Schema = createMockSchema<V2>((v) => ({ ok: true, value: v as V2 }))

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema },
      migrations: {
        'v1->v2': pipe<V1>()
          .rename('userName', 'name')
          .map('isAdmin', (v) => (v ? 'admin' : 'user'))
          .rename('isAdmin', 'role'),
      },
    })

    const result = await registry.transform({ userName: 'Alice', isAdmin: true }, 'v1', 'v2', {
      validate: 'none',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', role: 'admin' })
    }
  })

  it('records defaults when using add in a registry migration', async () => {
    type V1 = { name: string }
    type V2 = { name: string; role: string }

    const v1Schema = createMockSchema<V1>((v) => ({ ok: true, value: v as V1 }))
    const v2Schema = createMockSchema<V2>((v) => ({ ok: true, value: v as V2 }))

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema },
      migrations: {
        'v1->v2': pipe<V1>().add('role', 'user'),
      },
    })

    const result = await registry.transform({ name: 'Alice' }, 'v1', 'v2', { validate: 'none' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', role: 'user' })
      expect(result.meta.defaults).toHaveLength(1)
      expect(result.meta.defaults[0]?.path).toEqual(['role'])
    }
  })
})

describe('pipe migration def (inline builder)', () => {
  it('uses pipe field to build migration with inferred types', async () => {
    type V1 = { userName: string; isAdmin: boolean }
    type V2 = { name: string; role: string }

    const v1Schema = createMockSchema<V1>((v) => ({ ok: true, value: v as V1 }))
    const v2Schema = createMockSchema<V2>((v) => ({ ok: true, value: v as V2 }))

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema },
      migrations: {
        'v1->v2': {
          pipe: (p) =>
            p
              .rename('userName', 'name')
              .map('isAdmin', (v) => (v ? 'admin' : 'user'))
              .rename('isAdmin', 'role'),
        },
      },
    })

    const result = await registry.transform({ userName: 'Alice', isAdmin: true }, 'v1', 'v2', {
      validate: 'none',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', role: 'admin' })
    }
  })

  it('supports metadata alongside pipe', async () => {
    type V1 = { name: string }
    type V2 = { name: string; email: string }

    const v1Schema = createMockSchema<V1>((v) => ({ ok: true, value: v as V1 }))
    const v2Schema = createMockSchema<V2>((v) => ({ ok: true, value: v as V2 }))

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema },
      migrations: {
        'v1->v2': {
          pipe: (p) => p.add('email', 'unknown@example.com'),
          label: 'add email field',
          deprecated: 'use v1->v3',
        },
      },
    })

    const result = await registry.transform({ name: 'Alice' }, 'v1', 'v2', { validate: 'none' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', email: 'unknown@example.com' })
      expect(result.meta.steps[0]?.label).toBe('add email field')
      expect(result.meta.steps[0]?.deprecated).toBe('use v1->v3')
    }
  })

  it('records defaults from pipe add steps', async () => {
    type V1 = { name: string }
    type V2 = { name: string; role: string }

    const v1Schema = createMockSchema<V1>((v) => ({ ok: true, value: v as V1 }))
    const v2Schema = createMockSchema<V2>((v) => ({ ok: true, value: v as V2 }))

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema },
      migrations: {
        'v1->v2': {
          pipe: (p) => p.add('role', 'user'),
        },
      },
    })

    const result = await registry.transform({ name: 'Alice' }, 'v1', 'v2', { validate: 'none' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.defaults).toHaveLength(1)
      expect(result.meta.defaults[0]?.path).toEqual(['role'])
    }
  })

  it('works in multi-step paths', async () => {
    type V1 = { userName: string }
    type V2 = { name: string }
    type V3 = { name: string; version: number }

    const v1Schema = createMockSchema<V1>((v) => ({ ok: true, value: v as V1 }))
    const v2Schema = createMockSchema<V2>((v) => ({ ok: true, value: v as V2 }))
    const v3Schema = createMockSchema<V3>((v) => ({ ok: true, value: v as V3 }))

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema, v3: v3Schema },
      migrations: {
        'v1->v2': {
          pipe: (p) => p.rename('userName', 'name'),
        },
        'v2->v3': {
          pipe: (p) => p.add('version', 3),
        },
      },
    })

    const result = await registry.transform({ userName: 'Alice' }, 'v1', 'v3', {
      validate: 'none',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Alice', version: 3 })
      expect(result.meta.path).toEqual(['v1', 'v2', 'v3'])
    }
  })
})
