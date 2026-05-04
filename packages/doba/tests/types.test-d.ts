import { describe, it, expectTypeOf } from 'vitest'
import {
  createRegistry,
  match,
  tryParse,
  byField,
  firstMatch,
  type Result,
  type ResultOk,
  type ResultErr,
  type ValidateResult,
  type ValidateMeta,
  type TransformContext,
  type DobaIssue,
  type StepInfo,
  type MigrationFn,
  type MigrationDef,
  type PipeMigrationDef,
  type ReversibleMigrationDef,
  type Registry,
  type SchemaKeys,
  type MigrationsFor,
  type IdentifyResult,
  type IdentifyGuard,
  type Matcher,
} from '../src/index.js'
import type { StandardSchemaV1 } from '../src/standard-schema.js'
import { ok, err, isOk, isErr } from '../src/result-entry.js'
import type { DatabaseUser, FrontendUser, AiUser, LegacyUser } from './helpers.js'

// declared schemas for type-level testing
declare const databaseSchema: StandardSchemaV1<unknown, DatabaseUser>
declare const frontendSchema: StandardSchemaV1<unknown, FrontendUser>
declare const aiSchema: StandardSchemaV1<unknown, AiUser>
declare const legacySchema: StandardSchemaV1<unknown, LegacyUser>
declare const alphaSchema: StandardSchemaV1<unknown, { a: string }>
declare const betaSchema: StandardSchemaV1<unknown, { b: number }>

const testSchemas = {
  database: databaseSchema,
  frontend: frontendSchema,
  ai: aiSchema,
  legacy: legacySchema,
} as const

describe('result types', () => {
  it('ok result has correct shape', () => {
    const result = ok('value', { meta: true })
    expectTypeOf(result).toExtend<ResultOk<string, { meta: boolean }>>()
    expectTypeOf(result.ok).toEqualTypeOf<true>()
    expectTypeOf(result.value).toEqualTypeOf<string>()
    expectTypeOf(result.meta).toEqualTypeOf<{ meta: boolean }>()
  })

  it('err result has correct shape', () => {
    const result = err(['issue1', 'issue2'])
    expectTypeOf(result).toExtend<ResultErr<string[]>>()
    expectTypeOf(result.ok).toEqualTypeOf<false>()
    expectTypeOf(result.issues).toEqualTypeOf<string[]>()
  })

  it('result union is discriminated by ok', () => {
    const result = ok(42) as Result<number, string, undefined>
    if (result.ok === true) {
      expectTypeOf(result.value).toEqualTypeOf<number>()
    } else {
      expectTypeOf(result.issues).toEqualTypeOf<string>()
    }
  })

  it('isOk narrows type correctly', () => {
    const result = ok(42, 'meta') as Result<number, string, string>
    if (isOk(result)) {
      expectTypeOf(result).toExtend<ResultOk<number, string>>()
      expectTypeOf(result.value).toEqualTypeOf<number>()
    }
  })

  it('isErr narrows type correctly', () => {
    const result = err('error') as Result<number, string, undefined>
    if (isErr(result)) {
      expectTypeOf(result).toExtend<ResultErr<string>>()
      expectTypeOf(result.issues).toEqualTypeOf<string>()
    }
  })
})

describe('schema key types', () => {
  it('SchemaKeys extracts string keys', () => {
    type Keys = SchemaKeys<typeof testSchemas>
    expectTypeOf<Keys>().toEqualTypeOf<'database' | 'frontend' | 'ai' | 'legacy'>()
  })
})

describe('migration function types', () => {
  it('MigrationFn has correct input/output types', () => {
    type DbToFrontend = MigrationFn<DatabaseUser, FrontendUser>
    const migration: DbToFrontend = (value, ctx) => {
      expectTypeOf(value).toEqualTypeOf<DatabaseUser>()
      expectTypeOf(ctx).toExtend<TransformContext>()
      return {
        id: value.id,
        email: value.email,
        createdAt: value.createdAt,
        role: value.role,
      }
    }
    expectTypeOf(migration).toExtend<DbToFrontend>()
  })

  it('MigrationDef accepts bare function', () => {
    type Def = MigrationDef<DatabaseUser, FrontendUser>
    expectTypeOf<(value: DatabaseUser) => FrontendUser>().toExtend<Def>()
  })

  it('MigrationDef accepts object form', () => {
    type Def = MigrationDef<DatabaseUser, FrontendUser>
    const obj: Def = {
      migrate: (value) => ({
        id: value.id,
        email: value.email,
        createdAt: value.createdAt,
        role: value.role,
      }),
      deprecated: 'use v2',
      preferred: false,
      cost: 5,
      label: 'strip-password',
    }
    expectTypeOf(obj).toExtend<Def>()
  })

  it('ReversibleMigrationDef has forward and backward', () => {
    type Rev = ReversibleMigrationDef<DatabaseUser, FrontendUser>
    const rev: Rev = {
      forward: (value) => ({
        id: value.id,
        email: value.email,
        createdAt: value.createdAt,
        role: value.role,
      }),
      backward: (value, ctx) => {
        expectTypeOf(value).toEqualTypeOf<FrontendUser>()
        ctx.defaulted(['passwordHash'], 'set to empty')
        return {
          id: value.id,
          email: value.email,
          passwordHash: '',
          createdAt: value.createdAt,
          role: value.role,
        }
      },
    }
    expectTypeOf(rev).toExtend<Rev>()
  })
})

describe('registry types', () => {
  it('createRegistry returns typed registry', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (user) => ({
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          role: user.role,
        }),
      },
    })

    expectTypeOf(registry).toExtend<Registry<typeof testSchemas>>()
    expectTypeOf(registry.schemas).toEqualTypeOf<typeof testSchemas>()
  })

  it('transform infers output type from target schema', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->ai': (user) => ({
          id: user.id,
          email: user.email,
          isAdmin: user.role === 'admin',
        }),
      },
    })

    const dbUser: DatabaseUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: '2024-01-01',
      role: 'admin',
    }

    const result = await registry.transform(dbUser, 'database', 'ai')
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<AiUser>()
      expectTypeOf(result.value.isAdmin).toEqualTypeOf<boolean>()
      // @ts-expect-error passwordHash does not exist on AiUser
      result.value.passwordHash
    }
  })

  it('transform meta includes steps', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value) => ({
          id: value.id,
          email: value.email,
          createdAt: value.createdAt,
          role: value.role,
        }),
      },
    })

    const dbUser: DatabaseUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: '2024-01-01',
      role: 'admin',
    }

    const result = await registry.transform(dbUser, 'database', 'frontend')
    if (result.ok) {
      expectTypeOf(result.meta).toHaveProperty('path')
      expectTypeOf(result.meta).toHaveProperty('steps')
      expectTypeOf(result.meta).toHaveProperty('warnings')
      expectTypeOf(result.meta).toHaveProperty('defaults')
      expectTypeOf(result.meta.path).toExtend<readonly string[]>()
      expectTypeOf(result.meta.steps).toExtend<readonly StepInfo[]>()
      expectTypeOf(result.meta.warnings).toExtend<
        readonly { message: string; from: string; to: string }[]
      >()
    } else {
      expectTypeOf(result.issues).toEqualTypeOf<readonly DobaIssue[]>()
    }
  })

  it('validate accepts valid schema keys', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
    })

    const result = await registry.validate({}, 'frontend')
    expectTypeOf(result).toExtend<ValidateResult<FrontendUser>>()
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<FrontendUser>()
      expectTypeOf(result.meta).toExtend<ValidateMeta>()
      expectTypeOf(result.meta.schema).toEqualTypeOf<'frontend'>()
    }
  })

  it('has and hasMigration are typed', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
    })

    expectTypeOf(registry.has).toExtend<(schema: string) => boolean>()
    expectTypeOf(registry.hasMigration('database', 'frontend')).toEqualTypeOf<boolean>()
  })

  it('findPath is typed with schema keys', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
    })

    type Keys = 'database' | 'frontend' | 'ai' | 'legacy'
    const path = registry.findPath('database', 'frontend')
    expectTypeOf(path).toEqualTypeOf<readonly Keys[] | null>()
  })
})

describe('narrowed from/to types', () => {
  it('transform warnings narrow from to exclude To and to to exclude From', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value) => ({
          id: value.id,
          email: value.email,
          createdAt: value.createdAt,
          role: value.role,
        }),
      },
    })

    const dbUser: DatabaseUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: '2024-01-01',
      role: 'admin',
    }

    const result = await registry.transform(dbUser, 'database', 'frontend')
    if (result.ok) {
      const [warning] = result.meta.warnings
      if (warning) {
        // from excludes To ("frontend"), to excludes From ("database")
        expectTypeOf(warning.from).toEqualTypeOf<'database' | 'ai' | 'legacy'>()
        expectTypeOf(warning.to).toEqualTypeOf<'frontend' | 'ai' | 'legacy'>()
      }
    }
  })

  it('transform steps narrow from and to the same way as warnings', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value) => ({
          id: value.id,
          email: value.email,
          createdAt: value.createdAt,
          role: value.role,
        }),
      },
    })

    const dbUser: DatabaseUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: '2024-01-01',
      role: 'admin',
    }

    const result = await registry.transform(dbUser, 'database', 'frontend')
    if (result.ok) {
      const [step] = result.meta.steps
      if (step) {
        expectTypeOf(step.from).toEqualTypeOf<'database' | 'ai' | 'legacy'>()
        expectTypeOf(step.to).toEqualTypeOf<'frontend' | 'ai' | 'legacy'>()
      }
    }
  })

  it('transform defaults narrow from and to', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value, ctx) => {
          ctx.defaulted(['role'], 'set default role')
          return {
            id: value.id,
            email: value.email,
            createdAt: value.createdAt,
            role: value.role,
          }
        },
      },
    })

    const dbUser: DatabaseUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: '2024-01-01',
      role: 'admin',
    }

    const result = await registry.transform(dbUser, 'database', 'frontend')
    if (result.ok) {
      const [defaulted] = result.meta.defaults
      if (defaulted) {
        expectTypeOf(defaulted.from).toEqualTypeOf<'database' | 'ai' | 'legacy'>()
        expectTypeOf(defaulted.to).toEqualTypeOf<'frontend' | 'ai' | 'legacy'>()
      }
    }
  })

  it('two-schema registry narrows from and to to single literals', async () => {
    const schemaA = alphaSchema
    const schemaB = betaSchema

    const registry = createRegistry({
      schemas: { alpha: schemaA, beta: schemaB },
      migrations: {
        'alpha->beta': () => ({ b: 1 }),
      },
    })

    const result = await registry.transform({ a: 'x' }, 'alpha', 'beta')
    if (result.ok) {
      const [warning] = result.meta.warnings
      if (warning) {
        expectTypeOf(warning.from).toEqualTypeOf<'alpha'>()
        expectTypeOf(warning.to).toEqualTypeOf<'beta'>()
      }
      const [step] = result.meta.steps
      if (step) {
        expectTypeOf(step.from).toEqualTypeOf<'alpha'>()
        expectTypeOf(step.to).toEqualTypeOf<'beta'>()
      }
    }
  })

  it('explain result narrows from and to', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value) => ({
          id: value.id,
          email: value.email,
          createdAt: value.createdAt,
          role: value.role,
        }),
      },
    })

    const explanation = registry.explain('database', 'frontend')
    expectTypeOf(explanation.from).toEqualTypeOf<'database'>()
    expectTypeOf(explanation.to).toEqualTypeOf<'frontend'>()

    const [step] = explanation.steps
    if (step) {
      expectTypeOf(step.from).toEqualTypeOf<'database' | 'ai' | 'legacy'>()
      expectTypeOf(step.to).toEqualTypeOf<'frontend' | 'ai' | 'legacy'>()
    }
  })
})

describe('migrations object types', () => {
  it('migrations are typed based on schema keys', () => {
    type Migrations = MigrationsFor<typeof testSchemas>
    type ValidKey1 = 'database->frontend' extends keyof Migrations ? true : false
    type ValidKey2 = 'frontend->ai' extends keyof Migrations ? true : false
    type ReversibleKey = 'database<->frontend' extends keyof Migrations ? true : false

    expectTypeOf<ValidKey1>().toEqualTypeOf<true>()
    expectTypeOf<ValidKey2>().toEqualTypeOf<true>()
    expectTypeOf<ReversibleKey>().toEqualTypeOf<true>()
  })

  it('migration functions have typed input/output', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value, ctx) => {
          expectTypeOf(value).toEqualTypeOf<DatabaseUser>()
          expectTypeOf(value.passwordHash).toEqualTypeOf<string>()
          expectTypeOf(ctx).toExtend<TransformContext>()
          return {
            id: value.id,
            email: value.email,
            createdAt: value.createdAt,
            role: value.role,
          }
        },
        'frontend->ai': (value, ctx) => {
          expectTypeOf(value).toEqualTypeOf<FrontendUser>()
          // @ts-expect-error passwordHash does not exist on FrontendUser
          value.passwordHash
          expectTypeOf(ctx).toExtend<TransformContext>()
          return {
            id: value.id,
            email: value.email,
            isAdmin: value.role === 'admin',
          }
        },
      },
    })
  })

  it('reversible migrations have typed forward/backward', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'database<->frontend': {
          forward: (value, ctx) => {
            expectTypeOf(value).toEqualTypeOf<DatabaseUser>()
            expectTypeOf(ctx.from).toEqualTypeOf<'database'>()
            expectTypeOf(ctx.to).toEqualTypeOf<'frontend'>()
            return {
              id: value.id,
              email: value.email,
              createdAt: value.createdAt,
              role: value.role,
            }
          },
          backward: (value, ctx) => {
            expectTypeOf(value).toEqualTypeOf<FrontendUser>()
            expectTypeOf(ctx.from).toEqualTypeOf<'frontend'>()
            expectTypeOf(ctx.to).toEqualTypeOf<'database'>()
            return {
              id: value.id,
              email: value.email,
              passwordHash: '',
              createdAt: value.createdAt,
              role: value.role,
            }
          },
        },
      },
    })
  })

  it('object-form migrations are typed', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': {
          migrate: (value) => ({
            id: value.id,
            email: value.email,
            createdAt: value.createdAt,
            role: value.role,
          }),
          deprecated: 'use reversible version',
          label: 'strip-hash',
        },
      },
    })
  })

  it('pipe-form migrations infer input type from schema', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': {
          pipe: (p) => p.drop('passwordHash').into<FrontendUser>(),
        },
      },
    })
  })

  it('pipe-form migrations accept metadata', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': {
          pipe: (p) => p.drop('passwordHash').into<FrontendUser>(),
          label: 'strip-hash',
          deprecated: 'use reversible version',
        },
      },
    })
  })

  it('PipeMigrationDef has correct type structure', () => {
    type Def = PipeMigrationDef<DatabaseUser, FrontendUser>
    const obj: Def = {
      pipe: (p) => p.drop('passwordHash').into<FrontendUser>(),
    }
    expectTypeOf(obj).toExtend<Def>()
  })

  it('one-way migration accepts pipe form', () => {
    type DbToFrontend = NonNullable<MigrationsFor<typeof testSchemas>['database->frontend']>
    expectTypeOf<{
      // eslint-disable-next-line typescript-eslint/no-explicit-any -- testing that any-typed pipe satisfies the migration type
      pipe: (p: any) => (v: DatabaseUser) => FrontendUser
    }>().toExtend<DbToFrontend>()
  })
})

describe('transform context types', () => {
  it('TransformContext has correct methods', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value, ctx) => {
          expectTypeOf(ctx.warn).toBeFunction()
          expectTypeOf(ctx.defaulted).toBeFunction()
          expectTypeOf(ctx.from).toEqualTypeOf<'database'>()
          expectTypeOf(ctx.to).toEqualTypeOf<'frontend'>()
          return {
            id: value.id,
            email: value.email,
            createdAt: value.createdAt,
            role: value.role,
          }
        },
      },
    })
  })
})

describe('transform options types', () => {
  it('path option is typed to schema keys', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->frontend': (value) => ({
          id: value.id,
          email: value.email,
          createdAt: value.createdAt,
          role: value.role,
        }),
        'frontend->ai': (value) => ({
          id: value.id,
          email: value.email,
          isAdmin: value.role === 'admin',
        }),
      },
    })

    const dbUser: DatabaseUser = {
      id: '1',
      email: 'test@test.com',
      passwordHash: 'hash',
      createdAt: '2024-01-01',
      role: 'admin',
    }

    await registry.transform(dbUser, 'database', 'ai', {
      path: ['database', 'frontend', 'ai'],
    })

    await registry.transform(dbUser, 'database', 'frontend', { validate: 'none' })
    await registry.transform(dbUser, 'database', 'frontend', { validate: 'end' })
    await registry.transform(dbUser, 'database', 'frontend', { validate: 'each' })
  })
})

describe('MigrationsFor type', () => {
  type Schemas = typeof testSchemas
  type M = MigrationsFor<Schemas>

  // -- key coverage --

  it('includes all one-way key combinations', () => {
    // every A->B pair should be a valid optional key
    expectTypeOf<'database->frontend'>().toExtend<keyof M>()
    expectTypeOf<'frontend->database'>().toExtend<keyof M>()
    expectTypeOf<'ai->legacy'>().toExtend<keyof M>()
    expectTypeOf<'legacy->ai'>().toExtend<keyof M>()
    // self-migrations are valid keys too
    expectTypeOf<'database->database'>().toExtend<keyof M>()
  })

  it('includes all reversible key combinations', () => {
    expectTypeOf<'database<->frontend'>().toExtend<keyof M>()
    expectTypeOf<'ai<->legacy'>().toExtend<keyof M>()
    expectTypeOf<'frontend<->ai'>().toExtend<keyof M>()
  })

  it('rejects keys not in the schema map', () => {
    type HasInvalid = 'unknown->database' extends keyof M ? true : false
    type HasInvalid2 = 'database->unknown' extends keyof M ? true : false
    type HasInvalid3 = 'foo<->bar' extends keyof M ? true : false

    expectTypeOf<HasInvalid>().toEqualTypeOf<false>()
    expectTypeOf<HasInvalid2>().toEqualTypeOf<false>()
    expectTypeOf<HasInvalid3>().toEqualTypeOf<false>()
  })

  it('rejects malformed key patterns', () => {
    type NoArrow = 'database_frontend' extends keyof M ? true : false
    type EmptyString = '' extends keyof M ? true : false

    expectTypeOf<NoArrow>().toEqualTypeOf<false>()
    expectTypeOf<EmptyString>().toEqualTypeOf<false>()
  })

  // -- value types for one-way migrations --

  it('one-way migration value resolves to MigrationDef with correct types', () => {
    type DbToFrontend = NonNullable<M['database->frontend']>
    // should accept a bare function with correct input/output
    expectTypeOf<(v: DatabaseUser) => FrontendUser>().toExtend<DbToFrontend>()
  })

  it('one-way migration value has correct From/To types', () => {
    type AiToLegacy = NonNullable<M['ai->legacy']>
    // correct types: AiUser -> LegacyUser
    expectTypeOf<(v: AiUser) => LegacyUser>().toExtend<AiToLegacy>()
    // wrong types should not extend
    expectTypeOf<(v: LegacyUser) => AiUser>().not.toExtend<AiToLegacy>()
  })

  it('one-way migration accepts object form with migrate', () => {
    type DbToAi = NonNullable<M['database->ai']>
    expectTypeOf<{
      migrate: (v: DatabaseUser) => AiUser
      label: string
    }>().toExtend<DbToAi>()
  })

  // -- value types for reversible migrations --

  it('reversible migration value resolves to ReversibleMigrationDef', () => {
    type DbRevFrontend = NonNullable<M['database<->frontend']>
    expectTypeOf<{
      forward: (v: DatabaseUser) => FrontendUser
      backward: (v: FrontendUser) => DatabaseUser
    }>().toExtend<DbRevFrontend>()
  })

  it('reversible migration rejects swapped forward/backward', () => {
    type DbRevFrontend = NonNullable<M['database<->frontend']>
    // swapped: forward takes FrontendUser, backward takes DatabaseUser \ wrong
    expectTypeOf<{
      forward: (v: FrontendUser) => DatabaseUser
      backward: (v: DatabaseUser) => FrontendUser
    }>().not.toExtend<DbRevFrontend>()
  })

  // -- context typing --

  it('one-way migration context has correct from/to literals', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'ai->legacy': (value, ctx) => {
          expectTypeOf(ctx.from).toEqualTypeOf<'ai'>()
          expectTypeOf(ctx.to).toEqualTypeOf<'legacy'>()
          return { name: value.email, admin: value.isAdmin }
        },
      },
    })
  })

  it('reversible migration context has correct from/to in each direction', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {
        'ai<->legacy': {
          forward: (_value, ctx) => {
            expectTypeOf(ctx.from).toEqualTypeOf<'ai'>()
            expectTypeOf(ctx.to).toEqualTypeOf<'legacy'>()
            return {}
          },
          backward: (_value, ctx) => {
            expectTypeOf(ctx.from).toEqualTypeOf<'legacy'>()
            expectTypeOf(ctx.to).toEqualTypeOf<'ai'>()
            return { id: '', email: '', isAdmin: false }
          },
        },
      },
    })
  })

  // -- all keys are optional --

  it('all migration keys are optional', () => {
    // empty migrations object should satisfy MigrationsFor
    // eslint-disable-next-line typescript-eslint/ban-types -- testing that empty object satisfies the type
    expectTypeOf<{}>().toExtend<M>()
  })

  // -- single-schema edge case --

  it('works with a single-schema map', () => {
    const singleSchemas = { only: databaseSchema } as const
    type Single = MigrationsFor<typeof singleSchemas>
    // only self-migration key possible
    expectTypeOf<'only->only'>().toExtend<keyof Single>()
    expectTypeOf<'only<->only'>().toExtend<keyof Single>()
    // nothing else
    type HasOther = 'other->only' extends keyof Single ? true : false
    expectTypeOf<HasOther>().toEqualTypeOf<false>()
  })
})

describe('registry config types', () => {
  it('pathStrategy option', () => {
    createRegistry({ schemas: testSchemas, migrations: {}, pathStrategy: 'direct' })
    createRegistry({ schemas: testSchemas, migrations: {}, pathStrategy: 'shortest' })
  })

  it('hooks option', () => {
    type Keys = 'database' | 'frontend' | 'ai' | 'legacy'
    createRegistry({
      schemas: testSchemas,
      migrations: {},
      hooks: {
        onWarning: (message, from, to) => {
          expectTypeOf(message).toEqualTypeOf<string>()
          expectTypeOf(from).toEqualTypeOf<Keys>()
          expectTypeOf(to).toEqualTypeOf<Keys>()
        },
      },
    })
  })
})

describe('identify types', () => {
  type Keys = 'database' | 'frontend' | 'ai' | 'legacy'

  it('registry without identify has no identify methods', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<false>()
  })

  it('registry with guard map identify has identify methods', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: match.field('passwordHash'),
        ai: match.field('isAdmin'),
      },
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
  })

  it('registry with function identify has identify methods', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: (_value: unknown) => null as Keys | null,
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
  })

  it('identify returns IdentifyResult with correct keys', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: match.field('passwordHash'),
      },
    })

    const result = await registry.identify({})
    expectTypeOf(result).toExtend<IdentifyResult<Keys>>()
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<Keys>()
      expectTypeOf(result.meta.schema).toEqualTypeOf<Keys>()
    } else {
      expectTypeOf(result.issues).toEqualTypeOf<readonly DobaIssue[]>()
    }
  })

  it('identifyAndTransform infers output type from target schema', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->ai': (user) => ({
          id: user.id,
          email: user.email,
          isAdmin: user.role === 'admin',
        }),
      },
      identify: {
        database: match.field('passwordHash'),
      },
    })

    const result = await registry.identifyAndTransform({}, 'ai')
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<AiUser>()
      expectTypeOf(result.meta.from).toEqualTypeOf<Keys>()
      expectTypeOf(result.meta.path).toExtend<readonly Keys[]>()
    }
  })

  it('guard map keys are constrained to schema keys', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: match.field('passwordHash'),
        // @ts-expect-error 'typo' is not a valid schema key
        typo: match.field('something'),
      },
    })
  })

  it('tryParse is accepted in guard map', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: tryParse,
        frontend: match.field('createdAt'),
      },
    })
  })

  it('byField returns function compatible with identify', () => {
    createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: byField('version'),
    })
  })
})

describe('identify advanced types', () => {
  type Keys = 'database' | 'frontend' | 'ai' | 'legacy'

  it('match returns Matcher and is callable as boolean predicate', () => {
    expectTypeOf(match).toExtend<Matcher>()
    expectTypeOf(match).toBeCallableWith({} as unknown)
    expectTypeOf(match({} as unknown)).toEqualTypeOf<boolean>()
  })

  it('match chain returns Matcher', () => {
    const chained = match
      .field('name')
      .type('object')
      .fields('a', 'b')
      .test(() => true)
    expectTypeOf(chained).toExtend<Matcher>()
    expectTypeOf(chained({} as unknown)).toEqualTypeOf<boolean>()
  })

  it('byField returns (value: unknown) => string | null', () => {
    const fn = byField('version')
    expectTypeOf(fn).toEqualTypeOf<(value: unknown) => string | null>()

    const fnWithPrefix = byField('version', { prefix: 'v' })
    expectTypeOf(fnWithPrefix).toEqualTypeOf<(value: unknown) => string | null>()

    const fnWithMap = byField('type', { map: { UserDB: 'database' } })
    expectTypeOf(fnWithMap).toEqualTypeOf<(value: unknown) => string | null>()
  })

  it('firstMatch returns (value: unknown) => string | null', () => {
    const fn = firstMatch(byField('_tag'), (v) => (typeof v === 'string' ? 'name' : null))
    expectTypeOf(fn).toEqualTypeOf<(value: unknown) => string | null>()
  })

  it('guard map values must be IdentifyGuard or tryParse', () => {
    // IdentifyGuard is (value: unknown) => boolean
    expectTypeOf<IdentifyGuard>().toEqualTypeOf<(value: unknown) => boolean>()

    // match produces IdentifyGuard-compatible values
    expectTypeOf(match.field('x')).toExtend<IdentifyGuard>()

    // a plain function returning boolean is compatible
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- testing type compatibility
    const guard: IdentifyGuard = (_v: unknown) => true
    expectTypeOf(guard).toExtend<IdentifyGuard>()
  })

  it('identifyAndTransform result value is typed to the target schema output', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {
        'database->ai': (user) => ({
          id: user.id,
          email: user.email,
          isAdmin: user.role === 'admin',
        }),
      },
      identify: {
        database: match.field('passwordHash'),
      },
    })

    const result = await registry.identifyAndTransform({}, 'ai')
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<AiUser>()
      expectTypeOf(result.value.id).toEqualTypeOf<string>()
      expectTypeOf(result.value.email).toEqualTypeOf<string>()
      expectTypeOf(result.value.isAdmin).toEqualTypeOf<boolean>()
      // @ts-expect-error passwordHash does not exist on AiUser
      result.value.passwordHash
    }
  })

  it('identifyAndTransform meta has from field typed as Keys', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: match.field('passwordHash'),
      },
    })

    const result = await registry.identifyAndTransform({}, 'frontend')
    if (result.ok) {
      expectTypeOf(result.meta.from).toEqualTypeOf<Keys>()
      expectTypeOf(result.meta.path).toExtend<readonly Keys[]>()
      expectTypeOf(result.meta.steps).toExtend<readonly StepInfo[]>()
    }
  })

  it('identify result value is typed as Keys', async () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        ai: match.field('isAdmin'),
      },
    })

    const result = await registry.identify({})
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<Keys>()
    } else {
      expectTypeOf(result.issues).toEqualTypeOf<readonly DobaIssue[]>()
    }
  })

  it('Registry with identify guard map has both identify methods', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: match.field('passwordHash'),
        ai: match.field('isAdmin'),
      },
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf(registry.identify).toBeFunction()
    expectTypeOf(registry.identifyAndTransform).toBeFunction()
  })

  it('Registry with identify byField has both identify methods', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: byField('version'),
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf(registry.identify).toBeFunction()
    expectTypeOf(registry.identifyAndTransform).toBeFunction()
  })

  it('Registry with identify firstMatch has both identify methods', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: firstMatch(byField('_tag'), byField('version')),
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf(registry.identify).toBeFunction()
    expectTypeOf(registry.identifyAndTransform).toBeFunction()
  })

  it('Registry without identify does NOT have identify or identifyAndTransform', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<false>()

    // also verify via the Registry type directly
    type NoIdentify = Registry<typeof testSchemas, false>
    expectTypeOf<'identify' extends keyof NoIdentify ? true : false>().toEqualTypeOf<false>()
    expectTypeOf<
      'identifyAndTransform' extends keyof NoIdentify ? true : false
    >().toEqualTypeOf<false>()

    type WithIdentify = Registry<typeof testSchemas, true>
    expectTypeOf<'identify' extends keyof WithIdentify ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<
      'identifyAndTransform' extends keyof WithIdentify ? true : false
    >().toEqualTypeOf<true>()
  })

  it('tryParse is accepted alongside regular guards in the guard map', () => {
    const registry = createRegistry({
      schemas: testSchemas,
      migrations: {},
      identify: {
        database: tryParse,
        frontend: match.field('createdAt'),
        ai: (_value: unknown) => typeof _value === 'object',
      },
    })

    type Reg = typeof registry
    expectTypeOf<'identify' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
    expectTypeOf<'identifyAndTransform' extends keyof Reg ? true : false>().toEqualTypeOf<true>()
  })
})
