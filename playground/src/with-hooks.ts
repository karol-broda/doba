/* oxlint-disable no-console -- playground demo scripts use console for output */
/* oxlint-disable prefer-top-level-await -- wrapped in main() for error handling */
import { z } from 'zod'
import { createRegistry, type TransformHookInfo, type StepHookInfo } from 'dobajs'
import { log } from './log'

const v1 = z.object({ id: z.string(), name: z.string() })
const v2 = z.object({ id: z.string(), name: z.string(), email: z.string() })
const v3 = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string(),
})

const transformLog: TransformHookInfo<string>[] = []
const stepLog: StepHookInfo<string>[] = []

const registry = createRegistry({
  schemas: { v1, v2, v3 },

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
      label: 'add-email',
    },

    'v2->v3': {
      migrate: (user) => ({
        id: user.id,
        displayName: user.name,
        email: user.email,
      }),
      label: 'rename-to-displayName',
    },
  },

  hooks: {
    onWarning: (msg, from, to) => {
      log(msg, `onWarning:${from}->${to}`)
    },
    onTransform: (info) => {
      transformLog.push(info)
      const status = info.ok ? 'ok' : 'fail'
      log(`${info.from} -> ${info.to} [${status}] ${info.durationMs.toFixed(2)}ms`, 'onTransform')
    },
    onStep: (info) => {
      stepLog.push(info)
      const status = info.ok ? 'ok' : 'fail'
      log(
        `step ${info.index + 1}/${info.total}: ${info.from} -> ${info.to} [${status}] ${info.durationMs.toFixed(2)}ms${info.label ? ` (${info.label})` : ''}`,
        'onStep',
      )
    },
  },
})

async function main() {
  const user = { id: 'user-1', name: 'Alice Smith' }

  log('multi-step transform: v1 -> v3 (watch the hooks fire)', 'transform')
  const result = await registry.transform(user, 'v1', 'v3')
  if (result.ok) {
    log(result.value, 'result')
  }
  console.log()

  log('single-step transform: v1 -> v2', 'transform')
  const result2 = await registry.transform(user, 'v1', 'v2')
  if (result2.ok) {
    log(result2.value, 'result')
  }
  console.log()

  log('failed transform: no path from v3 -> v1', 'transform')
  const result3 = await registry.transform({ id: '1', displayName: 'test', email: 'x' }, 'v3', 'v1')
  if (!result3.ok) {
    log(result3.issues[0]?.message, 'error')
  }
  console.log()

  log(`total transforms logged: ${transformLog.length}`, 'summary')
  log(`total steps logged: ${stepLog.length}`, 'summary')
}

main().catch(console.error)
