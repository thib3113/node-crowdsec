const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    files: ["packages/**/*.ts", "dev/**/*.ts", "examples/**/*.ts"],
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2018,
        sourceType: "module",
        parserOptions: {},
    },

    extends: compat.extends("plugin:prettier/recommended", "prettier"),

    rules: {
        camelcase: "off",
        "@typescript-eslint/camelcase": "off",
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        indent: "off",
        "@typescript-eslint/no-object-literal-type-assertion": "off",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/ban-ts-ignore": "off",
    },
}, globalIgnores(["**/*.hbs", "**/*.md"])]);
