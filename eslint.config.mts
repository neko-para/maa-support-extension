import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    ignores: ['pkgs/maa-checker/dist/**', 'release/**']
  },
  {
    files: [
      'pkgs/{extension,locale,maa-checker,maa-server,maa-server-proto,maa-tasker,maa-version-manager,pipeline-manager,simple-parser,utils}/**/*.{js,mjs,cjs,ts,mts,cts}'
    ],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['pkgs/webview/**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['pkgs/types/**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ['pkgs/{extension,simple-parser}/**/*.js'],
    languageOptions: { sourceType: 'commonjs' }
  },
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  {
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'vue/no-mutating-props': [
        'error',
        {
          shallowOnly: true
        }
      ]
    }
  }
])
