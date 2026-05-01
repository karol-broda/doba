/** successful result carrying a value and metadata. */
export type ResultOk<T, M = unknown> = {
  readonly ok: true
  readonly value: T
  /** contextual metadata about the operation, e.g. {@link TransformMeta} or {@link ValidateMeta}. */
  readonly meta: M
}

/** failed result carrying issues. */
export type ResultErr<E = unknown> = {
  readonly ok: false
  readonly issues: E
}

/** discriminated union of {@link ResultOk} and {@link ResultErr}. */
export type Result<T, E = unknown, M = unknown> = ResultOk<T, M> | ResultErr<E>

/** creates a successful {@link ResultOk} with the given value and metadata. */
export function ok<T, M = undefined>(value: T, meta?: M): ResultOk<T, M> {
  return { ok: true, value, meta: meta as M }
}

/** creates a failed {@link ResultErr} with the given issues. */
export function err<E>(issues: E): ResultErr<E> {
  return { ok: false, issues }
}

/** type guard that narrows a {@link Result} to {@link ResultOk}. */
export function isOk<T, E, M>(result: Result<T, E, M>): result is ResultOk<T, M> {
  return result.ok === true
}

/** type guard that narrows a {@link Result} to {@link ResultErr}. */
export function isErr<T, E, M>(result: Result<T, E, M>): result is ResultErr<E> {
  return result.ok === false
}

/**
 * extracts the value from a {@link ResultOk}, or throws if the result is an error.
 *
 * @throws {Error} when called on a {@link ResultErr}.
 *
 * @example
 * ```ts
 * const result = await registry.validate(data, 'v1')
 * const value = unwrap(result) // throws if validation failed
 * ```
 */
export function unwrap<T, E, M>(result: Result<T, E, M>): T {
  if (result.ok === false) {
    throw new Error('unwrap called on error result')
  }
  return result.value
}

/**
 * extracts the value from a {@link ResultOk}, or returns `defaultValue` if the result is an error.
 *
 * @example
 * ```ts
 * const result = await registry.validate(data, 'v1')
 * const value = unwrapOr(result, fallback)
 * ```
 */
export function unwrapOr<T, E, M>(result: Result<T, E, M>, defaultValue: T): T {
  if (result.ok === false) {
    return defaultValue
  }
  return result.value
}

/**
 * transforms the value inside a {@link ResultOk}, passing errors through unchanged.
 *
 * @example
 * ```ts
 * const result = await registry.validate(data, 'v1')
 * const ids = map(result, (user) => user.id)
 * ```
 */
export function map<T, U, E, M>(result: Result<T, E, M>, fn: (value: T) => U): Result<U, E, M> {
  if (result.ok === false) {
    return result
  }
  return ok(fn(result.value), result.meta)
}

/** transforms the issues inside a {@link ResultErr}, passing successes through unchanged. */
export function mapErr<T, E, F, M>(result: Result<T, E, M>, fn: (issues: E) => F): Result<T, F, M> {
  if (result.ok === true) {
    return result
  }
  return err(fn(result.issues))
}
