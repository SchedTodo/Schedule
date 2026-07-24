import { defineConfig, globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    'coverage/**',
    'dist-electron/**',
    'dist-web/**',
    'dist/**',
    'out/**',
    'src/parser/generated/**'
  ]),
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'electron',
                'electron/*',
                'node:*',
                'better-sqlite3',
                'drizzle-orm',
                'drizzle-orm/*',
                '**/src-electron/**'
              ],
              message: 'Web source must depend on platform contracts, not host implementations.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  }
)
