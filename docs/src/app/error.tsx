'use client'

import { ErrorPage } from '@/components/error-page'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <ErrorPage
      code="500"
      title="Something went wrong"
      description="An unexpected error occurred. Try refreshing the page."
      action={{ label: 'Try again', onClick: reset }}
    />
  )
}
