import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import lodashPlugin from "eslint-plugin-you-dont-need-lodash-underscore";
import globals from "globals";

export default [
  js.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettier,
      "you-dont-need-lodash-underscore": lodashPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es6,
        ...globals.mocha,
      },
    },
    rules: {
      "prettier/prettier": "error",
      "no-console": "off",
      "you-dont-need-lodash-underscore/is-nil": "off",
    },
  },
];
