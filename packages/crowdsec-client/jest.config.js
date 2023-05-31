// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

export default {
    clearMocks: true,
    coverageDirectory: '<rootDir>/coverage',
    coveragePathIgnorePatterns: ['\\\\node_modules\\\\', 'tests'],
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testMatch: ['<rootDir>/tests/**/*.(test|tests|spec|specs).+(ts|tsx|js)'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
    },
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
    ]
};
