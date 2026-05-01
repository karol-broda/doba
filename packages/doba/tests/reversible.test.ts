import { describe, it, expect } from 'vitest'
import { createRegistry } from '../src/index.js'
import {
  userSchemas,
  sampleDatabaseUser,
  sampleFrontendUser,
  createMockSchema,
  type DatabaseUser,
  type FrontendUser,
} from './helpers.js'

function makeReversibleRegistry(extra?: {
  deprecated?: string | boolean
  label?: string
  preferred?: boolean
  cost?: number
}) {
  return createRegistry({
    schemas: userSchemas,
    migrations: {
      'database<->frontend': {
        forward: (user: DatabaseUser) => ({
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          role: user.role,
        }),
        backward: (user: FrontendUser) => ({
          id: user.id,
          email: user.email,
          passwordHash: '',
          createdAt: user.createdAt,
          role: user.role,
        }),
        ...extra,
      },
      'frontend->ai': (user: FrontendUser) => ({
        id: user.id,
        email: user.email,
        isAdmin: user.role === 'admin',
      }),
    },
  })
}

describe('reversible migrations', () => {
  it('registers both forward and backward', () => {
    const registry = makeReversibleRegistry()
    expect(registry.hasMigration('database', 'frontend')).toBe(true)
    expect(registry.hasMigration('frontend', 'database')).toBe(true)
  })

  it('transforms forward', async () => {
    const registry = makeReversibleRegistry()
    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.id).toBe('user-123')
      expect('passwordHash' in result.value).toBe(false)
    }
  })

  it('transforms backward', async () => {
    const registry = makeReversibleRegistry()
    const result = await registry.transform(sampleFrontendUser, 'frontend', 'database')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.passwordHash).toBe('')
    }
  })

  it('uses reversible in multi-step path', async () => {
    const registry = makeReversibleRegistry()
    const result = await registry.transform(sampleDatabaseUser, 'database', 'ai')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.path).toEqual(['database', 'frontend', 'ai'])
    }
  })

  it('applies label to both directions', async () => {
    const registry = makeReversibleRegistry({ label: 'sync' })

    const fwd = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(fwd.ok && fwd.meta.steps[0]?.label).toBe('sync')

    const bwd = await registry.transform(sampleFrontendUser, 'frontend', 'database')
    expect(bwd.ok && bwd.meta.steps[0]?.label).toBe('sync')
  })

  it('applies deprecated to both directions', async () => {
    const registry = makeReversibleRegistry({ deprecated: 'use v2' })

    const fwd = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(fwd.ok).toBe(true)
    if (fwd.ok) {
      expect(fwd.meta.steps[0]?.deprecated).toBe('use v2')
      expect(fwd.meta.warnings.some((w) => w.message.includes('deprecated'))).toBe(true)
    }

    const bwd = await registry.transform(sampleFrontendUser, 'frontend', 'database')
    expect(bwd.ok).toBe(true)
    if (bwd.ok) {
      expect(bwd.meta.steps[0]?.deprecated).toBe('use v2')
    }
  })

  it('applies preferred cost to both directions', () => {
    const registry = makeReversibleRegistry({ preferred: true })
    const fwdPath = registry.findPath('database', 'frontend')
    const bwdPath = registry.findPath('frontend', 'database')
    expect(fwdPath).toEqual(['database', 'frontend'])
    expect(bwdPath).toEqual(['frontend', 'database'])
  })

  it('works with async forward/backward', async () => {
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database<->frontend': {
          forward: async (user: DatabaseUser) => {
            // oxlint-disable-next-line no-promise-executor-return -- intentional delay for async test
            await new Promise((r) => setTimeout(r, 5))
            return { id: user.id, email: user.email, createdAt: user.createdAt, role: user.role }
          },
          backward: async (user: FrontendUser) => {
            // oxlint-disable-next-line no-promise-executor-return -- intentional delay for async test
            await new Promise((r) => setTimeout(r, 5))
            return {
              id: user.id,
              email: user.email,
              passwordHash: '',
              createdAt: user.createdAt,
              role: user.role,
            }
          },
        },
      },
    })

    const fwd = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(fwd.ok).toBe(true)

    const bwd = await registry.transform(sampleFrontendUser, 'frontend', 'database')
    expect(bwd.ok).toBe(true)
  })
})

describe('one-way overrides reversible', () => {
  it('explicit one-way takes precedence over reversible forward', async () => {
    const warnings: string[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'database->frontend': (user) => ({
          id: user.id,
          email: `${user.email}-explicit`,
          createdAt: user.createdAt,
          role: user.role,
        }),
        'database<->frontend': {
          forward: (user) => ({
            id: user.id,
            email: `${user.email}-reversible`,
            createdAt: user.createdAt,
            role: user.role,
          }),
          backward: (user) => ({
            id: user.id,
            email: user.email,
            passwordHash: '',
            createdAt: user.createdAt,
            role: user.role,
          }),
        },
      },
      hooks: { onWarning: (msg) => warnings.push(msg) },
    })

    const result = await registry.transform(sampleDatabaseUser, 'database', 'frontend')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.email).toContain('-explicit')
    }
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('takes precedence')
  })

  it('explicit one-way takes precedence over reversible backward', async () => {
    const warnings: string[] = []
    const registry = createRegistry({
      schemas: userSchemas,
      migrations: {
        'frontend->database': (user) => ({
          id: user.id,
          email: `${user.email}-explicit`,
          passwordHash: '',
          createdAt: user.createdAt,
          role: user.role,
        }),
        'database<->frontend': {
          forward: (user) => ({
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            role: user.role,
          }),
          backward: (user) => ({
            id: user.id,
            email: `${user.email}-reversible`,
            passwordHash: '',
            createdAt: user.createdAt,
            role: user.role,
          }),
        },
      },
      hooks: { onWarning: (msg) => warnings.push(msg) },
    })

    const result = await registry.transform(sampleFrontendUser, 'frontend', 'database')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.email).toContain('-explicit')
    }
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('still throws when two reversibles overlap (same kind)', () => {
    type V = { val: number }
    const schema = createMockSchema<V>((v) => ({ ok: true, value: v as V }))

    expect(() =>
      createRegistry({
        schemas: { a: schema, b: schema, c: schema },
        migrations: {
          'a<->c': { forward: (v) => v, backward: (v) => v },
          'c<->a': { forward: (v) => v, backward: (v) => v },
        },
      }),
    ).toThrow(/Migration conflict/)
  })
})
