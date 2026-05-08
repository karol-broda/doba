// runtime agnostic smoke test for the built dobajs bundle.
// imports the esm dist and exercises the public api using node:assert,
// which is available on node, bun and deno. throwing on failure yields a
// nonzero exit so the surrounding nix derivation fails the build.
import assert from 'node:assert/strict'
import { createRegistry } from './index.mjs'
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, mapErr } from './result.mjs'

// minimal standard schema factory mirroring the test fixtures.
const schema = (validate) => ({
  '~standard': {
    version: 1,
    vendor: 'smoke',
    validate,
  },
})

const isObject = (v) => v !== null && typeof v === 'object'

const databaseUser = schema((value) => {
  if (!isObject(value)) {
    return { issues: [{ message: 'expected object' }] }
  }
  if (typeof value.id !== 'string') {
    return { issues: [{ message: 'id must be string', path: ['id'] }] }
  }
  if (value.role !== 'admin' && value.role !== 'user') {
    return { issues: [{ message: 'bad role', path: ['role'] }] }
  }
  return { value }
})

const frontendUser = schema((value) => {
  if (!isObject(value)) {
    return { issues: [{ message: 'expected object' }] }
  }
  if (typeof value.id !== 'string') {
    return { issues: [{ message: 'id must be string', path: ['id'] }] }
  }
  return { value }
})

const aiUser = schema((value) => {
  if (!isObject(value)) {
    return { issues: [{ message: 'expected object' }] }
  }
  if (typeof value.isAdmin !== 'boolean') {
    return { issues: [{ message: 'isAdmin must be boolean', path: ['isAdmin'] }] }
  }
  return { value }
})

const registry = createRegistry({
  schemas: { database: databaseUser, frontend: frontendUser, ai: aiUser },
  migrations: {
    'database->frontend': (u) => ({ id: u.id, email: u.email, role: u.role }),
    'frontend->ai': (u) => ({ id: u.id, email: u.email, isAdmin: u.role === 'admin' }),
  },
})

const sample = {
  id: 'user-123',
  email: 'alice@example.com',
  passwordHash: 'x',
  role: 'admin',
}

// direct single step transform
const direct = await registry.transform(sample, 'database', 'frontend')
assert.equal(direct.ok, true, 'direct transform should succeed')
assert.deepEqual(direct.value, { id: 'user-123', email: 'alice@example.com', role: 'admin' })
assert.deepEqual(direct.meta.path, ['database', 'frontend'])

// multi step path finding database -> frontend -> ai
const multi = await registry.transform(sample, 'database', 'ai')
assert.equal(multi.ok, true, 'multi step transform should succeed')
assert.deepEqual(multi.meta.path, ['database', 'frontend', 'ai'])
assert.equal(multi.value.isAdmin, true)

// identity transform
const same = await registry.transform(sample, 'database', 'database')
assert.equal(same.ok, true)
assert.deepEqual(same.meta.path, ['database'])

// no path available
const noPath = await registry.transform({ id: 'x', isAdmin: true }, 'ai', 'database')
assert.equal(noPath.ok, false, 'transform with no path should fail')
assert.equal(noPath.issues[0]?.code, 'no_path_found')

// result utilities
assert.equal(isOk(ok(1)), true)
assert.equal(isErr(err('boom')), true)
assert.equal(unwrap(ok('value')), 'value')
assert.throws(() => unwrap(err('boom')))
assert.equal(unwrapOr(err('boom'), 'fallback'), 'fallback')
assert.equal(map(ok(2), (n) => n * 3).value, 6)
assert.equal(mapErr(err('e'), (e) => `${e}!`).issues, 'e!')
