import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } }
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node }
  },
  {
    rules: {
      eqeqeq: 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' }
  }
);
