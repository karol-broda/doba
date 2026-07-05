import { type Result, ok, err } from './result.js'
import { type DobaIssue, createIssue } from './issue.js'
import type { StandardSchemaV1 } from './standard-schema.js'
import type { WarningInfo, DefaultedInfo } from './context.js'

/**
 * detects real Promises *and* thenables. `instanceof Promise` misses values
 * returned by libraries that produce promise-like objects without using the
 * global Promise constructor (Effect, some zod configs, custom async adapters).
 */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

/**
 * strategy for resolving migration paths between schemas.
 * - `'shortest'` finds the optimal path through the migration graph.
 * - `'direct'` only uses a direct migration between two schemas (no intermediaries).
 */
export type PathStrategy = 'direct' | 'shortest'

/** narrows `T` by excluding `U`, but falls back to `T` when the result would be `never`. */
export type NarrowExclude<T extends string, U extends string> = [Exclude<T, U>] extends [never]
  ? T
  : Exclude<T, U>

/** metadata about a single step in a migration path. */
export type StepInfo<FromKey extends string = string, ToKey extends string = FromKey> = {
  readonly from: FromKey
  readonly to: ToKey
  /** label from {@link MigrationMetadata}, if provided. */
  readonly label?: string | undefined
  /** present when the step uses a deprecated migration. */
  readonly deprecated?: string | boolean | undefined
}

/** metadata attached to a successful transform, describing the path taken and any side effects. */
export type TransformMeta<
  Keys extends string = string,
  From extends string = Keys,
  To extends string = Keys,
> = {
  /** ordered list of schema keys traversed, e.g. `['v1', 'v2', 'v3']`. */
  readonly path: readonly Keys[]
  /** per-step metadata for each migration that was executed. */
  readonly steps: readonly StepInfo<NarrowExclude<Keys, To>, NarrowExclude<Keys, From>>[]
  /** warnings emitted by migration functions or from deprecated steps. */
  readonly warnings: readonly WarningInfo<NarrowExclude<Keys, To>, NarrowExclude<Keys, From>>[]
  /** fields that were filled with default values during migration. */
  readonly defaults: readonly DefaultedInfo<NarrowExclude<Keys, To>, NarrowExclude<Keys, From>>[]
}

/** result of {@link Registry.transform}, carrying the transformed value or {@link DobaIssue}s. */
export type TransformResult<
  T,
  Keys extends string = string,
  From extends string = Keys,
  To extends string = Keys,
> = Result<T, readonly DobaIssue[], TransformMeta<Keys, From, To>>

/** metadata attached to a successful validation, recording which schema was used. */
export type ValidateMeta<Key extends string = string> = {
  readonly schema: Key
}

/** result of {@link Registry.validate}, carrying the validated value or {@link DobaIssue}s. */
export type ValidateResult<T, Key extends string = string> = Result<
  T,
  readonly DobaIssue[],
  ValidateMeta<Key>
>

/** options for {@link Registry.transform}. */
export type TransformOptions<Keys extends string> = {
  /** explicit migration path to follow instead of auto-resolving. */
  readonly path?: readonly Keys[] | undefined
  /** overrides the registry-level {@link PathStrategy} for this call. */
  readonly pathStrategy?: PathStrategy | undefined
  /**
   * when to validate data against schemas during the transform.
   * - `'end'` (default) validates only the final output.
   * - `'each'` validates after every intermediate step.
   * - `'none'` skips validation entirely.
   *
   * @default 'end'
   */
  readonly validate?: 'none' | 'end' | 'each' | undefined
  /** when using an explicit `path`, validates that every step has a registered migration. */
  readonly validatePath?: boolean | undefined
}

export async function validateWithSchema<T, Key extends string>(
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
  schemaKey: Key,
): Promise<ValidateResult<T, Key>> {
  let result: unknown
  try {
    result = schema['~standard'].validate(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return err([createIssue('validation_failed', `schema "${schemaKey}" threw: ${message}`)])
  }

  const resolved = isThenable(result) ? await result : result

  if (resolved !== null && typeof resolved === 'object' && 'issues' in resolved) {
    const rawIssues = (resolved as { issues?: unknown }).issues
    if (rawIssues !== undefined) {
      if (!Array.isArray(rawIssues)) {
        return err([
          createIssue('validation_failed', `schema "${schemaKey}" returned non-array issues`),
        ])
      }
      const issues: DobaIssue[] = rawIssues.map((issue) => {
        const issueObj = issue as { message?: string; path?: readonly unknown[] }
        const path = issueObj.path?.map((p) =>
          typeof p === 'object' && p !== null && 'key' in p ? (p as { key: unknown }).key : p,
        )
        return createIssue(
          'validation_failed',
          issueObj.message ?? 'validation failed',
          path === undefined ? undefined : { path },
        )
      })
      return err(issues)
    }
  }

  if (resolved !== null && typeof resolved === 'object' && 'value' in resolved) {
    return ok((resolved as { value: T }).value, { schema: schemaKey })
  }

  // malformed result (no value, no issues): treat as a validation failure
  // rather than silently succeeding with undefined.
  return err([
    createIssue(
      'validation_failed',
      `schema "${schemaKey}" returned a malformed result (no "value" or "issues" field)`,
    ),
  ])
}
