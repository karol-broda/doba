import { ImageResponse } from '@takumi-rs/image-response'
import { getOGFont } from '@/lib/og'
import { palette } from '@/lib/colors'

export const revalidate = 86_400

export function GET() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: '36px',
        background: '#232136',
      }}
    >
      <div
        style={{
          fontFamily: 'Instrument Serif',
          fontStyle: 'italic',
          fontSize: 120,
          color: palette.text,
        }}
      >
        d
      </div>
    </div>,
    {
      width: 180,
      height: 180,
      format: 'png',
      fonts: [getOGFont()],
    },
  )
}
