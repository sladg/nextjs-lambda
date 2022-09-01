import pkg from './package.json'
import ts from 'rollup-plugin-ts'
import json from '@rollup/plugin-json'
import cmd from 'rollup-plugin-command'

export default [
	{
		input: 'lib/index.ts',
		plugins: [json(), ts()],
		output: {
			format: 'cjs',
			file: pkg.main,
		},
	},
	{
		input: 'lib/cli.ts',
		plugins: [json(), ts()],
		output: {
			format: 'cjs',
			file: pkg.bin.app,
			banner: '#!/usr/bin/env node',
		},
	},
	{
		input: 'lib/standalone/image-handler.ts',
		plugins: [ts(), cmd(`zip ${pkg.exports['image-handler/zip']} ${pkg.exports['image-handler']}`, { exitOnFail: true })],
		output: {
			format: 'cjs',
			file: pkg.exports['image-handler'],
		},
	},
	{
		input: 'lib/standalone/server-handler.ts',
		plugins: [ts(), cmd(`zip ${pkg.exports['server-handler/zip']} ${pkg.exports['server-handler']}`, { exitOnFail: true })],
		output: {
			format: 'cjs',
			file: pkg.exports['server-handler'],
		},
	},
]
