'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useDocsSearch } from 'fumadocs-core/search/client'
import { type ReactNode, useEffect, useRef, Suspense, useMemo } from 'react'
import Link from 'next/link'
import type { SortedResult } from 'fumadocs-core/search'

function HighlightedText({ content }: { content: string }) {
  const parts = content.split(/(<mark>.*?<\/mark>)/g)

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^<mark>(.*?)<\/mark>$/)
        if (!match) {
          return part
        }

        return (
          <mark key={i} className="rounded-sm bg-fd-primary/20 px-0.5 text-fd-primary">
            {match[1]}
          </mark>
        )
      })}
    </>
  )
}

type GroupedResult = {
  page: SortedResult
  children: SortedResult[]
}

function groupResults(results: SortedResult[]): GroupedResult[] {
  const groups: GroupedResult[] = []
  let current: GroupedResult | null = null

  for (const item of results) {
    if (item.type === 'page') {
      current = { page: item, children: [] }
      groups.push(current)
    } else if (current) {
      current.children.push(item)
    } else {
      current = {
        page: { id: item.id, url: item.url, type: 'page', content: item.url },
        children: [item],
      }
      groups.push(current)
    }
  }

  return groups
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
      placeholder="Search documentation..."
      className="w-full rounded-lg border border-fd-border bg-fd-card px-4 py-3 text-fd-foreground placeholder:text-fd-muted-foreground focus:border-fd-primary focus:outline-none"
    />
  )
}

function StatusMessage({ children }: { children: ReactNode }) {
  return <p className="text-fd-muted-foreground">{children}</p>
}

function ResultChild({ result }: { result: SortedResult }) {
  return (
    <Link
      href={result.url}
      className="block px-4 py-2.5 text-sm transition-colors hover:bg-fd-accent"
    >
      <span
        className={
          result.type === 'heading' ? 'font-medium text-fd-foreground' : 'text-fd-muted-foreground'
        }
      >
        <HighlightedText content={result.content} />
      </span>
    </Link>
  )
}

function ResultGroup({ group }: { group: GroupedResult }) {
  return (
    <div className="overflow-hidden rounded-lg border border-fd-border">
      <Link
        href={group.page.url}
        className="block bg-fd-card px-4 py-3 font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
      >
        <HighlightedText content={group.page.content} />
        <span className="ml-2 text-sm text-fd-muted-foreground">{group.page.url}</span>
      </Link>

      {group.children.length > 0 && (
        <div className="divide-y divide-fd-border border-t border-fd-border">
          {group.children.map((child) => (
            <ResultChild key={child.id} result={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function ResultList({ groups }: { groups: GroupedResult[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <ResultGroup key={group.page.id} group={group} />
      ))}
    </div>
  )
}

function SearchInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''
  const { search, setSearch, query } = useDocsSearch({ type: 'fetch' })
  const isInitialSync = useRef(true)

  useEffect(() => {
    if (q !== search) {
      setSearch(q)
    }
    isInitialSync.current = false
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isInitialSync.current) {
      return
    }

    const url = search ? `/search?q=${encodeURIComponent(search)}` : '/search'
    router.replace(url, { scroll: false })
  }, [search, router])

  const results = query.data === 'empty' ? null : query.data
  const groups = useMemo(() => (results ? groupResults(results) : []), [results])
  const hasQuery = search.length > 0
  const noResults = hasQuery && !query.isLoading && (!results || results.length === 0)

  return (
    <>
      <div className="mb-8">
        <SearchInput value={search} onChange={setSearch} />
      </div>

      <div className="flex-1">
        {!hasQuery && <StatusMessage>Type a query to search the documentation.</StatusMessage>}
        {hasQuery && query.isLoading && groups.length === 0 && (
          <StatusMessage>Searching...</StatusMessage>
        )}
        {noResults && <StatusMessage>No results found for &ldquo;{search}&rdquo;</StatusMessage>}
        {groups.length > 0 && <ResultList groups={groups} />}
      </div>
    </>
  )
}

export function SearchContent() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchInner />
    </Suspense>
  )
}

function SearchFallback() {
  return (
    <>
      <div className="mb-8">
        <input
          type="search"
          disabled
          placeholder="Search documentation..."
          className="w-full rounded-lg border border-fd-border bg-fd-card px-4 py-3 text-fd-foreground placeholder:text-fd-muted-foreground"
        />
      </div>
      <div className="flex-1">
        <p className="text-fd-muted-foreground">Type a query to search the documentation.</p>
      </div>
    </>
  )
}
