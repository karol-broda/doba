/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { z } from 'zod'
import { createRegistry, pipe } from 'dobajs'

const v1 = z.object({
  id: z.string(),
  userName: z.string(),
  isAdmin: z.boolean(),
})
const v2 = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['admin', 'user']),
  email: z.string(),
})
const v3 = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
  role: z.string(),
})

type V1 = z.infer<typeof v1>

const registry = createRegistry({
  schemas: { v1, v2, v3 },

  migrations: {
    'v1->v2': {
      migrate: pipe<V1>()
        .rename('userName', 'name')
        .add('role', 'user')
        .add('email', () => 'unknown@example.com')
        .drop('isAdmin'),
      label: 'upgrade-to-v2',
    },
    'v2->v3': {
      migrate: (user) => ({
        id: user.id,
        displayName: user.name,
        email: user.email,
        role: user.role,
      }),
      label: 'upgrade-to-v3',
    },
  },

  debug: true,
})

async function main() {
  console.log('--- just pass debug: true and watch ---')
  console.log()

  const user = { id: 'user-1', userName: 'Alice Smith', isAdmin: true }
  await registry.transform(user, 'v1', 'v3', { validate: 'none' })

  console.log()
  console.log('--- that was it, no setup needed ---')
  console.log()

  console.log('--- errors are informative too ---')
  console.log()
  await registry.transform({ id: '1', displayName: 'x', email: 'x', role: 'x' }, 'v3', 'v1')
}

main().catch(console.error)
