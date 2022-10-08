import pkg from './package.json'
import { defineConfig } from 'rollup'
import esbuild from 'esbuild'
import path from 'path'
import AdmZip from 'adm-zip'
import typescript from 'rollup-plugin-typescript2'

const standalone = {
	name: 'standalone',
	resolveId(source, importer, options) {
		return source
	},
	transform(code, id) {
		const result = esbuild.buildSync({
			stdin: {
				contents: code,
				loader: 'ts',
				resolveDir: path.dirname(id),
			},
			external: ['sharp', 'next', 'aws-sdk'],
			bundle: true,
			minify: true,
			write: false,
			outdir: 'out',
			platform: 'node',
			target: 'es2020',
		})

		result.errors.forEach((err) => {
			console.error(err.text)
		})
		result.warnings.forEach((err) => {
			console.warn(err.text)
		})

		return result.outputFiles[0].text
	},
	writeBundle(options, bundle) {
		console.log(options.file)
		const outputFileName = options.file

		if (!outputFileName.includes('.zip')) {
			return
		}

		const chunkCode = Object.values(bundle)[0].code

		const zip = new AdmZip()
		zip.addFile('index.js', chunkCode)
		zip.writeZip(outputFileName)
	},
}

export default defineConfig([
	{
		input: 'lib/index.ts',
		plugins: [typescript({ useTsconfigDeclarationDir: true })],
		output: {
			format: 'commonjs',
			file: pkg.exports,
		},
	},
	{
		input: 'lib/cli.ts',
		plugins: [standalone],
		output: {
			format: 'cjs',
			file: pkg.bin['next-utils'],
			banner: '#!/usr/bin/env node',
		},
	},
	{
		input: 'lib/standalone/server-handler.ts',
		plugins: [standalone],
		output: [
			{
				file: 'dist/server-handler.zip',
			},
			{
				file: 'dist/server-handler.js',
			},
		],
	},
	// @NOTE: Moved away from Rollup as Webpack is more efficient in bundling internal require.resolve calls.
	// Resulting in no need for layers and smaller bundle overall.
	// {
	// 	input: 'lib/standalone/image-handler.ts',
	// 	plugins: [standalone],
	// 	output: [
	// 		{
	// 			file: 'dist/image-handler.zip',
	// 		},
	// 		{
	// 			file: 'dist/image-handler.js',
	// 		},
	// 	],
	// },
])
