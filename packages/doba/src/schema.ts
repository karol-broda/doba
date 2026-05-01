import type { StandardSchemaV1, InferOutput } from './standard-schema.js'

/** record mapping schema names to {@link StandardSchemaV1} instances. */
export type SchemaMap = Record<string, StandardSchemaV1>

/** extracts the string keys from a {@link SchemaMap}. */
export type SchemaKeys<Schemas extends SchemaMap> = Extract<keyof Schemas, string>

/** infers the output type of the schema at key `K` in a {@link SchemaMap}. */
export type SchemaOutputAt<Schemas extends SchemaMap, K extends keyof Schemas> = InferOutput<
  Schemas[K]
>
