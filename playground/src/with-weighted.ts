/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { z } from 'zod'
import { createRegistry } from 'dobajs'
import { log } from './log'

const v1Schema = z.object({
  id: z.string(),
  name: z.string(),
})

const v2Schema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

const v3Schema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  verified: z.boolean(),
})

const flatSchema = z.object({
  id: z.string(),
  label: z.string(),
})

const registry = createRegistry({
  schemas: {
    v1: v1Schema,
    v2: v2Schema,
    v3: v3Schema,
    flat: flatSchema,
  },

  migrations: {
    'v1->v2': {
      migrate: (user, ctx) => {
        ctx.defaulted(['email'], 'generated from name')
        return {
          id: user.id,
          name: user.name,
          email: `${user.name.toLowerCase().replaceAll(/\s+/g, '.')}@example.com`,
        }
      },
      preferred: true,
      label: 'v1-to-v2-upgrade',
    },

    'v2->v3': {
      migrate: (user, ctx) => {
        ctx.defaulted(['verified'], 'set to false for new migrations')
        return {
          id: user.id,
          displayName: user.name,
          email: user.email,
          verified: false,
        }
      },
      preferred: true,
      label: 'v2-to-v3-upgrade',
    },

    'v1->v3': {
      migrate: (user, ctx) => {
        ctx.warn('direct v1->v3 migration is outdated')
        return {
          id: user.id,
          displayName: user.name,
          email: `${user.name.toLowerCase().replaceAll(/\s+/g, '.')}@example.com`,
          verified: false,
        }
      },
      deprecated: 'prefer v1 -> v2 -> v3 chain for proper defaults',
      label: 'v1-to-v3-legacy',
    },

    'v3->flat': {
      migrate: (user) => ({
        id: user.id,
        label: `${user.displayName} <${user.email}>`,
      }),
      cost: 10,
      label: 'flatten-for-display',
    },

    'v2->flat': {
      migrate: (user) => ({
        id: user.id,
        label: `${user.name} <${user.email}>`,
      }),
      label: 'flatten-v2',
    },
  },

  hooks: {
    onWarning: (msg, from, to) => {
      log(msg, `onWarning:${from}->${to}`)
    },
  },
})

async function main() {
  const user = { id: 'user-1', name: 'Alice Smith' }

  log(
    'v1 -> v3: prefers v1->v2->v3 (preferred, cost 0) over v1->v3 (deprecated, cost 1000)',
    'pathfinding',
  )
  const path = registry.findPath('v1', 'v3')
  log(path, 'findPath:v1->v3')
  console.log()

  log('v1 -> v3 transform (uses preferred path)', 'transform')
  const result = await registry.transform(user, 'v1', 'v3')
  if (result.ok) {
    log(result.value, 'result')
    log(result.meta.path, 'path')
    log(result.meta.steps, 'steps')
    log(result.meta.defaults, 'defaults')
  }
  console.log()

  log(
    'v1 -> flat: v1->v2->flat (cost 0+1=1) beats v1->v2->v3->flat (cost 0+0+10=10)',
    'pathfinding',
  )
  const flatPath = registry.findPath('v1', 'flat')
  log(flatPath, 'findPath:v1->flat')
  console.log()

  log('v1 -> flat transform', 'transform')
  const flatResult = await registry.transform(user, 'v1', 'flat')
  if (flatResult.ok) {
    log(flatResult.value, 'result')
    log(flatResult.meta.path, 'path')
    log(flatResult.meta.steps, 'steps')
  }
  console.log()

  log('force deprecated path with explicit path option', 'transform')
  const forcedResult = await registry.transform(user, 'v1', 'v3', {
    path: ['v1', 'v3'],
  })
  if (forcedResult.ok) {
    log(forcedResult.value, 'result')
    log(forcedResult.meta.steps, 'steps (deprecated flag visible)')
    log(forcedResult.meta.warnings, 'warnings (deprecation notice)')
  }
}

main().catch(console.error)
