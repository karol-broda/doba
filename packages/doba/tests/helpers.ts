import type { StandardSchemaV1 } from '../src/standard-schema.js'

// --- Schema factory ---

export function createMockSchema<T>(
  validator: (
    value: unknown,
  ) => { ok: true; value: T } | { ok: false; message: string; path?: readonly PropertyKey[] },
): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: unknown) => {
        const result = validator(value)
        if (result.ok === true) {
          return { value: result.value }
        }
        return {
          issues: [{ message: result.message, path: result.path }],
        }
      },
    },
  }
}

export function createAsyncMockSchema<T>(
  validator: (value: unknown) => { ok: true; value: T } | { ok: false; message: string },
  delayMs = 10,
): StandardSchemaV1<unknown, T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test-async',
      validate: async (value: unknown) => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delayMs)
        })
        const result = validator(value)
        if (result.ok === true) {
          return { value: result.value }
        }
        return { issues: [{ message: result.message }] }
      },
    },
  }
}

// helper: build migrations from a Record without triggering key inference
// eslint-disable-next-line typescript/no-explicit-any
export function dynamicMigrations(m: Record<string, unknown>): any {
  return m
}

// --- Domain types ---

export type DatabaseUser = {
  id: string
  email: string
  passwordHash: string
  createdAt: string
  role: 'admin' | 'user'
}

export type FrontendUser = {
  id: string
  email: string
  createdAt: string
  role: 'admin' | 'user'
}

export type AiUser = {
  id: string
  email: string
  isAdmin: boolean
}

export type LegacyUser = {
  name?: string
  admin?: boolean
}

// --- Schema validators ---

function validateObject(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object'
}

export const databaseUserSchema = createMockSchema<DatabaseUser>((value) => {
  if (!validateObject(value)) {
    return { ok: false, message: 'expected object' }
  }
  if (typeof value['id'] !== 'string') {
    return { ok: false, message: 'id must be string', path: ['id'] }
  }
  if (typeof value['email'] !== 'string') {
    return { ok: false, message: 'email must be string', path: ['email'] }
  }
  if (typeof value['passwordHash'] !== 'string') {
    return { ok: false, message: 'passwordHash must be string', path: ['passwordHash'] }
  }
  if (typeof value['createdAt'] !== 'string') {
    return { ok: false, message: 'createdAt must be string', path: ['createdAt'] }
  }
  if (value['role'] !== 'admin' && value['role'] !== 'user') {
    return { ok: false, message: 'role must be admin or user', path: ['role'] }
  }
  return { ok: true, value: value as DatabaseUser }
})

export const frontendUserSchema = createMockSchema<FrontendUser>((value) => {
  if (!validateObject(value)) {
    return { ok: false, message: 'expected object' }
  }
  if (typeof value['id'] !== 'string') {
    return { ok: false, message: 'id must be string', path: ['id'] }
  }
  if (typeof value['email'] !== 'string') {
    return { ok: false, message: 'email must be string', path: ['email'] }
  }
  if (typeof value['createdAt'] !== 'string') {
    return { ok: false, message: 'createdAt must be string', path: ['createdAt'] }
  }
  if (value['role'] !== 'admin' && value['role'] !== 'user') {
    return { ok: false, message: 'role must be admin or user', path: ['role'] }
  }
  return { ok: true, value: value as FrontendUser }
})

export const aiUserSchema = createMockSchema<AiUser>((value) => {
  if (!validateObject(value)) {
    return { ok: false, message: 'expected object' }
  }
  if (typeof value['id'] !== 'string') {
    return { ok: false, message: 'id must be string', path: ['id'] }
  }
  if (typeof value['email'] !== 'string') {
    return { ok: false, message: 'email must be string', path: ['email'] }
  }
  if (typeof value['isAdmin'] !== 'boolean') {
    return { ok: false, message: 'isAdmin must be boolean', path: ['isAdmin'] }
  }
  return { ok: true, value: value as AiUser }
})

export const legacyUserSchema = createMockSchema<LegacyUser>((value) => {
  if (!validateObject(value)) {
    return { ok: false, message: 'expected object' }
  }
  return { ok: true, value: value as LegacyUser }
})

// --- Shared fixtures ---

export const userSchemas = {
  database: databaseUserSchema,
  frontend: frontendUserSchema,
  ai: aiUserSchema,
  legacy: legacyUserSchema,
} as const

export const userMigrations = {
  'database->frontend': (user: DatabaseUser): FrontendUser => ({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    role: user.role,
  }),
  'database->ai': (user: DatabaseUser): AiUser => ({
    id: user.id,
    email: user.email,
    isAdmin: user.role === 'admin',
  }),
  'frontend->ai': (user: FrontendUser): AiUser => ({
    id: user.id,
    email: user.email,
    isAdmin: user.role === 'admin',
  }),
  'legacy->frontend': (user: LegacyUser): FrontendUser => {
    const id = `legacy-${Date.now()}`
    let email = 'unknown@example.com'
    if (typeof user.name === 'string' && user.name.length > 0) {
      email = `${user.name.toLowerCase().replaceAll(/\s+/g, '.')}@legacy.example.com`
    }
    return {
      id,
      email,
      createdAt: new Date().toISOString(),
      role: user.admin === true ? 'admin' : 'user',
    }
  },
} as const

export const sampleDatabaseUser: DatabaseUser = {
  id: 'user-123',
  email: 'alice@example.com',
  passwordHash: 'hashed_password_xyz',
  createdAt: '2024-01-15T10:30:00Z',
  role: 'admin',
}

export const sampleFrontendUser: FrontendUser = {
  id: 'user-123',
  email: 'alice@example.com',
  createdAt: '2024-01-15T10:30:00Z',
  role: 'admin',
}

export const sampleAiUser: AiUser = {
  id: 'user-123',
  email: 'alice@example.com',
  isAdmin: true,
}

export const sampleLegacyUser: LegacyUser = {
  name: 'Bob Smith',
  admin: true,
}
