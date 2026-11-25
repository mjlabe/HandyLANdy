const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['build/**', 'dist/**', '.expo/**', 'ios/**', 'android/**'] },
  { files: ['scripts/**/*.mjs', 'tests/**/*.ts'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly' } } },
]);
