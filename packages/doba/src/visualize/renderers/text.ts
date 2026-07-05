import type { GraphEdge, GraphSnapshot, NormalizedVisualizeOptions } from '../types.js'

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function formatMigration<K extends string>(
  migration: GraphEdge<K>,
  options: NormalizedVisualizeOptions,
): string {
  if (options.costs) {
    return `${migration.to} (cost: ${migration.cost})`
  }

  return migration.to
}

function migrationsBySource<K extends string>(snapshot: GraphSnapshot<K>): Map<K, GraphEdge<K>[]> {
  const migrations = new Map<K, GraphEdge<K>[]>()

  for (const node of snapshot.nodes) {
    migrations.set(node, [])
  }

  for (const edge of snapshot.edges) {
    const outgoing = migrations.get(edge.from)
    if (outgoing !== undefined) {
      outgoing.push(edge)
    }
  }

  return migrations
}

export function renderText<K extends string>(
  snapshot: GraphSnapshot<K>,
  options: NormalizedVisualizeOptions,
): string {
  const schemaLabel = pluralize(snapshot.nodes.length, 'schema', 'schemas')
  const migrationLabel = pluralize(snapshot.edges.length, 'migration', 'migrations')
  const lines = [
    `${options.title} (${snapshot.nodes.length} ${schemaLabel}, ${snapshot.edges.length} ${migrationLabel})`,
    '',
  ]
  const outgoingMigrations = migrationsBySource(snapshot)

  for (const node of snapshot.nodes) {
    const migrations = outgoingMigrations.get(node)
    lines.push(`● ${node}`)

    if (migrations === undefined || migrations.length === 0) {
      lines.push('  └─ no outgoing migrations', '')
      continue
    }

    for (let index = 0; index < migrations.length; index++) {
      const migration = migrations[index]
      if (migration === undefined) {
        continue
      }

      const branch = index === migrations.length - 1 ? '└' : '├'
      lines.push(`  ${branch}─▶ ${formatMigration(migration, options)}`)
    }

    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
