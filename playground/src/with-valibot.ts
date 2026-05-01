/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import * as v from 'valibot'
import { createRegistry } from 'dobajs'
import { log } from './log'

const databaseUserSchema = v.object({
  id: v.string(),
  email: v.pipe(v.string(), v.email()),
  passwordHash: v.string(),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  settings: v.object({
    theme: v.picklist(['light', 'dark']),
    notifications: v.object({
      email: v.boolean(),
      push: v.boolean(),
    }),
    internal: v.object({
      lastLoginIp: v.string(),
      failedAttempts: v.number(),
    }),
  }),
})

const frontendUserSchema = v.object({
  id: v.string(),
  email: v.pipe(v.string(), v.email()),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  settings: v.object({
    theme: v.picklist(['light', 'dark']),
    notifications: v.object({
      email: v.boolean(),
      push: v.boolean(),
    }),
  }),
})

const aiUserSchema = v.object({
  id: v.string(),
  email: v.string(),
  theme: v.string(),
  hasNotifications: v.boolean(),
})

const legacyUserSchema = v.object({
  name: v.optional(v.string()),
  darkMode: v.optional(v.boolean()),
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
      hasNotifications: user.settings.notifications.email || user.settings.notifications.push,
    }),

    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      theme: user.settings.theme,
      hasNotifications: user.settings.notifications.email || user.settings.notifications.push,
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
  const dbUser = {
    id: 'user-456',
    email: 'bob@example.com',
    passwordHash: 'hashed_xyz789',
    createdAt: '2024-03-20T15:00:00Z',
    settings: {
      theme: 'light' as const,
      notifications: {
        email: true,
        push: false,
      },
      internal: {
        lastLoginIp: '10.0.0.1',
        failedAttempts: 2,
      },
    },
  }

  log(dbUser, 'main:dbUser')
  console.log()

  log('database -> frontend', 'transform')
  const frontendResult = await userRegistry.transform(dbUser, 'database', 'frontend')
  if (frontendResult.ok) {
    log(frontendResult.value, 'transform:database->frontend')
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

  log('legacy -> frontend', 'transform')
  const legacyUser = { name: 'Alice Johnson', darkMode: true }
  log(legacyUser, 'transform:legacy->frontend:input')
  const upgradedResult = await userRegistry.transform(legacyUser, 'legacy', 'frontend')
  if (upgradedResult.ok) {
    log(upgradedResult.value, 'transform:legacy->frontend')
    log(upgradedResult.meta.path, 'transform:legacy->frontend:path')
  } else {
    log(upgradedResult.issues, 'transform:legacy->frontend:error')
  }
  console.log()

  log('legacy -> ai (path finding)', 'transform')
  const path = userRegistry.findPath('legacy', 'ai')
  log(path, 'findPath:legacy->ai')
  const chainedResult = await userRegistry.transform(legacyUser, 'legacy', 'ai')
  if (chainedResult.ok) {
    log(chainedResult.value, 'transform:legacy->ai')
  } else {
    log(chainedResult.issues, 'transform:legacy->ai:error')
  }
}

main().catch(console.error)
