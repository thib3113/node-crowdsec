// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

export default {
    clearMocks: true,
    coverageDirectory: '<rootDir>/coverage',
    collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/debug.ts'],
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
    extensionsToTreatAsEsm: ['.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                useESM: true
            }
        ]
    }
};
