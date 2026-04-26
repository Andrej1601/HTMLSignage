import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const typescriptBaseRules = {
  'no-console': 'off',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['warn', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
  }],
};

export default [
  {
    ignores: [
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'logs/**',
      'packages/backend/uploads/**',
    ],
  },
  {
    files: ['packages/backend/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...typescriptBaseRules,
    },
  },
  {
    files: ['packages/frontend/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...typescriptBaseRules,
      ...reactHooks.configs.recommended.rules,
      // Off because our Context modules deliberately co-locate the Provider
      // component with its hook (e.g. WebSocketContext + useWebSocketStatus)
      // and chrome modules co-locate components with theming helpers.
      // Splitting purely for HMR Fast-Refresh isn't worth the file churn.
      'react-refresh/only-export-components': 'off',
    },
  },
];
