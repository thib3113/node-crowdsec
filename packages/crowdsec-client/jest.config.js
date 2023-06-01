// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

export default {
    clearMocks: true,
    coverageDirectory: '<rootDir>/coverage',
    coveragePathIgnorePatterns: ['\\\\node_modules\\\\', 'tests'],
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testMatch: ['<rootDir>/tests/**/*.(test|tests|spec|specs).+(ts|tsx|js)'],
    reporters: [
        'default',
        [
            'jest-sonar',
            {
                outputDirectory: '<rootDir>/coverage',
                outputName: 'test-report.xml',
                reportedFilePath: 'absolute'
            }
        ]
    ],
    preset: 'ts-jest/presets/default-esm', // or other ESM presets
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transform: {
        // '^.+\\.[tj]sx?$' to process js/ts with `ts-jest`
        // '^.+\\.m?[tj]sx?$' to process js/ts/mjs/mts with `ts-jest`
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/tsconfig.json',
                useESM: true
            }
        ]
    }
};