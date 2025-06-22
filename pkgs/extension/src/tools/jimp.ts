import { createJimp } from '@jimp/core'
import png from '@jimp/js-png'
import * as pluginCrop from '@jimp/plugin-crop'

export const Jimp = createJimp({
  plugins: [pluginCrop.methods],
  formats: [png]
})
