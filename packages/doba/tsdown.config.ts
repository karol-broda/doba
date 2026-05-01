import { defineConfig } from 'tsdown'
import ApiSnapshot from 'tsnapi/rolldown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    result: 'src/result-entry.ts',
  },
  dts: {
    tsconfig: 'tsconfig.build.json',
  },
  // oxlint-disable-next-line new-cap -- ApiSnapshot is a plugin factory, not a constructor
  plugins: [ApiSnapshot()],
})
