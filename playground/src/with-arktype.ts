/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { type } from 'arktype'
import { createRegistry } from 'dobajs'
import { log } from './log'

const databaseUserSchema = type({
  id: 'string',
  email: 'string.email',
  passwordHash: 'string',
  createdAt: 'string',
  settings: {
    theme: "'light' | 'dark'",
    notifications: {
      email: 'boolean',
      push: 'boolean',
    },
    internal: {
      lastLoginIp: 'string',
      sessionCount: 'number',
    },
  },
})

const frontendUserSchema = type({
  id: 'string',
  email: 'string.email',
  createdAt: 'string',
  settings: {
    theme: "'light' | 'dark'",
    notifications: {
      email: 'boolean',
      push: 'boolean',
    },
  },
})

const aiUserSchema = type({
  id: 'string',
  email: 'string',
  theme: 'string',
  notificationsEnabled: 'boolean',
})

const legacyUserSchema = type({
  'name?': 'string',
  'darkMode?': 'boolean',
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
      settings: {
        theme: user.settings.theme,
        notifications: user.settings.notifications,
      },
    }),

    'database->ai': (user) => ({
      id: user.id,
      email: user.email,
      theme: user.settings.theme,
      notificationsEnabled: user.settings.notifications.email || user.settings.notifications.push,
    }),

    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      theme: user.settings.theme,
      notificationsEnabled: user.settings.notifications.email || user.settings.notifications.push,
    }),

    'legacy->frontend': (user, ctx) => {
      ctx.defaulted(['id'], 'generated new id')
      ctx.defaulted(['createdAt'], 'set to current timestamp')
      ctx.defaulted(['settings', 'notifications'], 'defaulted to all false')

      let email = 'unknown@example.com'
      if (typeof user.name === 'string' && user.name.length > 0) {
        email = `${user.name.toLowerCase().replaceAll(/\s+/g, '.')}@legacy.example.com`
        ctx.warn(`converted name "${user.name}" to email`)
      }

      return {
        id: `legacy-${Date.now()}`,
        email,
        createdAt: new Date().toISOString(),
        settings: {
          theme: user.darkMode === true ? 'dark' : 'light',
          notifications: {
            email: false,
            push: false,
          },
        },
      }
    },
  },

  hooks: {
    onWarning: (msg, from, to) => {
      log(msg, `onWarning:${from}->${to}`)
    },
  },
})

async function main() {
  const dbUser: typeof databaseUserSchema.infer = {
    id: 'user-789',
    email: 'charlie@example.com',
    passwordHash: 'hashed_secret123',
    createdAt: '2024-05-10T08:00:00Z',
    settings: {
      theme: 'dark',
      notifications: {
        email: true,
        push: true,
      },
      internal: {
        lastLoginIp: '192.168.0.100',
        sessionCount: 42,
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
    log(frontendResult.meta.steps, 'transform:database->frontend:steps')
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

  log('legacy -> ai (path finding)', 'transform')
  const legacyUser: typeof legacyUserSchema.infer = { name: 'Diana Prince', darkMode: true }
  const path = userRegistry.findPath('legacy', 'ai')
  log(path, 'findPath:legacy->ai')
  const chainedResult = await userRegistry.transform(legacyUser, 'legacy', 'ai')
  if (chainedResult.ok) {
    log(chainedResult.value, 'transform:legacy->ai')
    log(chainedResult.meta.path, 'transform:legacy->ai:path')
    log(chainedResult.meta.steps, 'transform:legacy->ai:steps')
  } else {
    log(chainedResult.issues, 'transform:legacy->ai:error')
  }
}

main().catch(console.error)
