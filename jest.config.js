/**
 * Jest configuration for TypeScript support in React Native/Expo projects.
 * See: https://jestjs.io/docs/getting-started#using-typescript
 */
// jest.config.js for Expo/React Native projects
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|webp|svg|ttf)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
