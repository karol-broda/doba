export type VisualizeFormat = 'text' | 'mermaid' | 'json' | 'dot'
export type VisualizeDirection = 'LR' | 'TB'

export type MermaidConfigValue = unknown
export type MermaidConfig = Readonly<Record<string, MermaidConfigValue>>

export type VisualizeCommonOptions = {
  readonly costs?: boolean | undefined
}

export type VisualizeTextOptions = VisualizeCommonOptions & {
  readonly format?: 'text' | undefined
  readonly title?: string | undefined
}

export type VisualizeMermaidOptions = VisualizeCommonOptions & {
  readonly format: 'mermaid'
  readonly direction?: VisualizeDirection | undefined
  readonly config?: MermaidConfig | undefined
}

export type VisualizeDotOptions = VisualizeCommonOptions & {
  readonly format: 'dot'
  readonly direction?: VisualizeDirection | undefined
  readonly graphName?: string | undefined
}

export type VisualizeJsonOptions = {
  readonly format: 'json'
  readonly space?: number | undefined
}

export type VisualizeOptions =
  | VisualizeTextOptions
  | VisualizeMermaidOptions
  | VisualizeDotOptions
  | VisualizeJsonOptions

export type VisualizeInput = VisualizeFormat | VisualizeOptions

export type NormalizedVisualizeOptions = {
  readonly format: VisualizeFormat
  readonly direction: VisualizeDirection
  readonly costs: boolean
  readonly title: string
  readonly graphName: string
  readonly space: number
  readonly mermaidConfig: MermaidConfig | undefined
}

export type GraphEdge<K extends string> = {
  readonly from: K
  readonly to: K
  readonly cost: number
}

export type GraphSnapshot<K extends string> = {
  readonly nodes: readonly K[]
  readonly edges: readonly GraphEdge<K>[]
}
