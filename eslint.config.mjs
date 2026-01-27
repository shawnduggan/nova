import obsidianmd from "eslint-plugin-obsidianmd";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import eslintComments from "eslint-plugin-eslint-comments";

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
			"@typescript-eslint": tsPlugin,
			"eslint-comments": eslintComments,
		},
		rules: {
			// Obsidian plugin rules
			...obsidianmd.configs.recommended,
			"obsidianmd/ui/sentence-case": ["error", {
				allowAutoFix: true,
				brands: ["Nova", "Obsidian", "LLMs", "Anthropic", "Claude", "Google", "Gemini", "OpenAI", "ChatGPT"]
			}],

			// TypeScript strict rules (matching Obsidian bot)
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/await-thenable": "error",
			"@typescript-eslint/require-await": "error",
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
			"@typescript-eslint/restrict-template-expressions": "error",
			"@typescript-eslint/no-misused-promises": "error",
			"@typescript-eslint/no-unused-expressions": "error",

			// ESLint comments rules
			"eslint-comments/require-description": "error",
			"eslint-comments/disable-enable-pair": "error",
			"eslint-comments/no-unlimited-disable": "error",

			// Deprecated API warnings
			"no-restricted-syntax": ["error", {
				"selector": "CallExpression[callee.property.name='substr']",
				"message": "substr() is deprecated. Use substring() or slice() instead."
			}],
		},
	},
	{
		// Less strict rules for test files - mocking requires type flexibility
		files: ["test/**/*.ts"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: "./tsconfig.test.json",
			},
		},
		rules: {
			// Allow 'any' in test files for mocking purposes
			"@typescript-eslint/no-explicit-any": "off",
			// Allow async without await in test setup/teardown
			"@typescript-eslint/require-await": "off",
			// Allow awaiting non-promises in tests (mock returns)
			"@typescript-eslint/await-thenable": "off",
			// Allow type assertions in tests (for mocking)
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
		},
	},
	{
		ignores: [
			"main.js",
			"**/*.d.ts",
			"node_modules/",
			"dist/",
			"build/",
		],
	},
];
