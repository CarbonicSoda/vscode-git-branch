import eslint from "@eslint/js";
import tslint from "typescript-eslint";

import stylistic from "@stylistic/eslint-plugin";
import prettier from "eslint-config-prettier";

export default tslint.config(
	{ files: ["src/**/*.ts"] },
	{ ignores: ["*config.*", "dist/**/*", "esbuild.cjs"] },

	eslint.configs.recommended,
	tslint.configs.eslintRecommended,

	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	tslint.configs.recommendedTypeChecked,
	tslint.configs.stylisticTypeChecked,

	stylistic.configs.recommended,
	prettier,
);
