import path from 'path'
import { createServer as viteWatch } from 'vite'

viteWatch({
  root: path.join(import.meta.dirname, '../pkgs/controlPanel'),
  mode: 'development'
}).then(async server => {
  await server.listen()
  server.printUrls()
})
