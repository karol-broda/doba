export const features = [
  ['Type-safe migrations', 'Input and output types checked at compile time.'],
  ['Automatic path finding', 'BFS finds the shortest route through your migration graph.'],
  ['Errors as values', 'Discriminated Result type. No exceptions, just check .ok.'],
  ['Standard Schema', 'Zod, Valibot, ArkType, or any Standard Schema.'],
  ['Migration context', 'Warnings, defaults, audit trail tracked per step.'],
  ['Zero copy', 'Transforms pass references. No cloning.'],
] as const

export const stats = [
  { value: '~2ns', label: 'Lookup' },
  { value: '~505ns', label: 'Transform' },
  { value: '2.0M/s', label: 'Throughput' },
  { value: '2.3M/s', label: 'Batch' },
] as const

export const exampleCode = `import { createRegistry } from 'dobajs'
import { z } from 'zod'

const registry = createRegistry({
  schemas: {
    database: z.object({
      id: z.string(),
      email: z.string(),
      passwordHash: z.string(),
      role: z.enum(['admin', 'user']),
    }),
    frontend: z.object({
      id: z.string(),
      email: z.string(),
      role: z.enum(['admin', 'user']),
    }),
  },
  migrations: {
    'database->frontend': (user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
    }),
  },
})

const result = await registry.transform(dbUser, 'database', 'frontend')`
