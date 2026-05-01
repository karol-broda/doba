import type { SchemaMap, SchemaKeys } from './schema.js'
import type { InferOutput } from './standard-schema.js'
import {
  type MigrationsFor,
  type ResolvedMigration,
  resolveMigrations,
  DEFAULT_COST,
} from './migration.js'
import {
  type Edge,
  type Graph,
  findPathBFS,
  findPathDijkstra,
  reachableFrom,
  reverseGraph,
} from './graph.js'

import { ok, err } from './result.js'
import { createIssue } from './issue.js'
import { createTransformState, createTransformContext } from './context.js'
import {
  type PathStrategy,
  type StepInfo,
  type TransformMeta,
  type TransformResult,
  type TransformOptions,
  type ValidateResult,
  validateWithSchema,
} from './transform.js'

/** information passed to the {@link RegistryHooks.onTransform} hook. */
export type TransformHookInfo<Keys extends string = string> = {
  readonly from: Keys
  readonly to: Keys
  readonly path: readonly Keys[] | null
  readonly durationMs: number
  readonly ok: boolean
}

/** information passed to the {@link RegistryHooks.onStep} hook. */
export type StepHookInfo<Keys extends string = string> = {
  readonly from: Keys
  readonly to: Keys
  readonly index: number
  readonly total: number
  readonly label?: string | undefined
  readonly durationMs: number
  readonly ok: boolean
}

/** metadata about a single step in an {@link ExplainResult}. */
export type ExplainStep<Keys extends string = string> = {
  readonly from: Keys
  readonly to: Keys
  readonly cost: number
  readonly label?: string | undefined
  readonly deprecated?: string | boolean | undefined
}

/** result of {@link Registry.explain}, describing the migration path and its characteristics. */
export type ExplainResult<Keys extends string = string> = {
  readonly from: Keys
  readonly to: Keys
  readonly path: readonly Keys[] | null
  readonly totalCost: number | null
  readonly steps: readonly ExplainStep<Keys>[]
  readonly summary: string
}

/** lifecycle hooks for a {@link Registry}. */
export type RegistryHooks<Keys extends string = string> = {
  /** called when a warning is emitted during migration resolution or transform execution. */
  readonly onWarning?: ((message: string, from: Keys, to: Keys) => void) | undefined
  /** called when a transform completes (success or failure). */
  readonly onTransform?: ((info: TransformHookInfo<Keys>) => void) | undefined
  /** called after each migration step completes (success or failure). */
  readonly onStep?: ((info: StepHookInfo<Keys>) => void) | undefined
}

/** configuration for {@link createRegistry}. */
export type RegistryConfig<Schemas extends SchemaMap> = {
  /** map of schema names to {@link StandardSchemaV1} instances. */
  readonly schemas: Schemas
  /** migration definitions keyed by `"from->to"` or `"from<->to"` patterns. */
  readonly migrations: MigrationsFor<Schemas>
  /** defaults to `'shortest'`. */
  readonly pathStrategy?: PathStrategy | undefined
  readonly hooks?: RegistryHooks<SchemaKeys<Schemas>> | undefined
  /**
   * enables built-in console logging for all lifecycle hooks.
   * user-provided hooks still fire alongside the debug output.
   * @default false
   */
  readonly debug?: boolean | undefined
}

/**
 * schema registry that validates data and transforms it between schema versions.
 * created via {@link createRegistry}.
 */
export type Registry<Schemas extends SchemaMap> = {
  /**
   * transforms a value from one schema to another, resolving the migration path automatically
   * unless an explicit path is provided via options.
   */
  readonly transform: <From extends SchemaKeys<Schemas>, To extends SchemaKeys<Schemas>>(
    value: InferOutput<Schemas[From]>,
    from: From,
    to: To,
    options?: TransformOptions<SchemaKeys<Schemas>>,
  ) => Promise<TransformResult<InferOutput<Schemas[To]>, SchemaKeys<Schemas>>>

  /** validates a value against a named schema. */
  readonly validate: <K extends SchemaKeys<Schemas>>(
    value: unknown,
    schema: K,
  ) => Promise<ValidateResult<InferOutput<Schemas[K]>, K>>

  /** type guard that checks whether a schema name is registered. */
  readonly has: <K extends string>(schema: K) => schema is K & SchemaKeys<Schemas>

  /** checks whether a direct migration exists between two schemas. */
  readonly hasMigration: <From extends SchemaKeys<Schemas>, To extends SchemaKeys<Schemas>>(
    from: From,
    to: To,
  ) => boolean

  /** resolves the migration path between two schemas, or returns null if none exists. */
  readonly findPath: <From extends SchemaKeys<Schemas>, To extends SchemaKeys<Schemas>>(
    from: From,
    to: To,
  ) => readonly SchemaKeys<Schemas>[] | null

  /**
   * returns a diagnostic description of the migration path between two schemas,
   * including costs, labels, deprecation info, and a human-readable summary.
   */
  readonly explain: <From extends SchemaKeys<Schemas>, To extends SchemaKeys<Schemas>>(
    from: From,
    to: To,
  ) => ExplainResult<SchemaKeys<Schemas>>

  /** the schemas this registry was created with. */
  readonly schemas: Schemas
}

function typedKeys<T extends Record<string, unknown>>(obj: T): Extract<keyof T, string>[] {
  return Object.keys(obj) as Extract<keyof T, string>[]
}

// oxlint-disable-next-line typescript/no-explicit-any -- generic hook combiner needs flexible args
function mergeHook<F extends (...args: any[]) => void>(
  user: F | undefined,
  debug: F | undefined,
): F | undefined {
  if (user === undefined) {
    return debug
  }
  if (debug === undefined) {
    return user
  }
  return ((...args: Parameters<F>) => {
    user(...args)
    debug(...args)
  }) as F
}

function buildGraph<K extends string>(
  schemaKeys: readonly K[],
  migrations: ReadonlyMap<string, { readonly cost: number }>,
): Graph<K> {
  const graph = new Map<K, Edge<K>[]>()
  for (const key of schemaKeys) {
    graph.set(key, [])
  }
  for (const from of schemaKeys) {
    const edges = graph.get(from)
    if (edges === undefined) {
      continue
    }
    for (const to of schemaKeys) {
      if (from === to) {
        continue
      }
      const migration = migrations.get(`${from}->${to}`)
      if (migration !== undefined) {
        edges.push({ to, cost: migration.cost })
      }
    }
  }
  return graph
}

function hasWeightedEdges(migrations: ReadonlyMap<string, ResolvedMigration>): boolean {
  for (const migration of migrations.values()) {
    if (migration.cost !== DEFAULT_COST) {
      return true
    }
  }
  return false
}

function emptyMeta<Keys extends string>(from: Keys): TransformMeta<Keys> {
  return { path: [from], steps: [], warnings: [], defaults: [] }
}

/**
 * creates a {@link Registry} from a set of schemas and migrations.
 * builds the migration graph at construction time so path lookups are fast.
 *
 * @example
 * ```ts
 * const registry = createRegistry({
 *   schemas: { v1: v1Schema, v2: v2Schema },
 *   migrations: {
 *     'v1->v2': (value) => ({ ...value, newField: 'default' }),
 *   },
 * })
 *
 * const result = await registry.transform(oldData, 'v1', 'v2')
 * if (result.ok) {
 *   console.log(result.value)
 * }
 * ```
 */
export function createRegistry<Schemas extends SchemaMap>(
  config: RegistryConfig<Schemas>,
): Registry<Schemas> {
  type Keys = SchemaKeys<Schemas>

  const { schemas, pathStrategy = 'shortest', hooks, debug } = config
  const schemaKeys = typedKeys(schemas)
  const resolved = resolveMigrations(config.migrations)
  const { migrations } = resolved
  const graph = buildGraph(schemaKeys, migrations)
  const findPath = hasWeightedEdges(migrations) ? findPathDijkstra : findPathBFS

  const onWarning = mergeHook(
    hooks?.onWarning,
    debug
      ? // oxlint-disable-next-line no-console -- debug mode intentionally logs to console
        (msg: string, from: Keys, to: Keys) => console.log(`[doba] warn ${from}->${to}: ${msg}`)
      : undefined,
  )
  /* oxlint-disable no-console -- debug mode hooks intentionally log to console */
  const onTransform = mergeHook(
    hooks?.onTransform,
    debug
      ? (info: TransformHookInfo<Keys>) => {
          const status = info.ok ? 'ok' : 'FAIL'
          const route = info.path ? info.path.join(' -> ') : 'no path'
          console.log(
            `[doba] transform ${info.from}->${info.to} [${status}] ${info.durationMs.toFixed(1)}ms (${route})`,
          )
        }
      : undefined,
  )
  const onStep = mergeHook(
    hooks?.onStep,
    debug
      ? (info: StepHookInfo<Keys>) => {
          const status = info.ok ? 'ok' : 'FAIL'
          const tag = info.label ? ` "${info.label}"` : ''
          console.log(
            `[doba]   step ${info.index + 1}/${info.total} ${info.from}->${info.to}${tag} [${status}] ${info.durationMs.toFixed(1)}ms`,
          )
        }
      : undefined,
  )
  /* oxlint-enable no-console */

  // when no timing hooks are registered, skip all performance.now() calls and object allocations
  const hasTiming = onTransform !== undefined || onStep !== undefined

  for (const w of resolved.warnings) {
    onWarning?.(w.message, w.from as Keys, w.to as Keys)
  }

  function has<K extends string>(schema: K): schema is K & Keys {
    return schema in schemas
  }

  function resolvePath(from: Keys, to: Keys, strategy?: PathStrategy): readonly Keys[] | null {
    if (!has(from) || !has(to)) {
      return null
    }
    if (from === to) {
      return [from]
    }

    const effective = strategy ?? pathStrategy
    if (effective === 'direct') {
      return migrations.has(`${from}->${to}`) ? [from, to] : null
    }

    return findPath(graph, from, to)
  }

  function validatePathMigrations(path: readonly string[]): string | null {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}->${path[i + 1]}`
      if (!migrations.has(key)) {
        return key
      }
    }
    return null
  }

  function noPathError(from: Keys, to: Keys, effectiveStrategy: PathStrategy) {
    const hint =
      effectiveStrategy === 'direct'
        ? " (pathStrategy is 'direct', no direct migration exists)"
        : ''

    const reachable = [...reachableFrom(graph, from)].toSorted()
    const rev = reverseGraph(graph)
    const canReachTo = [...reachableFrom(rev, to)].toSorted()

    const details: string[] = []
    if (reachable.length > 0) {
      details.push(`schemas reachable from "${from}": ${reachable.join(', ')}`)
    } else {
      details.push(`"${from}" has no outgoing migrations`)
    }
    if (canReachTo.length > 0) {
      details.push(`schemas that can reach "${to}": ${canReachTo.join(', ')}`)
    } else {
      details.push(`no schema has a migration path to "${to}"`)
    }

    return err([
      createIssue(
        'no_path_found',
        `no migration path from "${from}" to "${to}"${hint}. ${details.join('; ')}`,
        { reachableFromSource: reachable, reachableToTarget: canReachTo },
      ),
    ])
  }

  async function transformCore(
    value: unknown,
    _from: Keys,
    to: Keys,
    path: readonly Keys[],
    options: TransformOptions<Keys> | undefined,
  ): Promise<TransformResult<unknown, Keys>> {
    const state = createTransformState<Keys>()
    const steps: StepInfo<Keys>[] = []
    const validateStrategy = options?.validate ?? 'end'
    const totalSteps = path.length - 1
    let current = value

    for (let i = 0; i < totalSteps; i++) {
      const stepFrom = path[i] as Keys
      const stepTo = path[i + 1] as Keys
      const key = `${stepFrom}->${stepTo}`
      const migration = migrations.get(key)

      if (migration === undefined) {
        return err([createIssue('transform_failed', `missing migration "${key}"`)])
      }

      steps.push({
        from: stepFrom,
        to: stepTo,
        label: migration.label,
        deprecated: migration.deprecated === false ? undefined : migration.deprecated,
      })

      if (migration.deprecated !== false) {
        let reason = ''
        if (typeof migration.deprecated === 'string' && migration.deprecated !== 'deprecated') {
          reason = `: ${migration.deprecated}`
        }
        state.warnings.push({
          message: `using deprecated migration "${key}"${reason}`,
          from: stepFrom,
          to: stepTo,
        })
        onWarning?.(`using deprecated migration "${key}"${reason}`, stepFrom, stepTo)
      }

      const ctx = createTransformContext(state, stepFrom, stepTo, onWarning)

      try {
        const result = migration.fn(current, ctx)
        // oxlint-disable-next-line no-await-in-loop -- migration steps must run sequentially, each depends on the previous result
        current = result instanceof Promise ? await result : result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return err([createIssue('transform_failed', `migration "${key}" threw: ${message}`)])
      }

      if (validateStrategy === 'each' && i < totalSteps - 1) {
        const intermediateSchema = schemas[stepTo]
        if (intermediateSchema !== undefined) {
          // oxlint-disable-next-line no-await-in-loop -- intermediate validation must happen before the next migration step
          const result = await validateWithSchema(intermediateSchema, current, stepTo)
          if (!result.ok) {
            return result
          }
          current = result.value
        }
      }
    }

    if (validateStrategy !== 'none') {
      const finalSchema = schemas[to]
      if (finalSchema === undefined) {
        return err([createIssue('unknown_schema', `schema "${to}" not found`)])
      }
      const result = await validateWithSchema(finalSchema, current, to)
      if (!result.ok) {
        return result
      }
      current = result.value
    }

    return ok(current, {
      path: [...path],
      steps,
      warnings: [...state.warnings],
      defaults: [...state.defaults],
    } satisfies TransformMeta<Keys>)
  }

  async function transformInstrumented(
    value: unknown,
    from: Keys,
    to: Keys,
    path: readonly Keys[],
    options: TransformOptions<Keys> | undefined,
    startTime: number,
  ): Promise<TransformResult<unknown, Keys>> {
    const state = createTransformState<Keys>()
    const steps: StepInfo<Keys>[] = []
    const validateStrategy = options?.validate ?? 'end'
    const totalSteps = path.length - 1
    let current = value

    for (let i = 0; i < totalSteps; i++) {
      const stepFrom = path[i] as Keys
      const stepTo = path[i + 1] as Keys
      const key = `${stepFrom}->${stepTo}`
      const migration = migrations.get(key)

      if (migration === undefined) {
        const r = err([createIssue('transform_failed', `missing migration "${key}"`)])
        onTransform?.({ from, to, path, durationMs: performance.now() - startTime, ok: false })
        return r
      }

      steps.push({
        from: stepFrom,
        to: stepTo,
        label: migration.label,
        deprecated: migration.deprecated === false ? undefined : migration.deprecated,
      })

      if (migration.deprecated !== false) {
        let reason = ''
        if (typeof migration.deprecated === 'string' && migration.deprecated !== 'deprecated') {
          reason = `: ${migration.deprecated}`
        }
        state.warnings.push({
          message: `using deprecated migration "${key}"${reason}`,
          from: stepFrom,
          to: stepTo,
        })
        onWarning?.(`using deprecated migration "${key}"${reason}`, stepFrom, stepTo)
      }

      const ctx = createTransformContext(state, stepFrom, stepTo, onWarning)
      const stepStart = performance.now()

      try {
        const result = migration.fn(current, ctx)
        // oxlint-disable-next-line no-await-in-loop -- migration steps must run sequentially, each depends on the previous result
        current = result instanceof Promise ? await result : result
        onStep?.({
          from: stepFrom,
          to: stepTo,
          index: i,
          total: totalSteps,
          label: migration.label,
          durationMs: performance.now() - stepStart,
          ok: true,
        })
      } catch (error) {
        onStep?.({
          from: stepFrom,
          to: stepTo,
          index: i,
          total: totalSteps,
          label: migration.label,
          durationMs: performance.now() - stepStart,
          ok: false,
        })
        const message = error instanceof Error ? error.message : String(error)
        const r = err([createIssue('transform_failed', `migration "${key}" threw: ${message}`)])
        onTransform?.({ from, to, path, durationMs: performance.now() - startTime, ok: false })
        return r
      }

      if (validateStrategy === 'each' && i < totalSteps - 1) {
        const intermediateSchema = schemas[stepTo]
        if (intermediateSchema !== undefined) {
          // oxlint-disable-next-line no-await-in-loop -- intermediate validation must happen before the next migration step
          const result = await validateWithSchema(intermediateSchema, current, stepTo)
          if (!result.ok) {
            onTransform?.({ from, to, path, durationMs: performance.now() - startTime, ok: false })
            return result
          }
          current = result.value
        }
      }
    }

    if (validateStrategy !== 'none') {
      const finalSchema = schemas[to]
      if (finalSchema === undefined) {
        const r = err([createIssue('unknown_schema', `schema "${to}" not found`)])
        onTransform?.({ from, to, path, durationMs: performance.now() - startTime, ok: false })
        return r
      }
      const result = await validateWithSchema(finalSchema, current, to)
      if (!result.ok) {
        onTransform?.({ from, to, path, durationMs: performance.now() - startTime, ok: false })
        return result
      }
      current = result.value
    }

    const r = ok(current, {
      path: [...path],
      steps,
      warnings: [...state.warnings],
      defaults: [...state.defaults],
    } satisfies TransformMeta<Keys>)
    onTransform?.({ from, to, path, durationMs: performance.now() - startTime, ok: true })
    return r
  }

  function emitTransform(
    from: Keys,
    to: Keys,
    resolvedPath: readonly Keys[] | null,
    startTime: number,
    success: boolean,
  ): void {
    onTransform?.({
      from,
      to,
      path: resolvedPath,
      durationMs: performance.now() - startTime,
      ok: success,
    })
  }

  async function transform(
    value: unknown,
    from: Keys,
    to: Keys,
    options?: TransformOptions<Keys>,
  ): Promise<TransformResult<unknown, Keys>> {
    const startTime = hasTiming ? performance.now() : 0

    if (!has(from)) {
      const r = err([createIssue('unknown_schema', `schema "${from}" not found`)])
      if (hasTiming) {
        emitTransform(from, to, null, startTime, false)
      }
      return r
    }
    if (!has(to)) {
      const r = err([createIssue('unknown_schema', `schema "${to}" not found`)])
      if (hasTiming) {
        emitTransform(from, to, null, startTime, false)
      }
      return r
    }

    if (from === to) {
      const validateStrategy = options?.validate ?? 'end'
      if (validateStrategy !== 'none') {
        const schema = schemas[from]
        if (schema === undefined) {
          const r = err([createIssue('unknown_schema', `schema "${from}" not found`)])
          if (hasTiming) {
            emitTransform(from, to, null, startTime, false)
          }
          return r
        }
        const result = await validateWithSchema(schema, value, from)
        if (!result.ok) {
          if (hasTiming) {
            emitTransform(from, to, [from], startTime, false)
          }
          return result
        }
        if (hasTiming) {
          emitTransform(from, to, [from], startTime, true)
        }
        return ok(result.value, emptyMeta(from))
      }
      if (hasTiming) {
        emitTransform(from, to, [from], startTime, true)
      }
      return ok(value, emptyMeta(from))
    }

    const effectiveStrategy = options?.pathStrategy ?? pathStrategy
    let path: readonly Keys[] = []

    if (options?.path !== undefined && options.path.length >= 2) {
      ;({ path } = options)

      if (path[0] !== from || path.at(-1) !== to) {
        const r = err([
          createIssue('invalid_input', `path must start with "${from}" and end with "${to}"`),
        ])
        if (hasTiming) {
          emitTransform(from, to, null, startTime, false)
        }
        return r
      }

      if (options.validatePath === true) {
        const missing = validatePathMigrations(path)
        if (missing !== null) {
          const r = err([
            createIssue('no_path_found', `forced path is invalid: missing migration "${missing}"`),
          ])
          if (hasTiming) {
            emitTransform(from, to, null, startTime, false)
          }
          return r
        }
      }
    } else {
      const found = resolvePath(from, to, effectiveStrategy)
      if (found === null || found.length < 2) {
        const r = noPathError(from, to, effectiveStrategy)
        if (hasTiming) {
          emitTransform(from, to, null, startTime, false)
        }
        return r
      }
      path = found
    }

    return hasTiming
      ? transformInstrumented(value, from, to, path, options, startTime)
      : transformCore(value, from, to, path, options)
  }

  function validate(value: unknown, schema: Keys): Promise<ValidateResult<unknown, Keys>> {
    if (!has(schema)) {
      return Promise.resolve(err([createIssue('unknown_schema', `schema "${schema}" not found`)]))
    }
    const schemaObj = schemas[schema]
    if (schemaObj === undefined) {
      return Promise.resolve(err([createIssue('unknown_schema', `schema "${schema}" not found`)]))
    }
    return validateWithSchema(schemaObj, value, schema)
  }

  function explain(from: Keys, to: Keys): ExplainResult<Keys> {
    if (from === to) {
      return {
        from,
        to,
        path: [from],
        totalCost: 0,
        steps: [],
        summary: `"${from}" is already the target schema.`,
      }
    }

    const path = resolvePath(from, to)
    if (path === null || path.length < 2) {
      const reachable = [...reachableFrom(graph, from)].toSorted()
      const rev = reverseGraph(graph)
      const canReachTo = [...reachableFrom(rev, to)].toSorted()

      const parts: string[] = [`No migration path from "${from}" to "${to}".`]
      if (reachable.length > 0) {
        parts.push(`Reachable from "${from}": ${reachable.join(', ')}.`)
      } else {
        parts.push(`"${from}" has no outgoing migrations.`)
      }
      if (canReachTo.length > 0) {
        parts.push(`Schemas that can reach "${to}": ${canReachTo.join(', ')}.`)
      } else {
        parts.push(`No schema has a path to "${to}".`)
      }

      return { from, to, path: null, totalCost: null, steps: [], summary: parts.join(' ') }
    }

    const explainSteps: ExplainStep<Keys>[] = []
    let totalCost = 0

    for (let i = 0; i < path.length - 1; i++) {
      const stepFrom = path[i] as Keys
      const stepTo = path[i + 1] as Keys
      const migration = migrations.get(`${stepFrom}->${stepTo}`)
      if (migration === undefined) {
        continue
      }
      explainSteps.push({
        from: stepFrom,
        to: stepTo,
        cost: migration.cost,
        label: migration.label,
        deprecated: migration.deprecated === false ? undefined : migration.deprecated,
      })
      totalCost += migration.cost
    }

    const stepCount = path.length - 1
    const lines: string[] = [
      `Path: ${path.join(' -> ')} (${stepCount} step${stepCount === 1 ? '' : 's'}, total cost: ${totalCost})`,
    ]
    for (let i = 0; i < explainSteps.length; i++) {
      const s = explainSteps[i]
      if (s === undefined) {
        continue
      }
      let line = `  ${i + 1}. ${s.from} -> ${s.to} (cost: ${s.cost})`
      if (s.label !== undefined) {
        line += ` [${s.label}]`
      }
      if (s.deprecated !== undefined) {
        line += ` [DEPRECATED${typeof s.deprecated === 'string' ? `: ${s.deprecated}` : ''}]`
      }
      lines.push(line)
    }

    return { from, to, path, totalCost, steps: explainSteps, summary: lines.join('\n') }
  }

  return {
    transform,
    validate,
    has,
    hasMigration: (from: Keys, to: Keys) => migrations.has(`${from}->${to}`),
    findPath: resolvePath,
    explain,
    schemas,
  } as Registry<Schemas>
}
