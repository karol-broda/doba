/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { z } from 'zod'
import { createRegistry, pipe } from 'dobajs'

import { log } from './log'

const v1Schema = z.object({
  userName: z.string(),
  isAdmin: z.boolean(),
  legacyId: z.number(),
})

const v2Schema = z.object({
  name: z.string(),
  role: z.enum(['admin', 'user']),
  email: z.string(),
})

const v3Schema = z.object({
  name: z.string(),
  role: z.enum(['admin', 'user']),
  email: z.string(),
  verified: z.boolean(),
})

type V1 = z.infer<typeof v1Schema>
type V2 = z.infer<typeof v2Schema>

const registry = createRegistry({
  schemas: { v1: v1Schema, v2: v2Schema, v3: v3Schema },

  migrations: {
    // type-safe builder: field names autocomplete, map callback is typed
    'v1->v2': pipe<V1>()
      .rename('userName', 'name')
      .map('isAdmin', (v) => (v ? 'admin' : 'user'))
      .rename('isAdmin', 'role')
      .drop('legacyId')
      .add('email', () => 'unknown@example.com'),

    'v2->v3': pipe<V2>().add('verified', false),
  },

  hooks: {
    onWarning: (msg, from, to) => {
      log(msg, `onWarning:${from}->${to}`)
    },
  },
})

async function main() {
  const user = { userName: 'Alice Smith', isAdmin: true, legacyId: 42 }
  log(user, 'input:v1')
  console.log()

  log('v1 -> v2 using pipe<V1>().rename().map().rename().drop().add()', 'transform')
  const v2Result = await registry.transform(user, 'v1', 'v2', { validate: 'none' })
  if (v2Result.ok) {
    log(v2Result.value, 'result')
    log(v2Result.meta.defaults, 'defaults')
  }
  console.log()

  log('v1 -> v3 auto-chaining through v2', 'transform')
  const v3Result = await registry.transform(user, 'v1', 'v3', { validate: 'none' })
  if (v3Result.ok) {
    log(v3Result.value, 'result')
    log(v3Result.meta.path, 'path')
    log(v3Result.meta.defaults, 'defaults (from both steps)')
  }
}

main().catch(console.error)
