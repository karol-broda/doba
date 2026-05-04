import { describe, it, expect } from 'vitest'
import { createRegistry, match, tryParse, byField, firstMatch } from '../src/index.js'
import {
  userSchemas,
  userMigrations,
  sampleDatabaseUser,
  sampleFrontendUser,
  sampleAiUser,
  createMockSchema,
  createAsyncMockSchema,
} from './helpers.js'

// ---- match helper ----

describe('match', () => {
  it('match.field checks field presence', () => {
    const guard = match.field('passwordHash')
    expect(guard({ passwordHash: 'abc' })).toBe(true)
    expect(guard({ email: 'test' })).toBe(false)
    expect(guard('string')).toBe(false)
    expect(guard(null)).toBe(false)
  })

  it('match.field checks field value when expected is provided', () => {
    const guard = match.field('version', 2)
    expect(guard({ version: 2 })).toBe(true)
    expect(guard({ version: 1 })).toBe(false)
    expect(guard({ version: '2' })).toBe(false)
    expect(guard({})).toBe(false)
  })

  it('match.fields checks multiple fields', () => {
    const guard = match.fields('id', 'email')
    expect(guard({ id: '1', email: 'a@b.com' })).toBe(true)
    expect(guard({ id: '1' })).toBe(false)
    expect(guard(42)).toBe(false)
  })

  it('match.type checks typeof', () => {
    const guard = match.type('string')
    expect(guard('hello')).toBe(true)
    expect(guard(42)).toBe(false)
    expect(guard(null)).toBe(false)
  })

  it('match.test adds arbitrary predicate', () => {
    const guard = match.test((v) => Array.isArray(v))
    expect(guard([1, 2])).toBe(true)
    expect(guard('not array')).toBe(false)
  })

  it('chaining ANDs conditions together', () => {
    const guard = match.field('passwordHash').field('role')
    expect(guard({ passwordHash: 'x', role: 'admin' })).toBe(true)
    expect(guard({ passwordHash: 'x' })).toBe(false)
    expect(guard({ role: 'admin' })).toBe(false)
  })

  it('empty match accepts everything', () => {
    expect(match('anything')).toBe(true)
    expect(match(null)).toBe(true)
    expect(match(42)).toBe(true)
  })
})

// ---- byField helper ----

describe('byField', () => {
  it('reads field and returns as key', () => {
    const fn = byField('version')
    expect(fn({ version: 'v1' })).toBe('v1')
    expect(fn({ version: 'v2' })).toBe('v2')
    expect(fn({ other: 1 })).toBe(null)
    expect(fn('string')).toBe(null)
    expect(fn(null)).toBe(null)
  })

  it('applies prefix', () => {
    const fn = byField('version', { prefix: 'v' })
    expect(fn({ version: '1' })).toBe('v1')
    expect(fn({ version: '2' })).toBe('v2')
  })

  it('applies suffix', () => {
    const fn = byField('kind', { suffix: '_schema' })
    expect(fn({ kind: 'user' })).toBe('user_schema')
  })

  it('applies prefix and suffix', () => {
    const fn = byField('kind', { prefix: 'schema_', suffix: '_v2' })
    expect(fn({ kind: 'user' })).toBe('schema_user_v2')
  })

  it('uses explicit map', () => {
    const fn = byField('type', { map: { UserDB: 'database', UserFE: 'frontend' } })
    expect(fn({ type: 'UserDB' })).toBe('database')
    expect(fn({ type: 'UserFE' })).toBe('frontend')
    expect(fn({ type: 'unknown' })).toBe(null)
  })
})

// ---- firstMatch helper ----

describe('firstMatch', () => {
  it('returns first non-null result', () => {
    const fn = firstMatch(
      (v) => (typeof v === 'string' ? 'name' : null),
      (v) => (typeof v === 'number' ? 'count' : null),
    )
    expect(fn('hello')).toBe('name')
    expect(fn(42)).toBe('count')
    expect(fn(null)).toBe(null)
  })

  it('returns null when nothing matches', () => {
    const fn = firstMatch(
      () => null,
      () => null,
    )
    expect(fn('anything')).toBe(null)
  })
})

// ---- registry.identify with guard map ----

describe('registry.identify (guard map)', () => {
  const registry = createRegistry({
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

  it('identifies database user', async () => {
    const result = await registry.identify(sampleDatabaseUser)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('database')
      expect(result.meta.schema).toBe('database')
    }
  })

  it('identifies frontend user', async () => {
    const result = await registry.identify(sampleFrontendUser)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('frontend')
    }
  })

  it('identifies ai user', async () => {
    const result = await registry.identify(sampleAiUser)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('ai')
    }
  })

  it('returns identify_failed for unknown data', async () => {
    const result = await registry.identify({ unknown: true })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })

  it('returns identify_failed for primitives when no guard matches', async () => {
    const result = await registry.identify('hello')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })
})

// ---- registry.identify with function form ----

describe('registry.identify (function form)', () => {
  const registry = createRegistry({
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

  it('identifies via function', async () => {
    const result = await registry.identify(sampleDatabaseUser)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('database')
    }
  })

  it('returns identify_failed when function returns null', async () => {
    const result = await registry.identify('no match')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })

  it('returns identify_failed when function returns unknown key', async () => {
    const reg = createRegistry({
      schemas: userSchemas,
      migrations: {},
      identify: () => 'nonexistent' as 'database',
    })
    const result = await reg.identify({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })
})

// ---- registry.identify with byField ----

describe('registry.identify (byField)', () => {
  type V1 = { version: number; data: string }
  type V2 = { version: number; data: string; extra: boolean }

  const v1Schema = createMockSchema<V1>((v) => {
    const obj = v as Record<string, unknown>
    if (typeof obj['version'] === 'number' && typeof obj['data'] === 'string') {
      return { ok: true, value: v as V1 }
    }
    return { ok: false, message: 'invalid v1' }
  })

  const v2Schema = createMockSchema<V2>((v) => {
    const obj = v as Record<string, unknown>
    if (
      typeof obj['version'] === 'number' &&
      typeof obj['data'] === 'string' &&
      typeof obj['extra'] === 'boolean'
    ) {
      return { ok: true, value: v as V2 }
    }
    return { ok: false, message: 'invalid v2' }
  })

  const registry = createRegistry({
    schemas: { v1: v1Schema, v2: v2Schema },
    migrations: {
      'v1->v2': (v) => ({ ...v, extra: true }),
    },
    identify: byField('version', { prefix: 'v' }),
  })

  it('identifies by field with prefix', async () => {
    const result = await registry.identify({ version: '1', data: 'hello' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('v1')
    }
  })

  it('returns identify_failed for unknown version', async () => {
    const result = await registry.identify({ version: '99', data: 'hello' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })
})

// ---- tryParse ----

describe('registry.identify (tryParse)', () => {
  type Cat = { name: string; indoor: boolean }
  type Dog = { name: string; breed: string }

  const catSchema = createMockSchema<Cat>((v) => {
    const obj = v as Record<string, unknown>
    if (typeof obj['name'] === 'string' && typeof obj['indoor'] === 'boolean') {
      return { ok: true, value: v as Cat }
    }
    return { ok: false, message: 'not a cat' }
  })

  const dogSchema = createMockSchema<Dog>((v) => {
    const obj = v as Record<string, unknown>
    if (typeof obj['name'] === 'string' && typeof obj['breed'] === 'string') {
      return { ok: true, value: v as Dog }
    }
    return { ok: false, message: 'not a dog' }
  })

  it('identifies via schema validation', async () => {
    const registry = createRegistry({
      schemas: { cat: catSchema, dog: dogSchema },
      migrations: {},
      identify: {
        cat: tryParse,
        dog: tryParse,
      },
    })

    const catResult = await registry.identify({ name: 'Whiskers', indoor: true })
    expect(catResult.ok).toBe(true)
    if (catResult.ok) {
      expect(catResult.value).toBe('cat')
    }

    const dogResult = await registry.identify({ name: 'Rex', breed: 'Labrador' })
    expect(dogResult.ok).toBe(true)
    if (dogResult.ok) {
      expect(dogResult.value).toBe('dog')
    }
  })

  it('returns identify_failed when no schema validates', async () => {
    const registry = createRegistry({
      schemas: { cat: catSchema, dog: dogSchema },
      migrations: {},
      identify: {
        cat: tryParse,
        dog: tryParse,
      },
    })

    const result = await registry.identify({ totally: 'different' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })

  it('returns identify_ambiguous when multiple schemas match', async () => {
    // both schemas accept { name: string, ... } so a value with all fields matches both
    const registry = createRegistry({
      schemas: { cat: catSchema, dog: dogSchema },
      migrations: {},
      identify: {
        cat: tryParse,
        dog: tryParse,
      },
    })

    const result = await registry.identify({ name: 'Buddy', indoor: true, breed: 'Poodle' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_ambiguous')
      expect(result.issues[0]?.meta?.['matches']).toEqual(['cat', 'dog'])
    }
  })

  it('sync guards take priority over tryParse', async () => {
    const registry = createRegistry({
      schemas: { cat: catSchema, dog: dogSchema },
      migrations: {},
      identify: {
        cat: match.field('indoor'),
        dog: tryParse,
      },
    })

    // has both indoor and breed, but sync guard for cat fires first
    const result = await registry.identify({ name: 'Buddy', indoor: true, breed: 'Poodle' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('cat')
    }
  })
})

// ---- identifyAndTransform ----

describe('registry.identifyAndTransform', () => {
  const registry = createRegistry({
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

  it('identifies and transforms in one call', async () => {
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        id: sampleDatabaseUser.id,
        email: sampleDatabaseUser.email,
        createdAt: sampleDatabaseUser.createdAt,
        role: sampleDatabaseUser.role,
      })
      expect(result.meta.from).toBe('database')
      expect(result.meta.path).toEqual(['database', 'frontend'])
    }
  })

  it('identifies and transforms through multi-step path', async () => {
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'ai')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        id: sampleDatabaseUser.id,
        email: sampleDatabaseUser.email,
        isAdmin: true,
      })
      expect(result.meta.from).toBe('database')
    }
  })

  it('returns identify_failed when value is not recognized', async () => {
    const result = await registry.identifyAndTransform({ unknown: true }, 'ai')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })

  it('returns no_path_found when identified but no path to target', async () => {
    const result = await registry.identifyAndTransform(sampleAiUser, 'database')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('no_path_found')
    }
  })

  it('transforms to same schema (identity)', async () => {
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'database')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.from).toBe('database')
      expect(result.meta.path).toEqual(['database'])
    }
  })
})

// ---- registry without identify has no identify methods ----

describe('registry without identify', () => {
  const registry = createRegistry({
    schemas: userSchemas,
    migrations: userMigrations,
  })

  it('does not have identify method', () => {
    expect('identify' in registry).toBe(false)
  })

  it('does not have identifyAndTransform method', () => {
    expect('identifyAndTransform' in registry).toBe(false)
  })
})

// ---- match helper edge cases ----

describe('match edge cases', () => {
  it('match.field with undefined expected value', () => {
    // oxlint-disable-next-line unicorn/no-useless-undefined -- explicitly testing undefined matching
    const guard = match.field('x', undefined)
    expect(guard({ x: undefined })).toBe(true)
    expect(guard({ x: null })).toBe(false)
    expect(guard({ x: 'something' })).toBe(false)
    expect(guard({})).toBe(false)
  })

  it('match.field with null expected value', () => {
    const guard = match.field('x', null)
    expect(guard({ x: null })).toBe(true)
    expect(guard({ x: undefined })).toBe(false)
    expect(guard({ x: 0 })).toBe(false)
  })

  it('match.fields with no arguments', () => {
    const guard = match.fields()
    expect(guard({ any: 'object' })).toBe(true)
    expect(guard({})).toBe(true)
    // non-objects still fail the isObj check
    expect(guard('string')).toBe(false)
    expect(guard(null)).toBe(false)
  })

  it('match.type with object (null gotcha)', () => {
    const guard = match.type('object')
    expect(guard({})).toBe(true)
    expect(guard([])).toBe(true)
    // typeof null === 'object' in JS
    expect(guard(null)).toBe(true)
    expect(guard('string')).toBe(false)
    expect(guard(42)).toBe(false)
  })

  it('chaining many conditions', () => {
    const guard = match
      .field('a')
      .field('b')
      .field('c')
      .field('d')
      .test((v) => {
        const obj = v as Record<string, unknown>
        return obj['a'] === 1
      })
    expect(guard({ a: 1, b: 2, c: 3, d: 4 })).toBe(true)
    expect(guard({ a: 2, b: 2, c: 3, d: 4 })).toBe(false)
    expect(guard({ a: 1, b: 2, c: 3 })).toBe(false)
  })

  it('match.test that throws returns false', () => {
    const guard = match.test(() => {
      throw new Error('boom')
    })
    expect(() => guard({ anything: true })).toThrow('boom')
  })

  it('match.field on array value', () => {
    const guard = match.field('length')
    // arrays are objects with 'length'
    expect(guard([1, 2, 3])).toBe(true)
    expect(guard({ length: 5 })).toBe(true)
  })
})

// ---- byField edge cases ----

describe('byField edge cases', () => {
  it('numeric field values are stringified', () => {
    const fn = byField('version')
    expect(fn({ version: 42 })).toBe('42')
  })

  it('boolean field values are stringified', () => {
    const fn = byField('active')
    expect(fn({ active: true })).toBe('true')
    expect(fn({ active: false })).toBe('false')
  })

  it('null field value is stringified', () => {
    const fn = byField('tag')
    expect(fn({ tag: null })).toBe('null')
  })

  it('undefined field value is stringified', () => {
    const fn = byField('tag')
    expect(fn({ tag: undefined })).toBe('undefined')
  })

  it('empty prefix and suffix strings behave like no options', () => {
    const fn = byField('kind', { prefix: '', suffix: '' })
    expect(fn({ kind: 'user' })).toBe('user')
  })

  it('map with overlapping values returns first match', () => {
    const fn = byField('type', { map: { a: 'schema1', b: 'schema1' } })
    expect(fn({ type: 'a' })).toBe('schema1')
    expect(fn({ type: 'b' })).toBe('schema1')
    expect(fn({ type: 'c' })).toBe(null)
  })

  it('object field value is stringified via String()', () => {
    const fn = byField('data')
    expect(fn({ data: {} })).toBe('[object Object]')
  })

  it('numeric field value with prefix', () => {
    const fn = byField('v', { prefix: 'version_' })
    expect(fn({ v: 3 })).toBe('version_3')
  })
})

// ---- guard map ordering ----

describe('guard map ordering (first match wins)', () => {
  it('returns first defined guard that matches, not alphabetical', async () => {
    type A = { x: number }
    type B = { x: number }
    type C = { x: number }

    const schemaA = createMockSchema<A>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['x'] === 'number') {
        return { ok: true, value: v as A }
      }
      return { ok: false, message: 'not A' }
    })
    const schemaB = createMockSchema<B>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['x'] === 'number') {
        return { ok: true, value: v as B }
      }
      return { ok: false, message: 'not B' }
    })
    const schemaC = createMockSchema<C>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['x'] === 'number') {
        return { ok: true, value: v as C }
      }
      return { ok: false, message: 'not C' }
    })

    // z_ and a_ prefixes ensure alphabetical would differ from definition order
    const registry = createRegistry({
      schemas: { z_first: schemaA, a_second: schemaB, m_third: schemaC },
      migrations: {},
      identify: {
        z_first: match.field('x'),
        a_second: match.field('x'),
        m_third: match.field('x'),
      },
    })

    const result = await registry.identify({ x: 1 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('z_first')
    }
  })
})

// ---- tryParse edge cases ----

describe('tryParse edge cases', () => {
  it('single tryParse entry (no ambiguity possible)', async () => {
    type Item = { name: string }
    const itemSchema = createMockSchema<Item>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['name'] === 'string') {
        return { ok: true, value: v as Item }
      }
      return { ok: false, message: 'not item' }
    })

    const registry = createRegistry({
      schemas: { item: itemSchema },
      migrations: {},
      identify: { item: tryParse },
    })

    const result = await registry.identify({ name: 'test' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('item')
    }
  })

  it('all schemas as tryParse, only one validates', async () => {
    type Cat = { meow: boolean }
    type Dog = { bark: boolean }
    type Fish = { swim: boolean }

    const catSchema = createMockSchema<Cat>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['meow'] === 'boolean') {
        return { ok: true, value: v as Cat }
      }
      return { ok: false, message: 'not cat' }
    })
    const dogSchema = createMockSchema<Dog>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['bark'] === 'boolean') {
        return { ok: true, value: v as Dog }
      }
      return { ok: false, message: 'not dog' }
    })
    const fishSchema = createMockSchema<Fish>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['swim'] === 'boolean') {
        return { ok: true, value: v as Fish }
      }
      return { ok: false, message: 'not fish' }
    })

    const registry = createRegistry({
      schemas: { cat: catSchema, dog: dogSchema, fish: fishSchema },
      migrations: {},
      identify: { cat: tryParse, dog: tryParse, fish: tryParse },
    })

    const result = await registry.identify({ bark: true })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('dog')
    }
  })

  it('async schema validation in tryParse', async () => {
    type Widget = { size: number }
    const asyncWidgetSchema = createAsyncMockSchema<Widget>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['size'] === 'number') {
        return { ok: true, value: v as Widget }
      }
      return { ok: false, message: 'not widget' }
    })

    const registry = createRegistry({
      schemas: { widget: asyncWidgetSchema },
      migrations: {},
      identify: { widget: tryParse },
    })

    const result = await registry.identify({ size: 42 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('widget')
    }
  })

  it('tryParse with a schema that accepts everything', async () => {
    type Anything = unknown
    type Strict = { tag: 'strict' }

    const anySchema = createMockSchema<Anything>((v) => ({ ok: true, value: v }))
    const strictSchema = createMockSchema<Strict>((v) => {
      const obj = v as Record<string, unknown>
      if (obj['tag'] === 'strict') {
        return { ok: true, value: v as Strict }
      }
      return { ok: false, message: 'not strict' }
    })

    const registry = createRegistry({
      schemas: { any: anySchema, strict: strictSchema },
      migrations: {},
      identify: { any: tryParse, strict: tryParse },
    })

    // value matches strict: both match -> ambiguous
    const ambiguous = await registry.identify({ tag: 'strict' })
    expect(ambiguous.ok).toBe(false)
    if (!ambiguous.ok) {
      expect(ambiguous.issues[0]?.code).toBe('identify_ambiguous')
    }

    // value does not match strict: only 'any' matches -> ok
    const onlyAny = await registry.identify({ random: true })
    expect(onlyAny.ok).toBe(true)
    if (onlyAny.ok) {
      expect(onlyAny.value).toBe('any')
    }
  })
})

// ---- mixed guards and tryParse ----

describe('mixed guards and tryParse', () => {
  type Alpha = { alpha: string }
  type Beta = { beta: number }
  type Gamma = { gamma: boolean }

  const alphaSchema = createMockSchema<Alpha>((v) => {
    const obj = v as Record<string, unknown>
    if (typeof obj['alpha'] === 'string') {
      return { ok: true, value: v as Alpha }
    }
    return { ok: false, message: 'not alpha' }
  })
  const betaSchema = createMockSchema<Beta>((v) => {
    const obj = v as Record<string, unknown>
    if (typeof obj['beta'] === 'number') {
      return { ok: true, value: v as Beta }
    }
    return { ok: false, message: 'not beta' }
  })
  const gammaSchema = createMockSchema<Gamma>((v) => {
    const obj = v as Record<string, unknown>
    if (typeof obj['gamma'] === 'boolean') {
      return { ok: true, value: v as Gamma }
    }
    return { ok: false, message: 'not gamma' }
  })

  it('sync guards always run before tryParse', async () => {
    const registry = createRegistry({
      schemas: { alpha: alphaSchema, beta: betaSchema, gamma: gammaSchema },
      migrations: {},
      identify: {
        alpha: tryParse,
        beta: match.field('beta'),
        gamma: tryParse,
      },
    })

    // value has beta field and also validates as beta schema
    // sync guard for beta should fire before tryParse
    const result = await registry.identify({ beta: 99 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('beta')
    }
  })

  it('value matching sync guard AND tryParse schema returns sync guard result', async () => {
    // alpha has sync guard, gamma is tryParse, but value matches both
    const registry = createRegistry({
      schemas: { alpha: alphaSchema, gamma: gammaSchema },
      migrations: {},
      identify: {
        alpha: match.field('alpha'),
        gamma: tryParse,
      },
    })

    // value has alpha (matches sync guard) AND gamma (would match tryParse)
    const result = await registry.identify({ alpha: 'hello', gamma: true })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('alpha')
    }
  })

  it('falls back to tryParse when no sync guard matches', async () => {
    const registry = createRegistry({
      schemas: { alpha: alphaSchema, gamma: gammaSchema },
      migrations: {},
      identify: {
        alpha: match.field('alpha'),
        gamma: tryParse,
      },
    })

    const result = await registry.identify({ gamma: false })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('gamma')
    }
  })
})

// ---- identifyAndTransform with options ----

describe('identifyAndTransform with options', () => {
  const registry = createRegistry({
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

  it('validate none skips schema validation', async () => {
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'frontend', {
      validate: 'none',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.from).toBe('database')
    }
  })

  it('validate each validates intermediate steps', async () => {
    // database -> frontend -> ai is multi-step
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'ai', {
      validate: 'each',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.from).toBe('database')
    }
  })

  it('explicit path option', async () => {
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'ai', {
      path: ['database', 'frontend', 'ai'],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.path).toEqual(['database', 'frontend', 'ai'])
      expect(result.meta.from).toBe('database')
    }
  })

  it('pathStrategy direct', async () => {
    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'ai', {
      pathStrategy: 'direct',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.path).toEqual(['database', 'ai'])
      expect(result.meta.from).toBe('database')
    }
  })

  it('pathStrategy direct fails when no direct migration exists', async () => {
    const result = await registry.identifyAndTransform(sampleAiUser, 'frontend', {
      pathStrategy: 'direct',
    })
    expect(result.ok).toBe(false)
  })
})

// ---- identifyAndTransform meta ----

describe('identifyAndTransform meta', () => {
  it('populates meta.from, meta.path, meta.steps', async () => {
    const registry = createRegistry({
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

    const result = await registry.identifyAndTransform(sampleDatabaseUser, 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.from).toBe('database')
      expect(result.meta.path).toEqual(['database', 'frontend'])
      expect(result.meta.steps).toHaveLength(1)
      expect(result.meta.steps[0]?.from).toBe('database')
      expect(result.meta.steps[0]?.to).toBe('frontend')
      expect(result.meta.warnings).toEqual([])
      expect(result.meta.defaults).toEqual([])
    }
  })

  it('populates meta.warnings and meta.defaults via ctx', async () => {
    type V1 = { data: string }
    type V2 = { data: string; extra: string }

    const v1Schema = createMockSchema<V1>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['data'] === 'string') {
        return { ok: true, value: v as V1 }
      }
      return { ok: false, message: 'invalid v1' }
    })
    const v2Schema = createMockSchema<V2>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['data'] === 'string' && typeof obj['extra'] === 'string') {
        return { ok: true, value: v as V2 }
      }
      return { ok: false, message: 'invalid v2' }
    })

    const registry = createRegistry({
      schemas: { v1: v1Schema, v2: v2Schema },
      migrations: {
        'v1->v2': (v: V1, ctx) => {
          ctx.warn('filling in extra field')
          ctx.defaulted(['extra'], 'used default value')
          return { data: v.data, extra: 'default' }
        },
      },
      identify: byField('_version', { prefix: 'v' }),
    })

    const result = await registry.identifyAndTransform({ _version: '1', data: 'hello' }, 'v2')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.from).toBe('v1')
      expect(result.meta.path).toEqual(['v1', 'v2'])
      expect(result.meta.warnings).toHaveLength(1)
      expect(result.meta.warnings[0]?.message).toBe('filling in extra field')
      expect(result.meta.warnings[0]?.from).toBe('v1')
      expect(result.meta.warnings[0]?.to).toBe('v2')
      expect(result.meta.defaults).toHaveLength(1)
      expect(result.meta.defaults[0]?.path).toEqual(['extra'])
      expect(result.meta.defaults[0]?.message).toBe('used default value')
    }
  })
})

// ---- error cases ----

describe('error cases', () => {
  it('function-form identify that returns empty string', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      identify: () => '',
    })

    const result = await registry.identify({ anything: true })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })

  it('function-form identify that returns a string with spaces', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      identify: () => 'not a schema' as 'database',
    })

    const result = await registry.identify({ anything: true })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('identify_failed')
    }
  })

  it('identifyAndTransform when identified schema has no path to target', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      identify: {
        ai: match.field('isAdmin'),
      },
    })

    const result = await registry.identifyAndTransform(sampleAiUser, 'database')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('no_path_found')
    }
  })
})

// ---- firstMatch composition ----

describe('firstMatch composition', () => {
  it('firstMatch with zero functions returns null', () => {
    const fn = firstMatch()
    expect(fn('anything')).toBe(null)
    expect(fn(42)).toBe(null)
    expect(fn(null)).toBe(null)
  })

  it('firstMatch where first fn matches', () => {
    const fn = firstMatch(
      () => 'first',
      () => 'second',
      () => 'third',
    )
    expect(fn('test')).toBe('first')
  })

  it('firstMatch where only last fn matches', () => {
    const fn = firstMatch(
      () => null,
      () => null,
      () => 'last',
    )
    expect(fn('test')).toBe('last')
  })

  it('firstMatch where none match', () => {
    const fn = firstMatch(
      () => null,
      () => null,
      () => null,
    )
    expect(fn('test')).toBe(null)
  })

  it('firstMatch used as registry identify', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: userMigrations,
      identify: firstMatch(
        (v) => {
          if (typeof v === 'object' && v !== null && 'passwordHash' in v) {
            return 'database'
          }
          return null
        },
        (v) => {
          if (typeof v === 'object' && v !== null && 'isAdmin' in v) {
            return 'ai'
          }
          return null
        },
      ),
    })

    const dbResult = await registry.identify(sampleDatabaseUser)
    expect(dbResult.ok).toBe(true)
    if (dbResult.ok) {
      expect(dbResult.value).toBe('database')
    }

    const aiResult = await registry.identify(sampleAiUser)
    expect(aiResult.ok).toBe(true)
    if (aiResult.ok) {
      expect(aiResult.value).toBe('ai')
    }

    const noMatch = await registry.identify('unknown')
    expect(noMatch.ok).toBe(false)
  })
})

// ---- type coercion in byField ----

describe('type coercion in byField', () => {
  it('byField where field value is a number gets String()-ed', async () => {
    type N1 = { version: number; data: string }
    const n1Schema = createMockSchema<N1>((v) => {
      const obj = v as Record<string, unknown>
      if (typeof obj['version'] === 'number' && typeof obj['data'] === 'string') {
        return { ok: true, value: v as N1 }
      }
      return { ok: false, message: 'invalid' }
    })

    const registry = createRegistry({
      schemas: { '1': n1Schema },
      migrations: {},
      identify: byField('version'),
    })

    const result = await registry.identify({ version: 1, data: 'hello' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('1')
    }
  })

  it('byField where field value is an object stringifies to [object Object]', () => {
    const fn = byField('tag')
    const result = fn({ tag: { nested: true } })
    expect(result).toBe('[object Object]')
  })

  it('byField with map still stringifies the field before lookup', () => {
    const fn = byField('version', { map: { '2': 'v2', '3': 'v3' } })
    // numeric field value gets String()-ed, then looked up in map
    expect(fn({ version: 2 })).toBe('v2')
    expect(fn({ version: 3 })).toBe('v3')
    expect(fn({ version: 99 })).toBe(null)
  })
})

// ---- registry still works normally with identify ----

describe('registry with identify still has normal methods', () => {
  const registry = createRegistry({
    schemas: userSchemas,
    migrations: userMigrations,
    identify: {
      database: match.field('passwordHash'),
      frontend: match.fields('createdAt', 'role'),
      ai: match.field('isAdmin'),
    },
  })

  it('transform works', async () => {
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({
        id: sampleDatabaseUser.id,
        email: sampleDatabaseUser.email,
        createdAt: sampleDatabaseUser.createdAt,
        role: sampleDatabaseUser.role,
      })
    }
  })

  it('validate works', async () => {
    const result = await registry.validate(sampleDatabaseUser, 'database')
    expect(result.ok).toBe(true)
  })

  it('validate rejects invalid data', async () => {
    const result = await registry.validate({ bad: true }, 'database')
    expect(result.ok).toBe(false)
  })

  it('has works', () => {
    expect(registry.has('database')).toBe(true)
    expect(registry.has('frontend')).toBe(true)
    expect(registry.has('nonexistent')).toBe(false)
  })

  it('hasMigration works', () => {
    expect(registry.hasMigration('database', 'frontend')).toBe(true)
    expect(registry.hasMigration('database', 'ai')).toBe(true)
    expect(registry.hasMigration('ai', 'database')).toBe(false)
  })

  it('findPath works', () => {
    const path = registry.findPath('database', 'ai')
    expect(path).not.toBeNull()
    expect(path).toContain('database')
    expect(path?.at(-1)).toBe('ai')
  })

  it('findPath returns null for impossible paths', () => {
    const path = registry.findPath('ai', 'database')
    expect(path).toBeNull()
  })

  it('explain works', () => {
    const result = registry.explain('database', 'frontend')
    expect(result.from).toBe('database')
    expect(result.to).toBe('frontend')
    expect(result.path).not.toBeNull()
    expect(result.totalCost).not.toBeNull()
    expect(result.summary).toContain('database')
  })

  it('explain for no path', () => {
    const result = registry.explain('ai', 'database')
    expect(result.path).toBeNull()
    expect(result.totalCost).toBeNull()
  })
})
