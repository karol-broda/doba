import { describe, it, expect } from 'vitest'
import { createRegistry } from '../src/index.js'
import {
  userSchemas,
  userMigrations,
  sampleDatabaseUser,
  createMockSchema,
  createAsyncMockSchema,
} from './helpers.js'

describe('validate', () => {
  const registry = createRegistry({ schemas: userSchemas, migrations: userMigrations })

  it('returns ok for valid data', async () => {
    const result = await registry.validate(sampleDatabaseUser, 'database')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(sampleDatabaseUser)
      expect(result.meta.schema).toBe('database')
    }
  })

  it('returns error for invalid data', async () => {
    const result = await registry.validate({ id: 'test' }, 'database')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('validation_failed')
    }
  })

  it('returns error for unknown schema', async () => {
    // @ts-expect-error testing runtime behavior
    const result = await registry.validate({}, 'unknown')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('unknown_schema')
    }
  })

  it('returns multiple validation issues', async () => {
    const multiIssueSchema = createMockSchema<{ a: string; b: number }>((value) => {
      if (typeof value !== 'object' || value === null) {
        return { ok: false, message: 'expected object' }
      }
      return { ok: false, message: 'a must be string' }
    })

    const reg = createRegistry({
      schemas: { test: multiIssueSchema },
      migrations: {},
    })

    const result = await reg.validate('not an object', 'test')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })

  it('works with async schema validators', async () => {
    const asyncSchema = createAsyncMockSchema<{ id: string }>((v) => {
      if (typeof v === 'object' && v !== null && 'id' in v) {
        return { ok: true, value: v as { id: string } }
      }
      return { ok: false, message: 'missing id' }
    }, 5)

    const reg = createRegistry({ schemas: { test: asyncSchema }, migrations: {} })
    const ok = await reg.validate({ id: '1' }, 'test')
    expect(ok.ok).toBe(true)

    const fail = await reg.validate({}, 'test')
    expect(fail.ok).toBe(false)
  })

  it('preserves validation path info from schema issues', async () => {
    const schema = createMockSchema<{ nested: { value: string } }>((_v) => ({
      ok: false,
      message: 'value is required',
      path: ['nested', 'value'],
    }))

    const reg = createRegistry({ schemas: { test: schema }, migrations: {} })
    const result = await reg.validate({}, 'test')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0]?.meta?.['path']).toEqual(['nested', 'value'])
    }
  })
})
