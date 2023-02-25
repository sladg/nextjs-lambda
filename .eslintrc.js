module.exports = {
	extends: ['eslint:recommended', 'prettier'],
	plugins: ['prettier', '@typescript-eslint', 'unused-imports', 'simple-import-sort', 'import'],
	parser: '@typescript-eslint/parser',
	env: {
		node: true,
		commonjs: true,
	},
	rules: {
		'prettier/prettier': 'error',
		'no-new': 0,
		camelcase: 0,
		'no-nested-ternary': 0,
		'no-underscore-dangle': 0,
		'no-shadow': 0,
		'no-useless-return': 0,
		'@typescript-eslint/no-explicit-any': 0,
		'@typescript-eslint/no-non-null-assertion': 0,
		'@typescript-eslint/no-shadow': ['error'],
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			},
		],
		'unused-imports/no-unused-imports': 'error',
		'no-multi-spaces': 'error',
		'no-trailing-spaces': 'error',
		'no-multiple-empty-lines': 'error',
		'space-in-parens': 'error',
		'no-mixed-spaces-and-tabs': 'warn',
		eqeqeq: ['warn', 'always'],
		'no-unused-vars': 'off',
		'simple-import-sort/imports': [
			'error',
			{
				groups: [
					['^react$'],
					// Side effect imports.
					['^\\u0000'],
					// Node.js builtins prefixed with `node:`.
					['^node:'],
					// Packages.
					// Things that start with a letter (or digit or underscore), or `@` followed by a letter.
					['^@?\\w'],
					// Absolute imports and other imports such as Vue-style `@/foo`.
					// Anything not matched in another group.
					['^@fllite-fe/*'],
					['^'],
					// Relative imports.
					// Anything that starts with a dot.
					['^\\.'],
				],
			},
		],
		'simple-import-sort/exports': 'error',
		'import/first': 'error',
		'import/newline-after-import': 'error',
		'import/no-duplicates': 'error',
		'max-len': 'off',
		'no-duplicate-imports': 'error',
		'object-curly-spacing': ['error', 'always'],
		'array-bracket-spacing': ['error', 'never'],
		'computed-property-spacing': ['error', 'never'],
	},
}
