// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // demo/ is a separate Remotion project with its own dependencies and lint setup.
    ignores: ["dist/*", "demo/*"],
  }
]);
