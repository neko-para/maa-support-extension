// import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path, { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  root: __dirname,
  base: './',
  server: {
    port: 60003
  },
  build: {
    outDir: '../../release/support-webview',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  plugins: [vue(), vueJsx()]
})
