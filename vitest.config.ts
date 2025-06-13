import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/index.ts', // Entry point, tested via integration
        'tests/**/*'
      ],
      thresholds: {
        global: {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    reporters: ['verbose', 'json', 'html']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/parsers': resolve(__dirname, './src/parsers'),
      '@/services': resolve(__dirname, './src/services'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
      '@/errors': resolve(__dirname, './src/errors'),
      '@/config': resolve(__dirname, './src/config')
    }
  }
});
