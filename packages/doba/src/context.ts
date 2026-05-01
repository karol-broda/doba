/**
 * context passed to migration functions during a transform.
 * provides utilities to emit warnings and record defaulted fields.
 */
export type TransformContext<
  Keys extends string = string,
  From extends Keys = Keys,
  To extends Keys = Keys,
> = {
  /**
   * emits a warning that will be collected in {@link TransformMeta.warnings}.
   *
   * @example
   * ```ts
   * ctx.warn(`converted name "${user.name}" to email`)
   * ```
   */
  readonly warn: (message: string) => void
  /**
   * records that a field was filled with a default value during this migration step.
   *
   * @example
   * ```ts
   * ctx.defaulted(['email'], 'using default email for legacy user')
   * ```
   */
  readonly defaulted: (path: readonly PropertyKey[], message: string) => void
  /** schema key the value is being migrated from. */
  readonly from: From
  /** schema key the value is being migrated to. */
  readonly to: To
}

/** warning emitted during a migration step, included in {@link TransformMeta}. */
export type WarningInfo<Keys extends string = string> = {
  readonly message: string
  readonly from: Keys
  readonly to: Keys
}

/** records a field that was filled with a default value during migration. */
export type DefaultedInfo<Keys extends string = string> = {
  /** property path to the defaulted field, e.g. `['address', 'zip']`. */
  readonly path: readonly PropertyKey[]
  readonly message: string
  readonly from: Keys
  readonly to: Keys
}

export type TransformState<Keys extends string = string> = {
  readonly warnings: WarningInfo<Keys>[]
  readonly defaults: DefaultedInfo<Keys>[]
}

export function createTransformState<Keys extends string>(): TransformState<Keys> {
  return { warnings: [], defaults: [] }
}

export function createTransformContext<Keys extends string, From extends Keys, To extends Keys>(
  state: TransformState<Keys>,
  from: From,
  to: To,
  onWarning?: (message: string, from: Keys, to: Keys) => void,
): TransformContext<Keys, From, To> {
  return {
    from,
    to,
    warn(message: string): void {
      state.warnings.push({ message, from, to })
      onWarning?.(message, from, to)
    },
    defaulted(path: readonly PropertyKey[], message: string): void {
      state.defaults.push({ path: [...path], message, from, to })
      const pathStr = path.length > 0 ? path.join('.') : '(root)'
      onWarning?.(`defaulted ${pathStr}: ${message}`, from, to)
    },
  }
}
