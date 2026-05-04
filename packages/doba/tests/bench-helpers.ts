import { createRegistry } from '../src/index.js'
import { createMockSchema, dynamicMigrations } from './helpers.js'

// ---- shared types ----

export type Node = { id: string; data: string }

// ---- shared schemas ----

export const nodeSchema = createMockSchema<Node>((value) => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return { ok: false, message: 'expected object' }
  }
  const rec = value as Record<string, unknown>
  if (typeof rec['id'] !== 'string') {
    return { ok: false, message: 'id must be string' }
  }
  if (typeof rec['data'] !== 'string') {
    return { ok: false, message: 'data must be string' }
  }
  return { ok: true, value: value as Node }
})

export const sampleNode: Node = { id: 'test-1', data: 'payload' }

// ---- registry factories ----

export function createLinearChain(length: number) {
  const schemas: Record<string, typeof nodeSchema> = {}
  const migrations: Record<string, unknown> = {}
  for (let i = 0; i < length; i++) {
    schemas[`s${i}`] = nodeSchema
  }
  for (let i = 0; i < length - 1; i++) {
    migrations[`s${i}->s${i + 1}`] = (v: Node) => ({ id: v.id, data: `${v.data}.` })
  }
  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

export function createWideGraph(width: number, depth: number) {
  const schemas: Record<string, typeof nodeSchema> = {}
  const migrations: Record<string, unknown> = {}
  for (let d = 0; d < depth; d++) {
    for (let w = 0; w < width; w++) {
      schemas[`s${d}_${w}`] = nodeSchema
    }
  }
  for (let d = 0; d < depth - 1; d++) {
    for (let w = 0; w < width; w++) {
      for (let nw = 0; nw < width; nw++) {
        migrations[`s${d}_${w}->s${d + 1}_${nw}`] = (v: Node) => ({
          id: v.id,
          data: `${v.data}.`,
        })
      }
    }
  }
  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}

export function createManySchemas(count: number) {
  const schemas: Record<string, typeof nodeSchema> = {}
  const migrations: Record<string, unknown> = {}
  for (let i = 0; i < count; i++) {
    schemas[`schema${i}`] = nodeSchema
  }
  for (let i = 0; i < count - 1; i++) {
    migrations[`schema${i}->schema${i + 1}`] = (v: Node) => v
  }
  return createRegistry({ schemas, migrations: dynamicMigrations(migrations) })
}
