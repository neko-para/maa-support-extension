// import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path, { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  root: __dirname,
  base: './',
  build: {
    outDir: '../../release/controlPanel',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        control: resolve(__dirname, 'control.html'),
        launch: resolve(__dirname, 'launch.html'),
        crop: resolve(__dirname, 'crop.html')
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
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
          isCustomElement: tag => tag.startsWith('vscode-')
        }
      }
    }),
    vueJsx()
    // VueI18nPlugin({
    //   include: [path.resolve(__dirname, './src/i18n/locales/*.json')],
    //   strictMessage: false
    // })
  ]
})
