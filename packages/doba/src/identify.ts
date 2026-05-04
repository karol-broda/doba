/** a predicate that tests whether an unknown value belongs to a particular schema. */
export type IdentifyGuard = (value: unknown) => boolean

/** sentinel type marking a schema for identification via validation (tryParse). */
export type TryParse = typeof tryParse

/** sentinel value: when used as an identify guard, doba validates the value against the schema. */
export const tryParse: unique symbol = Symbol.for('doba.tryParse')

// ---- match chain ----

/** chainable predicate builder. each method adds an AND condition. the result is callable as an {@link IdentifyGuard}. */
export interface Matcher {
  /** call the matcher directly as a guard. */
  (value: unknown): boolean

  /** check that `field` exists on the value. if `expected` is provided, also check equality. */
  field(name: string, expected?: unknown): Matcher

  /** check that all `names` exist on the value. */
  fields(...names: string[]): Matcher

  /** check `typeof value === type`. */
  type(type: string): Matcher

  /** add an arbitrary predicate. */
  test(fn: (value: unknown) => boolean): Matcher
}

type Predicate = (value: unknown) => boolean

function isObj(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function createMatcher(predicates: readonly Predicate[]): Matcher {
  const execute = function (this: void, value: unknown): boolean {
    for (const pred of predicates) {
      if (!pred(value)) {
        return false
      }
    }
    return true
  }

  return Object.assign(execute, {
    field(name: string, expected?: unknown): Matcher {
      const pred: Predicate =
        arguments.length >= 2
          ? (v) => isObj(v) && name in v && v[name] === expected
          : (v) => isObj(v) && name in v
      return createMatcher([...predicates, pred])
    },
    fields(...names: string[]): Matcher {
      const pred: Predicate = (v) => {
        if (!isObj(v)) {
          return false
        }
        for (const n of names) {
          if (!(n in v)) {
            return false
          }
        }
        return true
      }
      return createMatcher([...predicates, pred])
    },
    type(t: string): Matcher {
      return createMatcher([...predicates, (v) => typeof v === t])
    },
    test(fn: (value: unknown) => boolean): Matcher {
      return createMatcher([...predicates, fn])
    },
  }) as Matcher
}

/** entry point for building chainable identify guards. */
export const match: Matcher = createMatcher([])

// ---- byField helper ----

type ByFieldOptions =
  | { prefix?: string; suffix?: string; map?: never }
  | { map: Record<string, string>; prefix?: never; suffix?: never }

/**
 * creates an identify function that reads a field from the value and maps it to a schema key.
 *
 * @example
 * ```ts
 * // value.version matches schema key directly
 * identify: byField('version')
 *
 * // value.version = "2" -> "v2"
 * identify: byField('version', { prefix: 'v' })
 *
 * // explicit mapping
 * identify: byField('type', { map: { UserDB: 'database' } })
 * ```
 */
export function byField(
  field: string,
  options?: ByFieldOptions,
): (value: unknown) => string | null {
  if (options?.map !== undefined) {
    const mapping = options.map
    return (value: unknown) => {
      if (!isObj(value) || !(field in value)) {
        return null
      }
      const raw = String(value[field])
      return mapping[raw] ?? null
    }
  }

  const prefix = options?.prefix ?? ''
  const suffix = options?.suffix ?? ''

  if (prefix === '' && suffix === '') {
    return (value: unknown) => {
      if (!isObj(value) || !(field in value)) {
        return null
      }
      return String(value[field])
    }
  }

  return (value: unknown) => {
    if (!isObj(value) || !(field in value)) {
      return null
    }
    return `${prefix}${String(value[field])}${suffix}`
  }
}

// ---- firstMatch helper ----

/**
 * composes multiple identify functions. returns the first non-null result.
 *
 * @example
 * ```ts
 * identify: firstMatch(
 *   byField('_tag'),
 *   (v) => typeof v === 'string' ? 'name' : null,
 * )
 * ```
 */
export function firstMatch(
  ...fns: readonly ((value: unknown) => string | null)[]
): (value: unknown) => string | null {
  return (value: unknown) => {
    for (const fn of fns) {
      const result = fn(value)
      if (result !== null) {
        return result
      }
    }
    return null
  }
}
