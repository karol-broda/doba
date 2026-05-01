/** error codes produced by registry operations. */
export type DobaIssueCode =
  | 'validation_failed'
  | 'transform_failed'
  | 'no_path_found'
  | 'unknown_schema'
  | 'invalid_input'

/** structured error produced by validation or transformation. */
export type DobaIssue = {
  readonly code: DobaIssueCode
  readonly message: string
  /** property path where the issue occurred, if applicable. */
  readonly path?: readonly PropertyKey[] | undefined
  /** arbitrary extra context about the issue. */
  readonly meta?: Record<string, unknown> | undefined
}

export function createIssue(
  code: DobaIssueCode,
  message: string,
  meta?: Record<string, unknown>,
): DobaIssue {
  return meta === undefined ? { code, message } : { code, message, meta }
}
