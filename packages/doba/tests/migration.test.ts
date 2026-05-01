import { describe, it, expect } from 'vitest'
import {
  resolveMigrations,
  DEFAULT_COST,
  PREFERRED_COST,
  DEPRECATED_COST,
} from '../src/migration.js'

const identityFn = (v: unknown) => v

describe('resolveMigrations', () => {
  it('resolves bare function migrations', () => {
    const fn = identityFn
    const { migrations: resolved } = resolveMigrations({ 'a->b': fn })
    expect(resolved.size).toBe(1)
    const migration = resolved.get('a->b')
    expect(migration).toBeDefined()
    expect(migration?.cost).toBe(DEFAULT_COST)
    expect(migration?.deprecated).toBe(false)
    expect(migration?.label).toBeUndefined()
  })

  it('resolves object-form migrations', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, label: 'test', preferred: true },
    })
    const migration = resolved.get('a->b')
    expect(migration?.cost).toBe(PREFERRED_COST)
    expect(migration?.label).toBe('test')
  })

  it('resolves reversible migrations into two edges', () => {
    const { migrations: resolved } = resolveMigrations({
      'a<->b': {
        forward: (v: unknown) => v,
        backward: (v: unknown) => v,
        label: 'sync',
      },
    })
    expect(resolved.size).toBe(2)
    expect(resolved.has('a->b')).toBe(true)
    expect(resolved.has('b->a')).toBe(true)
    expect(resolved.get('a->b')?.label).toBe('sync')
    expect(resolved.get('b->a')?.label).toBe('sync')
  })

  it('skips undefined entries', () => {
    const { migrations: resolved } = resolveMigrations({ 'a->b': undefined })
    expect(resolved.size).toBe(0)
  })

  it('skips malformed keys', () => {
    const fn = identityFn
    const { migrations: resolved } = resolveMigrations({
      noarrow: fn,
      '->b': fn,
      'a->': fn,
      '<->b': fn,
      'a<->': fn,
    })
    expect(resolved.size).toBe(0)
  })

  it('skips non-function non-object values', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': 42,
      'c->d': 'string',
      'e->f': true,
      'g->h': null,
    })
    expect(resolved.size).toBe(0)
  })

  it('skips object missing migrate field', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { notMigrate: (v: unknown) => v },
    })
    expect(resolved.size).toBe(0)
  })

  it('skips reversible missing forward/backward', () => {
    const { migrations: resolved } = resolveMigrations({
      'a<->b': { forward: (v: unknown) => v },
      'c<->d': { backward: (v: unknown) => v },
      'e<->f': { migrate: (v: unknown) => v },
      'g<->h': 'not an object',
    })
    expect(resolved.size).toBe(0)
  })

  it('one-way overrides reversible forward with warning', () => {
    const { migrations: resolved, warnings } = resolveMigrations({
      'a->b': (v: unknown) => v,
      'a<->b': { forward: (v: unknown) => v, backward: (v: unknown) => v },
    })
    expect(resolved.has('a->b')).toBe(true)
    expect(resolved.has('b->a')).toBe(true)
    expect(resolved.get('a->b')?.source).toBe('a->b')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]?.message).toContain('takes precedence')
  })

  it('one-way overrides reversible backward with warning', () => {
    const { migrations: resolved, warnings } = resolveMigrations({
      'b->a': (v: unknown) => v,
      'a<->b': { forward: (v: unknown) => v, backward: (v: unknown) => v },
    })
    expect(resolved.has('a->b')).toBe(true)
    expect(resolved.has('b->a')).toBe(true)
    expect(resolved.get('b->a')?.source).toBe('b->a')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('throws on duplicate same-kind migrations', () => {
    expect(() =>
      resolveMigrations({
        'a->b': (v: unknown) => v,
        'a<->c': { forward: (v: unknown) => v, backward: (v: unknown) => v },
        'c<->a': { forward: (v: unknown) => v, backward: (v: unknown) => v },
      }),
    ).toThrow(/Migration conflict/)
  })
})

describe('resolveMigrations (pipe)', () => {
  it('resolves pipe-based migration', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': {
        pipe: (p: { rename: (f: string, t: string) => unknown }) => p.rename('x', 'y'),
      },
    })
    expect(resolved.size).toBe(1)
    expect(resolved.has('a->b')).toBe(true)
    expect(resolved.get('a->b')?.cost).toBe(DEFAULT_COST)
  })

  it('resolves pipe migration with metadata', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': {
        pipe: (p: { rename: (f: string, t: string) => unknown }) => p.rename('x', 'y'),
        label: 'rename x to y',
        preferred: true,
      },
    })
    expect(resolved.get('a->b')?.label).toBe('rename x to y')
    expect(resolved.get('a->b')?.cost).toBe(PREFERRED_COST)
  })

  it('skips pipe migration when pipe is not a function', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { pipe: 'not a function' },
    })
    expect(resolved.size).toBe(0)
  })

  it('skips pipe migration when pipe callback returns non-function', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { pipe: () => 'not a function' },
    })
    expect(resolved.size).toBe(0)
  })

  it('pipe takes precedence over migrate when both present', () => {
    // pipe is checked before migrate in the code
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- co-located with test for readability
    const pipeFn = (v: unknown) => v
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- co-located with test for readability
    const migrateFn = () => {
      throw new Error('should not be used')
    }
    const { migrations: resolved } = resolveMigrations({
      'a->b': {
        pipe: () => pipeFn,
        migrate: migrateFn,
      },
    })
    expect(resolved.size).toBe(1)
    // should use the pipe result, not migrate
    expect(() => resolved.get('a->b')?.fn({}, {})).not.toThrow()
  })
})

describe('cost resolution', () => {
  it('defaults to DEFAULT_COST', () => {
    const { migrations: resolved } = resolveMigrations({ 'a->b': (v: unknown) => v })
    expect(resolved.get('a->b')?.cost).toBe(DEFAULT_COST)
  })

  it('preferred sets cost to PREFERRED_COST', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, preferred: true },
    })
    expect(resolved.get('a->b')?.cost).toBe(PREFERRED_COST)
  })

  it('deprecated sets cost to DEPRECATED_COST', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, deprecated: true },
    })
    expect(resolved.get('a->b')?.cost).toBe(DEPRECATED_COST)
  })

  it('deprecated string sets cost to DEPRECATED_COST', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, deprecated: 'use v2' },
    })
    expect(resolved.get('a->b')?.cost).toBe(DEPRECATED_COST)
    expect(resolved.get('a->b')?.deprecated).toBe('use v2')
  })

  it("deprecated: true resolves to 'deprecated' string", () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, deprecated: true },
    })
    expect(resolved.get('a->b')?.deprecated).toBe('deprecated')
  })

  it('explicit cost overrides preferred', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, preferred: true, cost: 42 },
    })
    expect(resolved.get('a->b')?.cost).toBe(42)
  })

  it('explicit cost overrides deprecated', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, deprecated: true, cost: 5 },
    })
    expect(resolved.get('a->b')?.cost).toBe(5)
  })

  it('cost: 0 is valid and not treated as falsy', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, cost: 0 },
    })
    expect(resolved.get('a->b')?.cost).toBe(0)
  })

  it('non-string label is ignored', () => {
    const { migrations: resolved } = resolveMigrations({
      'a->b': { migrate: (v: unknown) => v, label: 123 },
    })
    expect(resolved.get('a->b')?.label).toBeUndefined()
  })

  it('reversible shares metadata across both directions', () => {
    const { migrations: resolved } = resolveMigrations({
      'a<->b': {
        forward: (v: unknown) => v,
        backward: (v: unknown) => v,
        preferred: true,
        label: 'sync',
      },
    })
    expect(resolved.get('a->b')?.cost).toBe(PREFERRED_COST)
    expect(resolved.get('b->a')?.cost).toBe(PREFERRED_COST)
    expect(resolved.get('a->b')?.label).toBe('sync')
    expect(resolved.get('b->a')?.label).toBe('sync')
  })
})
