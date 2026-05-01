# doba

Schema registry with flexible transformations. Type-safe migrations between any schemas, errors as values.

## Performance

Benchmarked on Apple M3 Pro with [mitata](https://github.com/evanwashere/mitata).

| Operation              | Time    | Throughput   |
| ---------------------- | ------- | ------------ |
| `has()` lookup         | ~2ns    | 500M ops/sec |
| `validate()`           | ~108ns  | 9.3M ops/sec |
| `transform` (1 hop)    | ~505ns  | 2.0M ops/sec |
| `transform` (10 hops)  | ~1.8µs  | 560K ops/sec |
| `transform` (99 hops)  | ~13.9µs | 72K ops/sec  |
| `findPath` (100 nodes) | ~7.5µs  | 133K ops/sec |

Lookups are O(1) regardless of registry size. Transforms scale linearly at ~140ns per hop. The graph is built once at registry creation.

Hooks add ~19% (timing is skipped entirely when no hooks are registered), pipe builder costs ~2x vs bare functions, providing an explicit path saves ~52%. See the [full benchmark results](https://doba.karolbroda.com/docs/performance) for tradeoffs and edge cases.

> Run benchmarks yourself: `bun run bench`, `bun tests/features.bench.ts`, or `bun tests/stress.bench.ts`

## Installation

```bash
bun add doba
# or
npm install doba
# or
pnpm add doba
```

## Quick Start

```typescript
import { createRegistry } from 'doba'
import { z } from 'zod'

// define different schema variants
const databaseUser = z.object({
  id: z.string(),
  email: z.string(),
  passwordHash: z.string(),
  createdAt: z.string(),
  role: z.enum(['admin', 'user']),
})

const frontendUser = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),
  role: z.enum(['admin', 'user']),
})

const aiUser = z.object({
  id: z.string(),
  email: z.string(),
  isAdmin: z.boolean(),
})

// create registry with schemas and migrations
const userRegistry = createRegistry({
  schemas: {
    database: databaseUser,
    frontend: frontendUser,
    ai: aiUser,
  },
  migrations: {
    // strip sensitive data for frontend
    'database->frontend': (user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      role: user.role,
    }),
    // flatten for ai context
    'database->ai': (user) => ({
      id: user.id,
      email: user.email,
      isAdmin: user.role === 'admin',
    }),
    // frontend to ai also works
    'frontend->ai': (user) => ({
      id: user.id,
      email: user.email,
      isAdmin: user.role === 'admin',
    }),
  },
})

// transform between schemas
const dbUser = {
  id: 'user-123',
  email: 'alice@example.com',
  passwordHash: 'hashed_xyz',
  createdAt: '2024-01-15T10:30:00Z',
  role: 'admin' as const,
}

const result = await userRegistry.transform(dbUser, 'database', 'frontend')
if (result.ok) {
  console.log(result.value)
  // { id: "user-123", email: "alice@example.com", createdAt: "...", role: "admin" }
  // passwordHash is stripped!
}
```

## Use Cases

### Schema Variants (not just versions)

```typescript
const registry = createRegistry({
  schemas: {
    // different representations of the same data
    database: databaseSchema, // full data with sensitive fields
    frontend: frontendSchema, // stripped for client
    ai: aiSchema, // simplified for llm context
    export: exportSchema, // format for data export

    // versioned schemas work too
    v1: legacySchema,
    v2: currentSchema,
  },
  migrations: {
    'database->frontend': (data) => {
      /* strip sensitive */
    },
    'database->ai': (data) => {
      /* flatten */
    },
    'v1->v2': (data, ctx) => {
      /* upgrade */
    },
    'v2->v1': (data) => {
      /* downgrade if needed */
    },
  },
})
```

### Automatic Path Finding

```typescript
const registry = createRegistry({
  schemas: { legacy, database, frontend, ai },
  migrations: {
    'legacy->database': (data) => {
      /* upgrade */
    },
    'database->frontend': (data) => {
      /* strip */
    },
    'frontend->ai': (data) => {
      /* flatten */
    },
  },
})

// finds path: legacy -> database -> frontend -> ai
const result = await registry.transform(legacyData, 'legacy', 'ai')
console.log(result.meta.path) // ["legacy", "database", "frontend", "ai"]
```

### Bidirectional Migrations

```typescript
migrations: {
  "v2->v1": (data) => { /* downgrade */ },
  "v1->v2": (data) => { /* upgrade */ },
  "frontend->database": (data, ctx) => {
    ctx.defaulted(["passwordHash"], "set to empty");
    return { ...data, passwordHash: "" };
  },
}
```

## API

### `createRegistry(config)`

Create a schema registry with migrations.

```typescript
const registry = createRegistry({
  schemas: {
    /* schema map */
  },
  migrations: {
    /* migration functions */
  },
  pathStrategy: 'shortest', // or "direct"
  hooks: {
    onWarning: (msg, from, to) => console.log(`[${from}->${to}] ${msg}`),
  },
})
```

### `registry.transform(value, from, to, options?)`

Transform a value from one schema to another.

```typescript
const result = await registry.transform(data, 'database', 'frontend')

if (result.ok) {
  result.value // typed as frontend schema output
  result.meta.path // ["database", "frontend"]
  result.meta.warnings // WarningInfo[]
  result.meta.defaults // DefaultedInfo[]
} else {
  result.issues // DobaIssue[]
}
```

**Options:**

```typescript
{
  path: ["database", "intermediate", "frontend"], // explicit path
  validate: "end" | "each" | "none",              // validation strategy
}
```

### `registry.validate(value, schema)`

Validate a value against a specific schema.

```typescript
const result = await registry.validate(data, 'frontend')

if (result.ok) {
  result.value // validated and typed
  result.meta.schema // "frontend"
} else {
  result.issues // validation errors
}
```

### `registry.findPath(from, to)`

Find the migration path between two schemas.

```typescript
const path = registry.findPath('legacy', 'ai')
// ["legacy", "database", "frontend", "ai"] or null if no path
```

### `registry.has(schema)`

Check if a schema exists.

```typescript
registry.has('database') // true
registry.has('unknown') // false
```

### `registry.hasMigration(from, to)`

Check if a direct migration exists.

```typescript
registry.hasMigration('database', 'frontend') // true
registry.hasMigration('frontend', 'database') // false (unless defined)
```

## Migration Context

Migrations receive a context object for tracking changes:

```typescript
migrations: {
  "legacy->current": (value, ctx) => {
    // log a warning
    ctx.warn("upgrading from legacy format");

    // track defaulted values
    ctx.defaulted(["settings", "theme"], "defaulting to light theme");

    // access migration info
    console.log(ctx.from, ctx.to); // "legacy", "current"

    return { /* transformed value */ };
  },
}
```

## Path Strategies

### `shortest` (default)

Finds the shortest path through the migration graph using BFS.

```typescript
createRegistry({
  pathStrategy: 'shortest',
  // ...
})
```

### `direct`

Only uses direct migrations, fails if no direct path exists.

```typescript
createRegistry({
  pathStrategy: 'direct',
  // ...
})
```

## Validation Strategies

### `end` (default)

Validates only the final result after all migrations.

### `each`

Validates after each migration step (useful for debugging).

### `none`

Skips validation entirely (use when you trust your migrations).

```typescript
await registry.transform(data, 'a', 'b', { validate: 'each' })
```

## Type Safety

The registry is fully typed based on your schema definitions:

```typescript
// schema keys are typed
registry.transform(data, 'database', 'frontend') // ✓
registry.transform(data, 'database', 'unknown') // ✗ type error

// input must match source schema
registry.transform(dbUser, 'database', 'frontend') // ✓
registry.transform(frontendUser, 'database', 'frontend') // ✗ type error

// output is inferred from target schema
const result = await registry.transform(dbUser, 'database', 'ai')
if (result.ok) {
  result.value.isAdmin // ✓ typed as boolean
  result.value.passwordHash // ✗ type error (not on ai schema)
}
```

## Workspace Structure

```
doba/
├── packages/
│   └── doba/           # main library
│       ├── src/        # source code
│       └── tests/      # tests
└── playground/         # interactive examples
    └── src/
        ├── index.ts        # mock schema example
        ├── with-zod.ts     # zod example
        ├── with-arktype.ts # arktype example
        └── with-valibot.ts # valibot example
```

## Development

```bash
# install dependencies
bun install

# run tests
bun test

# run type tests
bun run --filter doba test:types

# run benchmarks
bun run --filter doba bench

# run feature benchmarks
bun run --filter doba bench:features

# run stress tests
bun run --filter doba bench:stress

# run playground examples
bun run --filter playground zod
bun run --filter playground arktype
bun run --filter playground valibot

# build
bun run --filter doba build
```

## Testing

The test suite includes:

- **Unit tests** (`tests/*.test.ts`) - Core functionality tests
- **Type tests** (`tests/*.test-d.ts`) - Compile-time type safety verification
- **Benchmarks** (`tests/*.bench.ts`) - Performance benchmarks using [mitata](https://github.com/evanwashere/mitata)

> **Note**: Tests and benchmarks were largely AI-written (Claude) and reviewed for correctness.

## License

MIT
