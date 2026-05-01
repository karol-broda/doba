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
  role: z.enum(['admin', 'user']),
})

const frontendUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  role: z.enum(['admin', 'user']),
})

const aiUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
})

const userRegistry = createRegistry({
  schemas: {
    database: databaseUserSchema,
    frontend: frontendUserSchema,
    ai: aiUserSchema,
  },

  migrations: {
    'database<->frontend': {
      forward: (user) => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        role: user.role,
      }),
      backward: (user, ctx) => {
        ctx.defaulted(['passwordHash'], 'set to empty string')
        return {
          id: user.id,
          email: user.email,
          passwordHash: '',
          createdAt: user.createdAt,
          role: user.role,
        }
      },
      label: 'db-frontend-sync',
    },

    'database->frontend': (user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
    }),

    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      isAdmin: user.role === 'admin',
    }),
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
    passwordHash: 'hashed_abc',
    createdAt: '2024-01-15T10:30:00Z',
    role: 'admin' as const,
  }

  log('database -> frontend (forward)', 'transform')
  const frontendResult = await userRegistry.transform(dbUser, 'database', 'frontend')
  if (frontendResult.ok) {
    log(frontendResult.value, 'result')
    log(frontendResult.meta.steps, 'steps')
  }
  console.log()

  log('frontend -> database (backward)', 'transform')
  const feUser = {
    id: 'user-123',
    email: 'alice@example.com',
    createdAt: '2024-01-15T10:30:00Z',
    role: 'admin' as const,
  }
  const dbResult = await userRegistry.transform(feUser, 'frontend', 'database')
  if (dbResult.ok) {
    log(dbResult.value, 'result')
    log(dbResult.meta.defaults, 'defaults')
    log(dbResult.meta.steps, 'steps')
  }
  console.log()

  log('frontend -> ai (one-way)', 'transform')
  const aiResult = await userRegistry.transform(feUser, 'frontend', 'ai')
  if (aiResult.ok) {
    log(aiResult.value, 'result')
  }
  console.log()

  log('database -> ai (auto path through frontend)', 'transform')
  const chainResult = await userRegistry.transform(dbUser, 'database', 'ai')
  if (chainResult.ok) {
    log(chainResult.value, 'result')
    log(chainResult.meta.path, 'path')
    log(chainResult.meta.steps, 'steps')
  }
  console.log()

  log('one-way override demo', 'info')
  const overrideWarnings: string[] = []
  const overrideRegistry = createRegistry({
    schemas: {
      database: databaseUserSchema,
      frontend: frontendUserSchema,
    },
    migrations: {
      'database->frontend': (user) => ({
        id: user.id,
        email: `${user.email} (explicit one-way)`,
        createdAt: user.createdAt,
        role: user.role,
      }),
      'database<->frontend': {
        forward: (user) => ({
          id: user.id,
          email: `${user.email} (reversible)`,
          createdAt: user.createdAt,
          role: user.role,
        }),
        backward: (user) => ({
          id: user.id,
          email: user.email,
          passwordHash: '',
          createdAt: user.createdAt,
          role: user.role,
        }),
      },
    },
    hooks: {
      onWarning: (msg) => overrideWarnings.push(msg),
    },
  })
  const overrideResult = await overrideRegistry.transform(dbUser, 'database', 'frontend', {
    validate: 'none',
  })
  if (overrideResult.ok) {
    log(overrideResult.value, 'result')
  }
  log(overrideWarnings, 'warnings')
}

main().catch(console.error)
