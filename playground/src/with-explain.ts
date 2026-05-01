/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { z } from 'zod'
import { createRegistry } from 'dobajs'
import { log } from './log'

const v1 = z.object({ id: z.string(), name: z.string() })
const v2 = z.object({ id: z.string(), name: z.string(), email: z.string() })
const v3 = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  verified: z.boolean(),
})
const flat = z.object({ id: z.string(), label: z.string() })

const registry = createRegistry({
  schemas: { v1, v2, v3, flat },

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
      migrate: (user) => ({
        id: user.id,
        displayName: user.name,
        email: `${user.name.toLowerCase().replaceAll(/\s+/g, '.')}@example.com`,
        verified: false,
      }),
      deprecated: 'prefer v1 -> v2 -> v3 chain',
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
  },
})

async function main() {
  log('explain v1 -> v3 (prefers v1->v2->v3 over deprecated v1->v3)', 'explain')
  const explain1 = registry.explain('v1', 'v3')
  log(explain1.summary, 'summary')
  log(explain1.steps, 'steps')
  log(explain1.totalCost, 'totalCost')
  console.log()

  log('explain v1 -> flat (picks cheapest route)', 'explain')
  const explain2 = registry.explain('v1', 'flat')
  log(explain2.summary, 'summary')
  console.log()

  log('explain v3 -> v1 (no path exists)', 'explain')
  const explain3 = registry.explain('v3', 'v1')
  log(explain3.summary, 'summary')
  log(explain3.path, 'path')
  console.log()

  log('explain v2 -> v2 (same schema)', 'explain')
  const explain4 = registry.explain('v2', 'v2')
  log(explain4.summary, 'summary')
  console.log()

  log('now try a transform that fails and see the improved error', 'error')
  const result = await registry.transform({ id: '1', name: 'test' }, 'v1', 'v2')
  if (!result.ok) {
    log(result.issues, 'issues')
  }
  console.log()

  log('transform with no path (look at the error details)', 'error')
  const noPath = await registry.transform(
    { id: '1', displayName: 'test', email: 'x', verified: true },
    'v3',
    'v1',
  )
  if (!noPath.ok) {
    log(noPath.issues[0]?.message, 'message')
    log(noPath.issues[0]?.meta, 'meta')
  }
}

main().catch(console.error)
