const js = require("@eslint/js");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const lodashPlugin = require("eslint-plugin-you-dont-need-lodash-underscore");
const globals = require("globals");

module.exports = [
  js.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      "you-dont-need-lodash-underscore": lodashPlugin,
    },
    languageOptions: {
      ecmaVersion: 10,
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      ...lodashPlugin.configs.compatible.rules,
    },
  },
];
