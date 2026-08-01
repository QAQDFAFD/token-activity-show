import babelParser from '@babel/eslint-parser'
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

const typescriptParserOptions = {
  requireConfigFile: false,
  babelOptions: {
    presets: ['@babel/preset-typescript']
  }
}

export default defineConfig(
  globalIgnores([
    'dist',
    'out',
    'release',
    '**/*.js',
    '**/*.d.ts',
    '**/*.tsbuildinfo'
  ]),
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: typescriptParserOptions
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['src/renderer/src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ...typescriptParserOptions,
        babelOptions: {
          presets: [
            ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
        }
      },
      globals: globals.browser
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off'
    }
  }
)
