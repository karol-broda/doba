import { describe, it, expect } from 'vitest'
import { createTransformState, createTransformContext } from '../src/context.js'

describe('createTransformState', () => {
  it('creates empty state', () => {
    const state = createTransformState()
    expect(state.warnings).toEqual([])
    expect(state.defaults).toEqual([])
  })
})

describe('createTransformContext', () => {
  it('exposes from and to', () => {
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b')
    expect(ctx.from).toBe('a')
    expect(ctx.to).toBe('b')
  })

  it('warn pushes to state.warnings', () => {
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b')
    ctx.warn('something happened')
    expect(state.warnings).toEqual([{ message: 'something happened', from: 'a', to: 'b' }])
  })

  it('warn calls onWarning callback', () => {
    const calls: { msg: string; from: string; to: string }[] = []
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b', (msg, from, to) => {
      calls.push({ msg, from, to })
    })
    ctx.warn('test')
    expect(calls).toEqual([{ msg: 'test', from: 'a', to: 'b' }])
  })

  it('warn works without onWarning callback', () => {
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b')
    ctx.warn('no callback')
    expect(state.warnings).toHaveLength(1)
  })

  it('defaulted pushes to state.defaults', () => {
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b')
    ctx.defaulted(['settings', 'theme'], 'set to light')
    expect(state.defaults).toEqual([
      { path: ['settings', 'theme'], message: 'set to light', from: 'a', to: 'b' },
    ])
  })

  it('defaulted formats path as dot-joined string in onWarning', () => {
    const messages: string[] = []
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b', (msg) => messages.push(msg))
    ctx.defaulted(['settings', 'theme'], 'set to light')
    expect(messages[0]).toBe('defaulted settings.theme: set to light')
  })

  it('defaulted uses (root) for empty path', () => {
    const messages: string[] = []
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b', (msg) => messages.push(msg))
    ctx.defaulted([], 'entire object defaulted')
    expect(messages[0]).toBe('defaulted (root): entire object defaulted')
  })

  it('defaulted copies path array', () => {
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b')
    const path = ['x', 'y']
    ctx.defaulted(path, 'test')
    path.push('z')
    expect(state.defaults[0]?.path).toEqual(['x', 'y'])
  })

  it('accumulates multiple warnings and defaults', () => {
    const state = createTransformState()
    const ctx = createTransformContext(state, 'a', 'b')
    ctx.warn('w1')
    ctx.warn('w2')
    ctx.defaulted(['a'], 'd1')
    ctx.defaulted(['b'], 'd2')
    ctx.defaulted(['c'], 'd3')
    expect(state.warnings).toHaveLength(2)
    expect(state.defaults).toHaveLength(3)
  })
})
