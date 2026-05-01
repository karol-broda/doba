/* oxlint-disable no-console -- logging utility for playground output */
export function log(obj: unknown, loc: string): void {
  const formatted = serialize(obj)
  console.log(`[${loc}]`, formatted)
}

function serialize(obj: unknown): string {
  if (obj === null) {
    return 'null'
  }

  if (obj === undefined) {
    return 'undefined'
  }

  if (typeof obj !== 'object') {
    return String(obj)
  }

  const safe = toSafeValue(obj)
  return JSON.stringify(safe, null, 2)
}

function toSafeValue(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSafeValue(item))
  }

  // handle objects with a message property (common for errors/issues)
  if ('message' in obj && typeof (obj as { message: unknown }).message === 'string') {
    const msg = (obj as { message: string }).message
    const path = 'path' in obj ? (obj as { path: unknown }).path : undefined
    if (path !== undefined) {
      return { message: msg, path: toSafeValue(path) }
    }
    return { message: msg }
  }

  // build a plain object copy to avoid toJSON issues
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    result[key] = toSafeValue((obj as Record<string, unknown>)[key])
  }
  return result
}
