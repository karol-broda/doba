import { SearchContent } from './_components/search-content'

export default function SearchPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Search</h1>
      <SearchContent />
    </div>
  )
}
