import obsidianmd from "eslint-plugin-obsidianmd";
import tsParser from "@typescript-eslint/parser";

export default [
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		plugins: {
			obsidianmd,
		},
		rules: {
			...obsidianmd.configs.recommended,
			"obsidianmd/ui/sentence-case": ["error", {
				allowAutoFix: true,
				ignoreRegex: ["Nova"]
			}],
		},
	},
	{
		ignores: [
			"main.js",
			"**/*.d.ts",
			"node_modules/",
			"dist/",
			"build/",
			"src/tests/**/*.ts",
		],
	},
];
