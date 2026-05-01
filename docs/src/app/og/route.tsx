import { palette } from '@/lib/colors'
import { createOGResponse, OGFrame } from '@/lib/og'

export const revalidate = 3600

export function GET() {
  return createOGResponse(
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
            marginTop: 8,
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
          }}
        >
          Schema registry for TypeScript
        </div>
      </div>
    </OGFrame>,
  )
}
