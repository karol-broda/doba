import { describe, it, expect } from 'vitest'
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr } from '../src/result-entry.js'

describe('result utilities', () => {
  describe('ok', () => {
    it('creates ok result with value and meta', () => {
      const result = ok('value', { extra: 'data' })
      expect(result.ok).toBe(true)
      expect(result.value).toBe('value')
      expect(result.meta).toEqual({ extra: 'data' })
    })

    it('handles undefined meta', () => {
      const result = ok(42)
      expect(result.ok).toBe(true)
      expect(result.value).toBe(42)
      expect(result.meta).toBeUndefined()
    })

    it('handles complex value types', () => {
      const value = { nested: { data: [1, 2, 3] } }
      const result = ok(value, null)
      expect(result.value).toEqual(value)
    })
  })

  describe('err', () => {
    it('creates err result with issues', () => {
      const result = err(['issue1', 'issue2'])
      expect(result.ok).toBe(false)
      expect(result.issues).toEqual(['issue1', 'issue2'])
    })

    it('handles single issue', () => {
      const result = err('single error')
      expect(result.ok).toBe(false)
      expect(result.issues).toBe('single error')
    })

    it('handles complex error types', () => {
      const issues = [{ code: 'ERR_001', message: 'something went wrong' }]
      const result = err(issues)
      expect(result.issues).toEqual(issues)
    })
  })

  describe('isOk', () => {
    it('returns true for ok result', () => {
      const result = ok('value')
      expect(isOk(result)).toBe(true)
    })

    it('returns false for err result', () => {
      const result = err('error')
      expect(isOk(result)).toBe(false)
    })

    it('narrows type correctly', () => {
      const result = ok(42, 'meta') as
        | ReturnType<typeof ok<number, string>>
        | ReturnType<typeof err<string>>
      if (isOk(result)) {
        // typescript should know result.value is number here
        const _value: number = result.value
        expect(_value).toBe(42)
      }
    })
  })

  describe('isErr', () => {
    it('returns true for err result', () => {
      const result = err('error')
      expect(isErr(result)).toBe(true)
    })

    it('returns false for ok result', () => {
      const result = ok('value')
      expect(isErr(result)).toBe(false)
    })

    it('narrows type correctly', () => {
      const result = err('error message') as
        | ReturnType<typeof ok<number, string>>
        | ReturnType<typeof err<string>>
      if (isErr(result)) {
        // typescript should know result.issues is string here
        const _issues: string = result.issues
        expect(_issues).toBe('error message')
      }
    })
  })

  describe('unwrap', () => {
    it('returns value for ok result', () => {
      const result = ok('hello')
      expect(unwrap(result)).toBe('hello')
    })

    it('throws on err result', () => {
      const result = err('error message')
      expect(() => unwrap(result)).toThrow()
    })
  })

  describe('unwrapOr', () => {
    it('returns value for ok result', () => {
      const result = ok('actual')
      expect(unwrapOr(result, 'default')).toBe('actual')
    })

    it('returns default for err result', () => {
      const result = err('error')
      expect(unwrapOr(result, 'default')).toBe('default')
    })

    it('handles null default', () => {
      const result = err('error')
      expect(unwrapOr(result, null)).toBe(null)
    })
  })

  describe('map', () => {
    it('transforms value of ok result', () => {
      const result = ok(5, 'meta')
      const mapped = map(result, (n) => n * 2)

      expect(mapped.ok).toBe(true)
      if (mapped.ok === true) {
        expect(mapped.value).toBe(10)
        expect(mapped.meta).toBe('meta')
      }
    })

    it('passes through err result unchanged', () => {
      const result = err('error')
      const mapped = map(result, (n: number) => n * 2)

      expect(mapped.ok).toBe(false)
      if (mapped.ok === false) {
        expect(mapped.issues).toBe('error')
      }
    })

    it('preserves meta through mapping', () => {
      const result = ok({ x: 1 }, { tracked: true })
      const mapped = map(result, (obj) => obj.x + 10)

      expect(mapped.ok).toBe(true)
      if (mapped.ok === true) {
        expect(mapped.value).toBe(11)
        expect(mapped.meta).toEqual({ tracked: true })
      }
    })

    it('supports type transformation', () => {
      const result = ok(42)
      const mapped = map(result, (n) => `number: ${n}`)

      expect(mapped.ok).toBe(true)
      if (mapped.ok === true) {
        expect(mapped.value).toBe('number: 42')
      }
    })
  })

  describe('mapErr', () => {
    it('transforms error of err result', () => {
      const result = err('original error')
      const mapped = mapErr(result, (e) => ({ wrapped: e }))

      expect(mapped.ok).toBe(false)
      if (mapped.ok === false) {
        expect(mapped.issues).toEqual({ wrapped: 'original error' })
      }
    })

    it('passes through ok result unchanged', () => {
      const result = ok(42, 'meta')
      const mapped = mapErr(result, (e: string) => ({ wrapped: e }))

      expect(mapped.ok).toBe(true)
      if (mapped.ok === true) {
        expect(mapped.value).toBe(42)
        expect(mapped.meta).toBe('meta')
      }
    })

    it('supports error type transformation', () => {
      const result = err({ code: 404, msg: 'not found' })
      const mapped = mapErr(result, (e) => `Error ${e.code}: ${e.msg}`)

      expect(mapped.ok).toBe(false)
      if (mapped.ok === false) {
        expect(mapped.issues).toBe('Error 404: not found')
      }
    })
  })
})
