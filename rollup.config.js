import pkg from './package.json'
import ts from 'rollup-plugin-ts'
import json from '@rollup/plugin-json'

export default [
	{
		input: 'lib/index.ts',
		plugins: [json(), ts()],
		output: [
			{
				file: pkg.main,
				format: 'cjs',
				file: 'dist/main.js',
			},
		],
	},
	{
		input: 'lib/cli.ts',
		plugins: [json(), ts()],
		output: [
			{
				file: pkg.main,
				format: 'cjs',
				file: 'dist/cli.js',
				banner: '#!/usr/bin/env node',
			},
		],
	},
]
