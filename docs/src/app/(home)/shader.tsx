'use client'

import { useEffect, useRef } from 'react'

const vert = /* glsl */ `
  attribute vec2 p;

  void main() {
    gl_Position = vec4(p, 0, 1);
  }
`

const frag = /* glsl */ `
  precision highp float;
  uniform float t;
  uniform vec2 r;
  uniform float dark;

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float sphere(vec3 p, float s) { return length(p) - s; }

  float scene(vec3 p) {
    float s = t * 0.2;

    float d = sphere(p - vec3(
      sin(s * 1.1) * 0.55,
      cos(s * 0.7) * 0.35,
      sin(s * 0.5) * 0.25
    ), 0.42);

    d = smin(d, sphere(p - vec3(
      cos(s * 0.8) * 0.45,
      sin(s * 0.6) * 0.45 + 0.1,
      cos(s * 0.9) * 0.2
    ), 0.35), 0.4);

    d = smin(d, sphere(p - vec3(
      -sin(s * 0.6) * 0.35,
      -cos(s * 0.9) * 0.3,
      sin(s * 0.4) * 0.2
    ), 0.3), 0.35);

    d = smin(d, sphere(p - vec3(
      sin(s * 0.9 + 2.0) * 0.6,
      cos(s * 0.5 + 1.0) * 0.2,
      -cos(s * 0.7) * 0.25
    ), 0.26), 0.45);

    d = smin(d, sphere(p - vec3(
      -cos(s * 0.7 + 3.0) * 0.45,
      sin(s * 1.1) * 0.35,
      cos(s * 0.6 + 2.0) * 0.18
    ), 0.24), 0.38);

    return d;
  }

  vec3 normal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      scene(p + e.xyy) - scene(p - e.xyy),
      scene(p + e.yxy) - scene(p - e.yxy),
      scene(p + e.yyx) - scene(p - e.yyx)
    ));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - r * 0.5) / r.y;

    vec3 ro = vec3(0.0, 0.0, 2.6);
    vec3 rd = normalize(vec3(uv, -1.4));

    // Raymarch
    float d = 0.0;
    float hit = 0.0;
    for (int i = 0; i < 64; i++) {
      float s = scene(ro + rd * d);
      if (s < 0.001) { hit = 1.0; break; }
      if (d > 5.0) break;
      d += s;
    }

    vec3 bgDark1 = vec3(0.05, 0.04, 0.12);
    vec3 bgDark2 = vec3(0.08, 0.06, 0.16);
    vec3 bgLight1 = vec3(0.89, 0.90, 0.97);
    vec3 bgLight2 = vec3(0.91, 0.92, 0.99);
    vec3 bg = mix(
      mix(bgLight1, bgDark1, dark),
      mix(bgLight2, bgDark2, dark),
      uv.y * 0.5 + 0.5
    );
    // Subtle purple glow in center
    vec3 glowDark = vec3(0.03, 0.015, 0.06);
    vec3 glowLight = vec3(0.06, 0.03, 0.10);
    bg += exp(-length(uv) * 2.0) * mix(glowLight, glowDark, dark);
    vec3 color = bg;

    if (hit > 0.5) {
      vec3 p = ro + rd * d;
      vec3 n = normal(p);

      // Lighting
      vec3 l1 = normalize(vec3(1.0, 0.8, 0.6));
      vec3 l2 = normalize(vec3(-0.5, -0.3, 0.9));
      float diff1 = max(dot(n, l1), 0.0);
      float diff2 = max(dot(n, l2), 0.0);

      // Fresnel
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);

      // Specular
      vec3 h1 = normalize(l1 - rd);
      float spec1 = pow(max(dot(n, h1), 0.0), 48.0);
      vec3 h2 = normalize(l2 - rd);
      float spec2 = pow(max(dot(n, h2), 0.0), 24.0);

      float ndv = dot(n, -rd);

      // Dark mode: deeper, moodier tones
      vec3 warmBaseDark = vec3(0.55, 0.28, 0.25);
      vec3 coolBaseDark = vec3(0.20, 0.18, 0.40);
      vec3 peachDark    = vec3(0.60, 0.35, 0.30);
      vec3 blushDark    = vec3(0.42, 0.28, 0.48);

      // Light mode: richer, more saturated coral/violet
      vec3 warmBaseLight = vec3(0.82, 0.38, 0.38);
      vec3 coolBaseLight = vec3(0.52, 0.46, 0.82);
      vec3 peachLight    = vec3(0.88, 0.48, 0.42);
      vec3 blushLight    = vec3(0.68, 0.48, 0.85);

      vec3 warmBase = mix(warmBaseLight, warmBaseDark, dark);
      vec3 coolBase = mix(coolBaseLight, coolBaseDark, dark);
      vec3 peach    = mix(peachLight,    peachDark,    dark);
      vec3 blush    = mix(blushLight,    blushDark,    dark);

      // Shift hue based on normal and view direction
      float hueShift = dot(n, vec3(0.3, 0.6, 0.1)) * 0.5 + 0.5;
      vec3 surfCol = mix(coolBase, warmBase, hueShift);
      surfCol = mix(surfCol, peach, diff1 * 0.4);
      surfCol = mix(surfCol, blush, fres * 0.3);

      // AO
      float ao = clamp(scene(p + n * 0.12) / 0.12, 0.0, 1.0);
      ao = 0.5 + 0.5 * ao;

      // Light mode gets brighter overall lighting
      float ambient = mix(0.35, 0.2, dark);
      color = surfCol * (diff1 * 0.55 + diff2 * 0.15 + ambient) * ao;

      vec3 specTint1 = mix(vec3(0.95, 0.88, 1.0), vec3(0.85, 0.75, 0.9), dark);
      vec3 specTint2 = mix(vec3(0.75, 0.70, 0.90), vec3(0.6, 0.55, 0.8), dark);
      color += spec1 * specTint1 * 0.5;
      color += spec2 * specTint2 * 0.25;

      vec3 rimCol = mix(vec3(0.55, 0.35, 0.70), vec3(0.30, 0.20, 0.45), dark);
      color += fres * rimCol * 0.5;
    }

    // Atmospheric glow for near-misses
    if (hit < 0.5) {
      float closest = 100.0;
      float gd = 0.0;
      for (int i = 0; i < 24; i++) {
        float s = scene(ro + rd * gd);
        closest = min(closest, s);
        gd += max(s, 0.1);
        if (gd > 4.0) break;
      }
      float glow = exp(-closest * 4.0) * 0.15;
      vec3 glowCol = mix(vec3(0.45, 0.28, 0.58), vec3(0.22, 0.15, 0.35), dark);
      color += glow * glowCol;
    }

    // Tone map
    color = color / (color + 0.7);
    color = pow(color, vec3(0.9));

    gl_FragColor = vec4(color, 1.0);
  }
`

export function ShaderBackground() {
  const ref = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)

  useEffect(() => {
    const c = ref.current
    if (!c) {
      return
    }
    const gl = c.getContext('webgl', { alpha: false, antialias: false })
    if (!gl) {
      return
    }

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)
      if (!s) {
        return null
      }
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }

    const vs = sh(gl.VERTEX_SHADER, vert)
    const fs = sh(gl.FRAGMENT_SHADER, frag)
    const pg = gl.createProgram()
    if (!vs || !fs || !pg) {
      return
    }
    gl.attachShader(pg, vs)
    gl.attachShader(pg, fs)
    gl.linkProgram(pg)
    gl.useProgram(pg)

    const b = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, b)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const p = gl.getAttribLocation(pg, 'p')
    gl.enableVertexAttribArray(p)
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0)

    const ut = gl.getUniformLocation(pg, 't')
    const ur = gl.getUniformLocation(pg, 'r')
    const ud = gl.getUniformLocation(pg, 'dark')

    // oxlint-disable-next-line no-zero-fractions -- WebGL uniform values must be floats, not integers
    let isDark = document.documentElement.classList.contains('dark') ? 1.0 : 0.0
    let darkTarget = isDark

    const observer = new MutationObserver(() => {
      // oxlint-disable-next-line no-zero-fractions -- WebGL uniform values must be floats, not integers
      darkTarget = document.documentElement.classList.contains('dark') ? 1.0 : 0.0
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const resize = () => {
      const s = Math.min(devicePixelRatio, 2)
      c.width = c.clientWidth * s
      c.height = c.clientHeight * s
      gl.viewport(0, 0, c.width, c.height)
    }
    resize()
    addEventListener('resize', resize)

    let paused = false
    const onVisibility = () => {
      paused = document.hidden
      if (!paused) {
        raf.current = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const t0 = performance.now() - Math.random() * 100_000
    const loop = () => {
      if (paused) {
        return
      }
      isDark += (darkTarget - isDark) * 0.05
      gl.uniform1f(ut, (performance.now() - t0) / 1000)
      gl.uniform2f(ur, c.width, c.height)
      gl.uniform1f(ud, isDark)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf.current)
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" />
}
