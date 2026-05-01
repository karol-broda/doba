import { GitHubIcon } from '@/components/icons'

export function Footer() {
  return (
    <footer className="border-t border-fd-border bg-fd-background py-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 text-xs text-fd-muted-foreground">
        <span>MIT</span>
        <a
          href="https://github.com/karol-broda/doba"
          className="transition-colors hover:text-fd-foreground"
          aria-label="GitHub repository"
        >
          <GitHubIcon className="size-3.5" />
        </a>
      </div>
    </footer>
  )
}
