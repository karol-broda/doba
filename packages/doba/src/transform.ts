import { type Result, ok, err } from './result.js'
import { type DobaIssue, createIssue } from './issue.js'
import type { StandardSchemaV1 } from './standard-schema.js'
import type { WarningInfo, DefaultedInfo } from './context.js'

/**
 * strategy for resolving migration paths between schemas.
 * - `'shortest'` finds the optimal path through the migration graph.
 * - `'direct'` only uses a direct migration between two schemas (no intermediaries).
 */
export type PathStrategy = 'direct' | 'shortest'

/** metadata about a single step in a migration path. */
export type StepInfo<Keys extends string = string> = {
  readonly from: Keys
  readonly to: Keys
  /** label from {@link MigrationMetadata}, if provided. */
  readonly label?: string | undefined
  /** present when the step uses a deprecated migration. */
  readonly deprecated?: string | boolean | undefined
}

/** metadata attached to a successful transform, describing the path taken and any side effects. */
export type TransformMeta<Keys extends string = string> = {
  /** ordered list of schema keys traversed, e.g. `['v1', 'v2', 'v3']`. */
  readonly path: readonly Keys[]
  /** per-step metadata for each migration that was executed. */
  readonly steps: readonly StepInfo<Keys>[]
  /** warnings emitted by migration functions or from deprecated steps. */
  readonly warnings: readonly WarningInfo<Keys>[]
  /** fields that were filled with default values during migration. */
  readonly defaults: readonly DefaultedInfo<Keys>[]
}

/** result of {@link Registry.transform}, carrying the transformed value or {@link DobaIssue}s. */
export type TransformResult<T, Keys extends string = string> = Result<
  T,
  readonly DobaIssue[],
  TransformMeta<Keys>
>

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
  const result = schema['~standard'].validate(value)
  const resolved = result instanceof Promise ? await result : result

  if (resolved.issues !== undefined) {
    const issues: DobaIssue[] = resolved.issues.map((issue) => {
      const path = issue.path?.map((p) =>
        typeof p === 'object' && p !== null && 'key' in p ? p.key : p,
      )
      return createIssue(
        'validation_failed',
        issue.message,
        path === undefined ? undefined : { path },
      )
    })
    return err(issues)
  }

  return ok(resolved.value, { schema: schemaKey })
}
