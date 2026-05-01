/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { createRegistry } from 'dobajs'
import { log } from './log'

type MockSchemaResult<T> = { ok: true; value: T } | { ok: false; message: string }

function createMockSchema<T>(_name: string, validator: (value: unknown) => MockSchemaResult<T>) {
  return {
    '~standard': {
      version: 1 as const,
      vendor: 'mock',
      validate: (value: unknown) => {
        const result = validator(value)
        if (result.ok === true) {
          return { value: result.value }
        }
        return { issues: [{ message: result.message }] }
      },
    },
  }
}

type DatabaseUser = {
  id: string
  email: string
  passwordHash: string
  createdAt: string
  role: 'admin' | 'user'
}

type FrontendUser = {
  id: string
  email: string
  createdAt: string
  role: 'admin' | 'user'
}

type AiUser = {
  id: string
  email: string
  isAdmin: boolean
}

type LegacyUser = {
  name?: string
  admin?: boolean
}

const databaseUserSchema = createMockSchema<DatabaseUser>('DatabaseUser', (value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  const rec = value as Record<string, unknown>
  if (typeof rec['id'] !== 'string') {
    return { ok: false, message: 'id must be string' }
  }
  if (typeof rec['email'] !== 'string') {
    return { ok: false, message: 'email must be string' }
  }
  if (typeof rec['passwordHash'] !== 'string') {
    return { ok: false, message: 'passwordHash must be string' }
  }
  if (typeof rec['createdAt'] !== 'string') {
    return { ok: false, message: 'createdAt must be string' }
  }
  if (rec['role'] !== 'admin' && rec['role'] !== 'user') {
    return { ok: false, message: 'role must be admin or user' }
  }
  return { ok: true, value: value as DatabaseUser }
})

const frontendUserSchema = createMockSchema<FrontendUser>('FrontendUser', (value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  const rec = value as Record<string, unknown>
  if (typeof rec['id'] !== 'string') {
    return { ok: false, message: 'id must be string' }
  }
  if (typeof rec['email'] !== 'string') {
    return { ok: false, message: 'email must be string' }
  }
  if (typeof rec['createdAt'] !== 'string') {
    return { ok: false, message: 'createdAt must be string' }
  }
  if (rec['role'] !== 'admin' && rec['role'] !== 'user') {
    return { ok: false, message: 'role must be admin or user' }
  }
  return { ok: true, value: value as FrontendUser }
})

const aiUserSchema = createMockSchema<AiUser>('AiUser', (value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  const rec = value as Record<string, unknown>
  if (typeof rec['id'] !== 'string') {
    return { ok: false, message: 'id must be string' }
  }
  if (typeof rec['email'] !== 'string') {
    return { ok: false, message: 'email must be string' }
  }
  if (typeof rec['isAdmin'] !== 'boolean') {
    return { ok: false, message: 'isAdmin must be boolean' }
  }
  return { ok: true, value: value as AiUser }
})

const legacyUserSchema = createMockSchema<LegacyUser>('LegacyUser', (value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as LegacyUser }
})

const userRegistry = createRegistry({
  schemas: {
    database: databaseUserSchema,
    frontend: frontendUserSchema,
    ai: aiUserSchema,
    legacy: legacyUserSchema,
  },

  migrations: {
    'database->frontend': (user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
    }),

    'database->ai': (user) => ({
      id: user.id,
      email: user.email,
      isAdmin: user.role === 'admin',
    }),

    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      isAdmin: user.role === 'admin',
    }),

    'legacy->frontend': (user, ctx) => {
      const id = `legacy-${Date.now()}`
      ctx.defaulted(['id'], 'generated id for legacy user')

      let email = 'unknown@example.com'
      if (typeof user.name === 'string' && user.name.includes('@')) {
        email = user.name
      } else if (typeof user.name === 'string') {
        email = `${user.name.toLowerCase().replaceAll(/\s+/g, '.')}@legacy.example.com`
        ctx.warn(`converted name "${user.name}" to email`)
      } else {
        ctx.defaulted(['email'], 'using default email for legacy user')
      }

      ctx.defaulted(['createdAt'], 'set to current timestamp')

      return {
        id,
        email,
        createdAt: new Date().toISOString(),
        role: user.admin === true ? 'admin' : 'user',
      }
    },
  },

  hooks: {
    onWarning: (msg, from, to) => {
      log(msg, `onWarning:${from}->${to}`)
    },
  },
})

async function main(): Promise<void> {
  const dbUser: DatabaseUser = {
    id: 'user-123',
    email: 'alice@example.com',
    passwordHash: 'hashed_abc123',
    createdAt: '2024-01-15T10:30:00Z',
    role: 'admin',
  }

  log(dbUser, 'main:dbUser')
  console.log()

  log('database -> frontend', 'transform')
  const frontendResult = await userRegistry.transform(dbUser, 'database', 'frontend')
  if (frontendResult.ok === true) {
    log(frontendResult.value, 'transform:database->frontend')
    log(frontendResult.meta.path, 'transform:database->frontend:path')
  } else {
    log(frontendResult.issues, 'transform:database->frontend:error')
  }
  console.log()

  log('database -> ai', 'transform')
  const aiResult = await userRegistry.transform(dbUser, 'database', 'ai')
  if (aiResult.ok === true) {
    log(aiResult.value, 'transform:database->ai')
  } else {
    log(aiResult.issues, 'transform:database->ai:error')
  }
  console.log()

  log('legacy -> frontend', 'transform')
  const legacyUser = { name: 'Bob Smith', admin: true }
  log(legacyUser, 'transform:legacy->frontend:input')
  const upgradedResult = await userRegistry.transform(legacyUser, 'legacy', 'frontend')
  if (upgradedResult.ok === true) {
    log(upgradedResult.value, 'transform:legacy->frontend')
    log(
      upgradedResult.meta.defaults.map((d) => d.message),
      'transform:legacy->frontend:defaults',
    )
  } else {
    log(upgradedResult.issues, 'transform:legacy->frontend:error')
  }
  console.log()

  log('legacy -> ai (path finding)', 'transform')
  const path = userRegistry.findPath('legacy', 'ai')
  log(path, 'findPath:legacy->ai')
  const chainedResult = await userRegistry.transform(legacyUser, 'legacy', 'ai')
  if (chainedResult.ok === true) {
    log(chainedResult.value, 'transform:legacy->ai')
    log(chainedResult.meta.path, 'transform:legacy->ai:path')
  } else {
    log(chainedResult.issues, 'transform:legacy->ai:error')
  }
  console.log()

  log('validate against schemas', 'validate')
  const validFrontend = await userRegistry.validate(
    { id: 'test', email: 'test@test.com', createdAt: '2024-01-01T00:00:00Z', role: 'user' },
    'frontend',
  )
  log(validFrontend.ok, 'validate:frontend:valid')

  const invalidFrontend = await userRegistry.validate(
    { id: 'test', email: 'test@test.com' },
    'frontend',
  )
  log(!invalidFrontend.ok, 'validate:frontend:invalid')
  if (invalidFrontend.ok === false) {
    log(
      invalidFrontend.issues.map((i) => i.message),
      'validate:frontend:issues',
    )
  }
  console.log()

  log('registry introspection', 'registry')
  log(userRegistry.has('database'), 'registry:has:database')
  log(userRegistry.has('unknown'), 'registry:has:unknown')
  log(userRegistry.hasMigration('database', 'frontend'), 'registry:hasMigration:database->frontend')
  log(userRegistry.hasMigration('frontend', 'database'), 'registry:hasMigration:frontend->database')
  console.log()

  log('try also: bun run zod | bun run arktype | bun run valibot', 'info')
}

main().catch(console.error)
