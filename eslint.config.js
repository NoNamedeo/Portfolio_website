import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', 'test-results/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/core/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'astro:*',
                '@application/*',
                '@infrastructure/*',
                '@presentation/*',
                '@app/*'
              ],
              message: 'Il dominio deve restare indipendente dai layer esterni.'
            }
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Il dominio non può dipendere dal browser.' },
        { name: 'document', message: 'Il dominio non può dipendere dal browser.' },
        { name: 'localStorage', message: 'Il dominio non può dipendere dal browser.' }
      ]
    }
  },
  {
    files: ['src/core/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['astro:*', '@infrastructure/*', '@presentation/*', '@app/*'],
              message: 'L’application layer dipende solo dal dominio e dalle proprie porte.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/presentation/**/*.{ts,astro}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@infrastructure/*'],
              message: 'La presentation deve usare la composition root, non adapter concreti.'
            }
          ]
        }
      ]
    }
  }
];
