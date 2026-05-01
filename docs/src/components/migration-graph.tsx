import type { ReactNode } from 'react'

type Node = { id: string; label?: string }
type Edge = { from: string; to: string; label?: string; dashed?: boolean }

export function MigrationGraph({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-fd-border bg-fd-card/50 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-6 md:gap-x-4">
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center gap-3 md:gap-4">
            <GraphNode label={node.label || node.id} />
            {i < nodes.length - 1 && (
              <GraphArrow label={edges[i]?.label} dashed={edges[i]?.dashed} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GraphNode({ label }: { label: string }) {
  return (
    <div className="flex h-10 items-center rounded-lg border border-fd-border bg-fd-background px-4 text-[13px] font-medium shadow-sm transition-colors hover:border-fd-primary/30 hover:bg-fd-accent/50">
      {label}
    </div>
  )
}

function GraphArrow({ label, dashed }: { label?: string; dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[10px] font-medium text-fd-muted-foreground">{label}</span>}
      <svg width="32" height="12" viewBox="0 0 32 12" className="text-fd-muted-foreground">
        <line
          x1="0"
          y1="6"
          x2="24"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray={dashed ? '3 3' : undefined}
        />
        <polygon points="24,2 32,6 24,10" fill="currentColor" />
      </svg>
    </div>
  )
}

export function MigrationGraphComplex({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-fd-border bg-fd-card/50 p-6 md:p-8">
      {children}
    </div>
  )
}

export function GraphRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">{children}</div>
}

export { GraphNode as GNode, GraphArrow as GArrow }
