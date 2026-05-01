/* oxlint-disable no-console -- CLI script */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createOGResponse, OGFrame } from '../src/lib/og'
import { palette } from '../src/lib/colors'

const width = 2400
const height = 500

const response = createOGResponse(
  <OGFrame>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: 'Instrument Serif',
          fontStyle: 'italic',
          fontSize: 120,
          letterSpacing: '-0.04em',
          color: palette.text,
        }}
      >
        doba
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          color: palette.muted,
          marginTop: 10,
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
        }}
      >
        Type-safe schema registry for TypeScript
      </div>
    </div>
  </OGFrame>,
  { width, height },
)

const buffer = Buffer.from(await response.arrayBuffer())
const outPath = join(import.meta.dir, '..', 'public', 'banner.png')
writeFileSync(outPath, buffer)
console.log(`Banner written to ${outPath} (${buffer.length} bytes, ${width}x${height})`)
