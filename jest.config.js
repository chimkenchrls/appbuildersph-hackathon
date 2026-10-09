module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  clearMocks: true,
};
