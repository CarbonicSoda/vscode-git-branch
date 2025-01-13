import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
	{
		files: ["**/*.ts"],
	},
	{
		plugins: {
			"@typescript-eslint": typescriptEslint,
		},

		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2022,
			sourceType: "module",
		},

		rules: {
			"@typescript-eslint/naming-convention": [
				"warn",
				{
					selector: "import",
					format: ["camelCase", "PascalCase"],
				},
			],
			"@typescript-eslint/semi": "warn",
			"curly": ["warn", "multi-or-nest", "consistent"],
			"eqeqeq": "warn",
			"no-throw-literal": "warn",
			"semi": "warn",
			"no-unused-expressions": "warn",
			"no-unused-labels": "warn",
			"no-unused-vars": "warn",
			"@typescript-eslint/return-await": "warn",
		},
	},
];
