import type { TransformContext } from './context.js'

// ---- internal ----

type InternalHelper = (
  value: Record<string, unknown>,
  ctx: TransformContext,
) => Record<string, unknown>

/** flattens intersections for readable IDE tooltips. */
// eslint-disable-next-line typescript-eslint/ban-types -- intentional empty intersection for type simplification
type Simplify<T> = { [K in keyof T]: T[K] } & {}

/** unwraps `() => R` factory functions to their return type. */
type ResolveDefault<V> = V extends () => infer R ? R : V

/**
 * when Target is void (not provided), returns Current as-is.
 * when Target is specified, checks for exact match and returns Target or an error type.
 */
type CheckTarget<Current, Target> = [Target] extends [void]
  ? Current
  : Exclude<keyof Current, keyof Target> extends never
    ? Current extends Target
      ? Target
      : {
          readonly __pipe_error: `missing fields: ${Exclude<keyof Target, keyof Current> & string}`
        }
    : {
        readonly __pipe_error: `extra fields: ${Exclude<keyof Current, keyof Target> & string}`
      }

// ---- builder interface ----

/**
 * type-safe migration builder. each method returns a new builder with an updated
 * output type. the builder itself is callable as a migration function.
 *
 * @example
 * ```ts
 * // basic usage:
 * 'v1->v2': pipe<V1>()
 *   .rename('userName', 'name')
 *   .add('email', 'unknown@example.com')
 * ```
 */
export interface PipeBuilder<In, Current, Target = void> {
  /** call the builder directly as a migration function. */
  (value: In, ctx: TransformContext): CheckTarget<Current, Target>

  /** rename a field. autocompletes to fields on the current shape. */
  rename<From extends string & keyof Current, To extends string>(
    from: From,
    to: To,
  ): PipeBuilder<In, Simplify<Omit<Current, From> & Record<To, Current[From]>>, Target>

  /**
   * add a field with a default value. calls `ctx.defaulted()` at runtime.
   * if the field already exists on the current shape, this is a no-op.
   * factory functions (`() => value`) are unwrapped to their return type.
   */
  add<const Name extends string, const V>(
    name: Name,
    defaultValue: V,
  ): PipeBuilder<In, Simplify<Current & Record<Name, ResolveDefault<V>>>, Target>

  /** remove one or more fields. autocompletes to fields on the current shape. */
  drop<Names extends string & keyof Current>(
    ...names: Names[]
  ): PipeBuilder<In, Simplify<Omit<Current, Names>>, Target>

  /** transform a field's value. the callback receives the field's current type. */
  map<Name extends string & keyof Current, V>(
    name: Name,
    fn: (value: Current[Name]) => V,
  ): PipeBuilder<In, Simplify<Omit<Current, Name> & Record<Name, V>>, Target>

  /**
   * assert that the current shape exactly matches the target type.
   * catches extra fields that structural typing would normally allow through.
   * purely a type-level check with no runtime cost.
   *
   * @example
   * ```ts
   * pipe<V1>()
   *   .rename('userName', 'name')
   *   .into<V2>()  // compile error if shape doesn't match V2 exactly
   * ```
   */
  into<Target extends Record<string, unknown>>(
    ...args: Exclude<keyof Current, keyof Target> extends never
      ? [Current] extends [Target]
        ? []
        : [error: 'current shape is missing fields from target']
      : [error: `extra fields: ${Exclude<keyof Current, keyof Target> & string}`]
  ): (value: In, ctx: TransformContext) => Target
}

// ---- internal helper implementations ----

function renameImpl(from: string, to: string): InternalHelper {
  return (value) => {
    if (!(from in value)) {
      return value
    }
    const { [from]: moved, ...rest } = value
    return { ...rest, [to]: moved }
  }
}

function addImpl(name: string, defaultValue: unknown): InternalHelper {
  return (value, ctx) => {
    if (name in value) {
      return value
    }
    const resolved = typeof defaultValue === 'function' ? defaultValue() : defaultValue
    ctx.defaulted([name], `added with default`)
    return { ...value, [name]: resolved }
  }
}

function dropImpl(...names: string[]): InternalHelper {
  return (value) => {
    const result = { ...value }
    for (const name of names) {
      delete result[name]
    }
    return result
  }
}

function mapImpl(name: string, fn: (value: unknown) => unknown): InternalHelper {
  return (value) => {
    if (!(name in value)) {
      return value
    }
    return { ...value, [name]: fn(value[name]) }
  }
}

// ---- builder factory ----

function createBuilder<In, Current>(steps: InternalHelper[]): PipeBuilder<In, Current> {
  const execute = function (this: void, value: Record<string, unknown>, ctx: TransformContext) {
    let current = value
    for (const step of steps) {
      current = step(current, ctx)
    }
    return current
  }

  return Object.assign(execute, {
    rename: (from: string, to: string) => createBuilder([...steps, renameImpl(from, to)]),
    add: (name: string, defaultValue: unknown) =>
      createBuilder([...steps, addImpl(name, defaultValue)]),
    drop: (...names: string[]) => createBuilder([...steps, dropImpl(...names)]),
    map: (name: string, mapFn: (v: unknown) => unknown) =>
      createBuilder([...steps, mapImpl(name, mapFn)]),
    into: () => execute,
  }) as unknown as PipeBuilder<In, Current>
}

// ---- pipe ----

/**
 * type-safe builder for composing field-level migration steps.
 * pass the input type as a type parameter. each chained method
 * returns a new builder with an updated output type.
 *
 * the builder itself is callable as a migration function.
 *
 * @example
 * ```ts
 * 'v1->v2': pipe<V1>()
 *   .rename('userName', 'name')
 *   .add('email', 'default')
 *   .drop('legacyId')
 *   .map('isAdmin', (v) => v ? 'admin' : 'user')
 * ```
 */
export function pipe<In>(): PipeBuilder<In, In> {
  return createBuilder([])
}
