import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-node';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'security': security,
      'import': importPlugin,
      'node': nodePlugin
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',

      // Security rules
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',

      // Import/Export rules
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/export': 'error',
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'warn',
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true
        }
      }],

      // General JavaScript rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-unused-vars': 'off', // Handled by TypeScript
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-useless-constructor': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'no-else-return': 'error',
      'no-lonely-if': 'error',
      'no-nested-ternary': 'warn',
      'no-unneeded-ternary': 'error',
      'spaced-comment': ['error', 'always'],
      'yoda': 'error',

      // Error handling
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-return-await': 'error',

      // Performance
      'no-loop-func': 'error',
      'no-new-object': 'error',
      'no-new-wrappers': 'error',
      'no-array-constructor': 'error',

      // Best practices
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'default-case': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-param-reassign': 'warn',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-void': 'error',
      'radix': 'error',
      'wrap-iife': 'error',

      // Node.js specific
      'node/no-deprecated-api': 'warn',
      'node/no-missing-import': 'off', // TypeScript handles this
      'node/no-missing-require': 'off', // Using ES modules
      'node/no-unpublished-import': 'off',
      'node/no-unsupported-features/es-syntax': 'off',
      'node/prefer-global/buffer': 'error',
      'node/prefer-global/console': 'error',
      'node/prefer-global/process': 'error',
      'node/prefer-global/url-search-params': 'error',
      'node/prefer-global/url': 'error',
      'node/prefer-promises/dns': 'error',
      'node/prefer-promises/fs': 'error'
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        }
      }
    }
  },
  {
    // Test-specific overrides
    files: ['tests/**/*.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off'
    }
  },
  {
    // Configuration file overrides
    files: ['*.config.js', '*.config.ts', 'vitest.config.ts', 'eslint.config.js'],
    rules: {
      'node/no-unpublished-import': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '*.min.js',
      '*.d.ts'
    ]
  }
];
