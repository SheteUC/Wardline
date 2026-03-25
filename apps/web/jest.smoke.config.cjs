const path = require('path');

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      path.resolve(__dirname, '../core-api/node_modules/ts-jest'),
      {
        tsconfig: path.resolve(__dirname, 'tsconfig.json'),
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
