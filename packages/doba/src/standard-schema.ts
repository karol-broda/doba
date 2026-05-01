/**
 * standard schema v1 interface. any schema library that implements this
 * (zod, valibot, arktype, etc.) can be used with {@link Registry}.
 * @see https://github.com/standard-schema/standard-schema
 */
export type StandardSchemaV1<Input = unknown, Output = Input> = {
  readonly '~standard': StandardSchemaV1Props<Input, Output>
}

export type StandardSchemaV1Props<Input = unknown, Output = Input> = {
  readonly version: 1
  readonly vendor: string
  readonly types?: StandardSchemaV1Types<Input, Output> | undefined
  readonly validate: (
    value: unknown,
  ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>
}

export type StandardSchemaV1Types<Input = unknown, Output = Input> = {
  readonly input: Input
  readonly output: Output
}

export type StandardSchemaV1Result<Output> =
  | StandardSchemaV1SuccessResult<Output>
  | StandardSchemaV1FailureResult

export type StandardSchemaV1SuccessResult<Output> = {
  readonly value: Output
  readonly issues?: undefined
}

export type StandardSchemaV1FailureResult = {
  readonly issues: readonly StandardSchemaV1Issue[]
}

export type StandardSchemaV1Issue = {
  readonly message: string
  readonly path?: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined
}

/** extracts the output type from a {@link StandardSchemaV1} instance. */
export type InferOutput<S> = S extends StandardSchemaV1<unknown, infer O> ? O : never
