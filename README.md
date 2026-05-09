<p align="center">
  <img src="docs/public/banner.png" alt="doba - Type-safe schema registry for TypeScript" />
</p>

**doba** is a TypeScript schema registry for transforming data between different schema shapes.

Use it when the same data needs multiple representations: database records, frontend DTOs, AI-friendly payloads, export formats, or legacy versions. Define the shapes once, connect them with typed migrations, and let doba validate and route transforms for you.

## Features

- Type-safe migrations inferred from your schemas
- Automatic path finding across intermediate schemas
- Errors as values, no try/catch required
- Standard Schema support for Zod, Valibot, ArkType, and more
- Migration metadata for warnings, defaults, paths, hooks, and debugging
- Fast lookups and low-overhead transforms

## Install

```bash
bun add dobajs
# or
npm install dobajs
# or
pnpm add dobajs
```

## Example

```ts
import { createRegistry } from 'dobajs'
import { z } from 'zod'

const databaseUser = z.object({
  id: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  role: z.string(),
})

const frontendUser = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
})

const aiUser = z.object({
  id: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
})

const users = createRegistry({
  schemas: {
    database: databaseUser,
    frontend: frontendUser,
    ai: aiUser,
  },
  migrations: {
    'database->frontend': {
      pipe: (p) => p.drop('passwordHash'),
    },
    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      isAdmin: user.role === 'admin',
    }),
  },
})

const result = await users.transform(
  {
    id: 'user-123',
    email: 'alice@example.com',
    passwordHash: 'hashed_xyz',
    role: 'admin',
  },
  'database',
  'ai',
)

if (result.ok) {
  result.value.isAdmin
  result.meta.path // ["database", "frontend", "ai"]
} else {
  result.issues
}
```

## API

```ts
const registry = createRegistry({
  schemas,
  migrations,
  pathStrategy: 'shortest',
  identify,
  hooks,
  debug,
})

await registry.transform(value, from, to, options)
await registry.validate(value, schema)
registry.findPath(from, to)
registry.has(schema)
registry.hasMigration(from, to)
registry.explain(from, to)
```

When `identify` is configured, the registry also exposes:

```ts
await registry.identify(value)
await registry.identifyAndTransform(value, to, options)
```

## Docs

Full documentation: <https://doba.karolbroda.com/docs>

Useful pages:

- [Quick Start](https://doba.karolbroda.com/docs/quick-start)
- [Migrations](https://doba.karolbroda.com/docs/migrations)
- [Migration Helpers](https://doba.karolbroda.com/docs/helpers)
- [Path Finding](https://doba.karolbroda.com/docs/path-finding)
- [API Reference](https://doba.karolbroda.com/docs/api/registry)
- [Performance](https://doba.karolbroda.com/docs/performance)

## Development

```bash
bun install
bun run test
bun run test:types
bun run typecheck
bun run build
```

Run examples:

```bash
bun run --filter doba-playground zod
bun run --filter doba-playground arktype
bun run --filter doba-playground valibot
```

Nix users can run:

```bash
nix develop
nix build .#vitest-all
nix build .#smoke-all
```

## License

MIT
