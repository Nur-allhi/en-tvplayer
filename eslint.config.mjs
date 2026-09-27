import globals from 'globals';

// Minimal on purpose (AGENTS.md: minimum, not maximum): Prettier owns
// style; ESLint owns dead code + undefined references.
export default [
  {
    files: ['player/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', ignoreRestSiblings: true }],
      'no-undef': 'error',
    },
  },
];
