// import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
// import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  root: __dirname,
  base: '@ROOT@/',
  server: {
    host: '127.0.0.1',
    port: 9877
  },
  build: {
    outDir: '../release/web',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src')
      // 'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js'
    }
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => {
            return tag.startsWith('vscode-')
          }
        }
      }
    })
    // vueJsx()
    // VueI18nPlugin({
    //   include: [path.resolve(__dirname, './src/i18n/locales/*.json')],
    //   strictMessage: false
    // })
  ]
})
