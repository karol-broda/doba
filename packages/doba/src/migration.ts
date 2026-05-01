import type { InferOutput } from './standard-schema.js'
import type { SchemaMap, SchemaKeys } from './schema.js'
import type { TransformContext } from './context.js'
import { pipe as createPipe, type PipeBuilder } from './helpers.js'

/**
 * function that transforms a value from one schema to another.
 * receives a {@link TransformContext} for emitting warnings and recording defaults.
 */
export type MigrationFn<
  FromValue,
  ToValue,
  Keys extends string = string,
  FromKey extends Keys = Keys,
  ToKey extends Keys = Keys,
> = (value: FromValue, ctx: TransformContext<Keys, FromKey, ToKey>) => ToValue | Promise<ToValue>

/** optional metadata for a migration, controlling path resolution and deprecation. */
export type MigrationMetadata = {
  /**
   * marks the migration as deprecated. `true` or a string with the reason.
   * @default false
   */
  readonly deprecated?: string | boolean
  /**
   * sets cost to {@link PREFERRED_COST} (0), making this path favored by the graph.
   * @default false
   */
  readonly preferred?: boolean
  /**
   * explicit edge cost for weighted path resolution. overrides `preferred` and `deprecated` costs.
   * @default 1
   */
  readonly cost?: number
  /** human-readable label for this migration step, included in {@link StepInfo}. */
  readonly label?: string
}

/**
 * pipe-based migration definition. uses a {@link PipeBuilder} callback whose
 * input and output types are inferred from the schema map, so no manual
 * generics are needed.
 *
 * @example
 * ```ts
 * 'v1->v2': {
 *   pipe: (p) => p.rename('userName', 'name').add('email', 'default'),
 *   label: 'rename and add email',
 * }
 * ```
 */
export type PipeMigrationDef<
  FromValue,
  ToValue,
  Keys extends string = string,
  FromKey extends Keys = Keys,
  ToKey extends Keys = Keys,
> = MigrationMetadata & {
  readonly pipe: (
    builder: PipeBuilder<FromValue, FromValue, ToValue>,
  ) => MigrationFn<FromValue, ToValue, Keys, FromKey, ToKey>
}

/**
 * one-way migration definition. can be a bare {@link MigrationFn},
 * an object with a `migrate` function and {@link MigrationMetadata},
 * or an object with a `pipe` callback and {@link MigrationMetadata}.
 *
 * @example
 * ```ts
 * // bare function
 * 'v1->v2': (value) => ({ ...value, newField: 'default' })
 *
 * // with metadata
 * 'v1->v2': {
 *   migrate: (value) => ({ ...value, newField: 'default' }),
 *   label: 'add newField',
 *   deprecated: 'use v1->v3 instead',
 * }
 *
 * // pipe builder (types inferred from registry schemas)
 * 'v1->v2': {
 *   pipe: (p) => p.rename('userName', 'name').add('email', 'default'),
 * }
 * ```
 */
export type MigrationDef<
  FromValue,
  ToValue,
  Keys extends string = string,
  FromKey extends Keys = Keys,
  ToKey extends Keys = Keys,
> =
  | MigrationFn<FromValue, ToValue, Keys, FromKey, ToKey>
  | (MigrationMetadata & {
      readonly migrate: MigrationFn<FromValue, ToValue, Keys, FromKey, ToKey>
    })
  | PipeMigrationDef<FromValue, ToValue, Keys, FromKey, ToKey>

/**
 * bidirectional migration with `forward` and `backward` functions.
 * registers both directions from a single `"a<->b"` key.
 *
 * @example
 * ```ts
 * 'celsius<->fahrenheit': {
 *   forward: (c) => ({ value: c.value * 9/5 + 32 }),
 *   backward: (f) => ({ value: (f.value - 32) * 5/9 }),
 * }
 * ```
 */
export type ReversibleMigrationDef<
  FromValue,
  ToValue,
  Keys extends string = string,
  FromKey extends Keys = Keys,
  ToKey extends Keys = Keys,
> = MigrationMetadata & {
  readonly forward: MigrationFn<FromValue, ToValue, Keys, FromKey, ToKey>
  readonly backward: MigrationFn<ToValue, FromValue, Keys, ToKey, FromKey>
}

/** template literal type for one-way migration keys, e.g. `"v1->v2"`. */
export type MigrationKey<From extends string, To extends string> = `${From}->${To}`

/** template literal type for reversible migration keys, e.g. `"v1<->v2"`. */
export type ReversibleMigrationKey<From extends string, To extends string> = `${From}<->${To}`

/** union of all valid migration key patterns for a set of schema keys. */
export type PossibleMigrationKeys<Keys extends string> = `${Keys}->${Keys}` | `${Keys}<->${Keys}`

/**
 * fully typed migrations object for a {@link SchemaMap}.
 * keys are migration patterns like `"v1->v2"` or `"v1<->v2"`,
 * values are the corresponding {@link MigrationDef} or {@link ReversibleMigrationDef}.
 */
export type MigrationsFor<Schemas extends SchemaMap> = {
  [K in PossibleMigrationKeys<
    SchemaKeys<Schemas>
  >]?: K extends `${infer From extends SchemaKeys<Schemas>}<->${infer To extends SchemaKeys<Schemas>}`
    ? ReversibleMigrationDef<
        InferOutput<Schemas[From]>,
        InferOutput<Schemas[To]>,
        SchemaKeys<Schemas>,
        From,
        To
      >
    : K extends `${infer From extends SchemaKeys<Schemas>}->${infer To extends SchemaKeys<Schemas>}`
      ? MigrationDef<
          InferOutput<Schemas[From]>,
          InferOutput<Schemas[To]>,
          SchemaKeys<Schemas>,
          From,
          To
        >
      : never
}

/** default edge cost for migrations with no explicit cost, preferred, or deprecated flags. */
export const DEFAULT_COST = 1
/** edge cost assigned when {@link MigrationMetadata.preferred} is `true`. */
export const PREFERRED_COST = 0
/** edge cost assigned when a migration is deprecated, making the graph avoid it. */
export const DEPRECATED_COST = 1000

export type MigrationFunction = (value: unknown, ctx: unknown) => unknown
export type ResolvedMigration = {
  readonly fn: MigrationFunction
  readonly cost: number
  readonly deprecated: string | false
  readonly label: string | undefined
  readonly source: string
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function extractMetadata(obj: Record<string, unknown>): {
  readonly cost: number
  readonly deprecated: string | false
  readonly label: string | undefined
} {
  const { deprecated, preferred, cost, label } = obj

  let resolvedDeprecated: string | false = false
  if (deprecated === true) {
    resolvedDeprecated = 'deprecated'
  } else if (typeof deprecated === 'string') {
    resolvedDeprecated = deprecated
  }

  let resolvedCost: number = DEFAULT_COST
  if (typeof cost === 'number') {
    resolvedCost = cost
  } else if (preferred === true) {
    resolvedCost = PREFERRED_COST
  } else if (resolvedDeprecated !== false) {
    resolvedCost = DEPRECATED_COST
  }

  return {
    cost: resolvedCost,
    deprecated: resolvedDeprecated,
    label: typeof label === 'string' ? label : undefined,
  }
}

export type MigrationWarning = {
  readonly from: string
  readonly to: string
  readonly message: string
}

function registerEdge(
  resolved: Map<string, ResolvedMigration>,
  sources: Map<string, string>,
  warnings: MigrationWarning[],
  edgeKey: string,
  sourceKey: string,
  migration: ResolvedMigration,
): void {
  const existing = sources.get(edgeKey)
  if (existing !== undefined) {
    const isExistingReversible = existing.includes('<->')
    const isNewReversible = sourceKey.includes('<->')

    const arrowIdx = edgeKey.indexOf('->')
    const from = edgeKey.slice(0, arrowIdx)
    const to = edgeKey.slice(arrowIdx + 2)

    if (isExistingReversible && !isNewReversible) {
      // explicit one-way overrides reversible
      warnings.push({
        from,
        to,
        message: `"${sourceKey}" overrides "${existing}" for edge "${edgeKey}"`,
      })
      resolved.set(edgeKey, migration)
      sources.set(edgeKey, sourceKey)
    } else if (!isExistingReversible && isNewReversible) {
      // reversible yields to existing explicit one-way
      warnings.push({
        from,
        to,
        message: `"${existing}" takes precedence over "${sourceKey}" for edge "${edgeKey}"`,
      })
    } else {
      // same kind (two one-ways or two reversibles)
      throw new Error(
        `Migration conflict: "${edgeKey}" is defined by both "${existing}" and "${sourceKey}"`,
      )
    }
    return
  }
  resolved.set(edgeKey, migration)
  sources.set(edgeKey, sourceKey)
}

function typedEntries(obj: object): readonly [string, unknown][] {
  return Object.entries(obj)
}

export type ResolveMigrationsResult = {
  readonly migrations: Map<string, ResolvedMigration>
  readonly warnings: readonly MigrationWarning[]
}

export function resolveMigrations(migrations: object): ResolveMigrationsResult {
  const resolved = new Map<string, ResolvedMigration>()
  const sources = new Map<string, string>()
  const warnings: MigrationWarning[] = []

  for (const [key, def] of typedEntries(migrations)) {
    if (def === undefined) {
      continue
    }

    const reversibleIdx = key.indexOf('<->')
    if (reversibleIdx !== -1) {
      if (!isObject(def) || !('forward' in def) || !('backward' in def)) {
        continue
      }

      const from = key.slice(0, reversibleIdx)
      const to = key.slice(reversibleIdx + 3)
      if (from.length === 0 || to.length === 0) {
        continue
      }

      const meta = extractMetadata(def)
      const base = { ...meta, source: key }

      const { forward } = def
      const { backward } = def
      if (typeof forward !== 'function' || typeof backward !== 'function') {
        continue
      }

      registerEdge(resolved, sources, warnings, `${from}->${to}`, key, {
        ...base,
        fn: forward as MigrationFunction,
      })
      registerEdge(resolved, sources, warnings, `${to}->${from}`, key, {
        ...base,
        fn: backward as MigrationFunction,
      })
      continue
    }

    const arrowIdx = key.indexOf('->')
    if (arrowIdx === -1) {
      continue
    }

    const from = key.slice(0, arrowIdx)
    const to = key.slice(arrowIdx + 2)
    if (from.length === 0 || to.length === 0) {
      continue
    }

    if (typeof def === 'function') {
      registerEdge(resolved, sources, warnings, `${from}->${to}`, key, {
        fn: def as MigrationFunction,
        cost: DEFAULT_COST,
        deprecated: false,
        label: undefined,
        source: key,
      })
    } else if (isObject(def) && 'pipe' in def) {
      const { pipe: pipeFn } = def
      if (typeof pipeFn !== 'function') {
        continue
      }
      const migrationFn = pipeFn(createPipe()) as MigrationFunction
      if (typeof migrationFn !== 'function') {
        continue
      }
      const meta = extractMetadata(def)
      registerEdge(resolved, sources, warnings, `${from}->${to}`, key, {
        ...meta,
        fn: migrationFn,
        source: key,
      })
    } else if (isObject(def) && 'migrate' in def) {
      const { migrate } = def
      if (typeof migrate !== 'function') {
        continue
      }
      const meta = extractMetadata(def)
      registerEdge(resolved, sources, warnings, `${from}->${to}`, key, {
        ...meta,
        fn: migrate as MigrationFunction,
        source: key,
      })
    }
  }

  return { migrations: resolved, warnings }
}
