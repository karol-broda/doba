/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { z } from 'zod'
import { createRegistry } from 'dobajs'
import { log } from './log'

const databaseUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  createdAt: z.string().datetime(),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    }),
    internal: z.object({
      lastLoginIp: z.string(),
      failedAttempts: z.number(),
    }),
  }),
})

const frontendUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    }),
  }),
})

const aiUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  theme: z.string(),
  notificationsEnabled: z.boolean(),
})

const frontendV1Schema = z.object({
  id: z.string(),
  email: z.string(),
  theme: z.string(),
})

const frontendV2Schema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string().datetime(),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean(),
      sms: z.boolean(),
    }),
  }),
})

const userRegistry = createRegistry({
  schemas: {
    database: databaseUserSchema,
    frontend: frontendUserSchema,
    ai: aiUserSchema,
    'frontend:v1': frontendV1Schema,
    'frontend:v2': frontendV2Schema,
  },

  migrations: {
    'database->frontend': (user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      settings: {
        theme: user.settings.theme,
        notifications: user.settings.notifications,
      },
    }),
    'database->ai': (user) => ({
      id: user.id,
      email: user.email,
      theme: user.settings.theme,
      notificationsEnabled:
        user.settings.notifications.email ||
        user.settings.notifications.push ||
        user.settings.notifications.sms,
    }),
    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      theme: user.settings.theme,
      notificationsEnabled:
        user.settings.notifications.email ||
        user.settings.notifications.push ||
        user.settings.notifications.sms,
    }),
    'frontend:v2->frontend:v1': (user) => ({
      id: user.id,
      email: user.email,
      theme: user.settings.theme,
    }),
    'frontend:v1->frontend:v2': (user, ctx) => {
      ctx.defaulted(['settings', 'notifications'], 'defaulting all notifications to true')
      ctx.warn('createdAt set to current timestamp')
      return {
        id: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        settings: {
          theme: user.theme === 'light' || user.theme === 'dark' ? user.theme : 'light',
          notifications: {
            email: true,
            push: true,
            sms: false,
          },
        },
      }
    },
    'frontend->frontend:v2': (user) => user,
    'frontend:v2->frontend': (user) => user,
  },

  hooks: {
    onWarning: (msg, from, to) => {
      log(msg, `onWarning:${from}->${to}`)
    },
  },
})

async function main() {
  const dbUser = {
    id: 'user-123',
    email: 'alice@example.com',
    passwordHash: 'hashed_password_xyz',
    createdAt: '2024-01-15T10:30:00Z',
    settings: {
      theme: 'dark' as const,
      notifications: {
        email: true,
        push: false,
        sms: false,
      },
      internal: {
        lastLoginIp: '192.168.1.1',
        failedAttempts: 0,
      },
    },
  }

  log(dbUser, 'main:dbUser')
  console.log()

  log('database -> frontend', 'transform')
  const frontendResult = await userRegistry.transform(dbUser, 'database', 'frontend')
  if (frontendResult.ok) {
    log(frontendResult.value, 'transform:database->frontend')
    log(frontendResult.meta.path, 'transform:database->frontend:path')
  } else {
    log(frontendResult.issues, 'transform:database->frontend:error')
  }
  console.log()

  log('database -> ai', 'transform')
  const aiResult = await userRegistry.transform(dbUser, 'database', 'ai')
  if (aiResult.ok) {
    log(aiResult.value, 'transform:database->ai')
  } else {
    log(aiResult.issues, 'transform:database->ai:error')
  }
  console.log()

  log('frontend:v2 -> frontend:v1 (backwards)', 'transform')
  const v2User = {
    id: 'user-456',
    email: 'bob@example.com',
    createdAt: '2024-02-01T12:00:00Z',
    settings: {
      theme: 'light' as const,
      notifications: { email: true, push: true, sms: true },
    },
  }
  const v1Result = await userRegistry.transform(v2User, 'frontend:v2', 'frontend:v1')
  if (v1Result.ok) {
    log(v1Result.value, 'transform:frontend:v2->frontend:v1')
  } else {
    log(v1Result.issues, 'transform:frontend:v2->frontend:v1:error')
  }
  console.log()

  log('frontend:v1 -> frontend:v2 (forward with defaults)', 'transform')
  const v1User = { id: 'user-789', email: 'carol@example.com', theme: 'dark' }
  const v2Result = await userRegistry.transform(v1User, 'frontend:v1', 'frontend:v2')
  if (v2Result.ok) {
    log(v2Result.value, 'transform:frontend:v1->frontend:v2')
    log(v2Result.meta.defaults, 'transform:frontend:v1->frontend:v2:defaults')
    log(v2Result.meta.warnings, 'transform:frontend:v1->frontend:v2:warnings')
  } else {
    log(v2Result.issues, 'transform:frontend:v1->frontend:v2:error')
  }
  console.log()

  log('frontend:v1 -> ai (path finding)', 'transform')
  const path = userRegistry.findPath('frontend:v1', 'ai')
  log(path, 'findPath:frontend:v1->ai')
  const chainedResult = await userRegistry.transform(v1User, 'frontend:v1', 'ai')
  if (chainedResult.ok) {
    log(chainedResult.value, 'transform:frontend:v1->ai')
    log(chainedResult.meta.path, 'transform:frontend:v1->ai:path')
  } else {
    log(chainedResult.issues, 'transform:frontend:v1->ai:error')
  }
  console.log()

  log('validate against frontend schema', 'validate')
  const validResult = await userRegistry.validate(
    {
      id: 'test',
      email: 'test@test.com',
      createdAt: '2024-01-01T00:00:00Z',
      settings: {
        theme: 'dark',
        notifications: { email: true, push: false, sms: false },
      },
    },
    'frontend',
  )
  log(validResult.ok, 'validate:frontend:valid')

  const invalidResult = await userRegistry.validate(
    { id: 'test', email: 'not-an-email' },
    'frontend',
  )
  log(!invalidResult.ok, 'validate:frontend:invalid')
  if (!invalidResult.ok) {
    log(invalidResult.issues, 'validate:frontend:issues')
  }
}

main().catch(console.error)
