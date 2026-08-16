import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        clearMocks: true,
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['clover', 'json', 'lcov', 'text', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/generated/**/*', 'src/debug.ts', 'src/**/*.test.ts']
        },
        include: ['tests/**/*.(test|tests|spec|specs).+(ts|tsx|js)']
    }
});
