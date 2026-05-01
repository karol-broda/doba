export function GET() {
  const body = `Contact: https://github.com/karol-broda/doba/issues
Preferred-Languages: en
Canonical: https://doba.karolbroda.com/.well-known/security.txt
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
