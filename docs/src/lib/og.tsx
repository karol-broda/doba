import { ImageResponse } from '@takumi-rs/image-response'
import type { Font, ImageSource } from '@takumi-rs/core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { palette } from './colors'
import type { CSSProperties, ReactNode } from 'react'

const abs: CSSProperties = { display: 'flex', position: 'absolute' }
const serif: CSSProperties = { fontFamily: 'Instrument Serif', fontStyle: 'italic' }

let fontData: Buffer | null = null
let bgData: Buffer | null = null

function loadFont() {
  if (!fontData) {
    fontData = readFileSync(join(process.cwd(), 'public/instrument-serif-latin-400-italic.woff2'))
  }
  return fontData
}

function loadBg() {
  if (!bgData) {
    bgData = readFileSync(join(process.cwd(), 'public/og-bg.webp'))
  }
  return bgData
}

export function getOGFont(): Font {
  return { name: 'Instrument Serif', data: loadFont(), weight: 400, style: 'italic' }
}

export interface OGResponseOptions {
  width?: number
  height?: number
  format?: 'png' | 'webp' | 'jpeg'
}

export function createOGResponse(element: React.ReactElement, options?: OGResponseOptions) {
  const { width = 1200, height = 630, format = 'png' } = options ?? {}

  return new ImageResponse(element, {
    width,
    height,
    format,
    fonts: [getOGFont()],
    persistentImages: [{ src: 'og-bg', data: loadBg() }] satisfies ImageSource[],
  })
}

export function OGFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <img
        src="og-bg"
        style={{ ...abs, top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {children}
      <div
        style={{
          ...abs,
          bottom: '0',
          left: '0',
          right: '0',
          height: '2px',
          background: `linear-gradient(90deg, ${palette.coral}, ${palette.purple} 60%, transparent)`,
        }}
      />
    </div>
  )
}

export function OGLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: 'rgba(224,222,244,0.06)',
          border: '1px solid rgba(224,222,244,0.08)',
          ...serif,
          fontSize: '20px',
          color: palette.text,
        }}
      >
        d
      </div>
      <div style={{ display: 'flex', ...serif, fontSize: '20px', color: palette.muted }}>doba</div>
    </div>
  )
}

export function OGTitle({ children, size = 64 }: { children: ReactNode; size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        ...serif,
        fontSize: size,
        lineHeight: 1.15,
        letterSpacing: '-0.03em',
        color: palette.text,
        maxWidth: '800px',
      }}
    >
      {children}
    </div>
  )
}

export function OGDescription({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        fontSize: 22,
        color: palette.subtle,
        marginTop: 20,
        lineHeight: 1.5,
        maxWidth: '700px',
      }}
    >
      {children}
    </div>
  )
}
