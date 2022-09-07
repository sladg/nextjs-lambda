import json from '@rollup/plugin-json'
import ts from 'rollup-plugin-ts'
import pkg from './package.json'
import { defineConfig } from 'rollup'
import esbuild from 'esbuild'
import path from 'path'
import AdmZip from 'adm-zip'

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
			external: ['sharp', 'next'],
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
		plugins: [json(), ts()],
		output: {
			format: 'cjs',
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
	{
		input: 'lib/standalone/image-handler.ts',
		plugins: [standalone],
		output: [
			{
				file: 'dist/image-handler.zip',
			},
			{
				file: 'dist/image-handler.js',
			},
		],
	},
])
