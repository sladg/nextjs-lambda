import json from '@rollup/plugin-json'
import AdmZip from 'adm-zip'
import esbuild from 'esbuild'
import path from 'path'
import ts from 'rollup-plugin-ts'
import pkg from './package.json'

const pluginStandalone = () => ({
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
			external: ['sharp'],
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
})

const pluginZip = () => ({
	name: 'zip',
	async generateOutputs(bundle) {
		Object.entries(bundle).forEach(async ([chunkName, chunkOpts]) => {
			console.log(chunkOpts)
			const zip = new AdmZip()
			zip.addFile('index.js', chunkOpts.code)
			this.setAssetSource(chunkOpts.facadeModuleId, zip.toBuffer())
		})
	},
})

export default [
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
		plugins: [json(), ts()],
		output: {
			format: 'cjs',
			file: pkg.bin.app,
			banner: '#!/usr/bin/env node',
		},
	},
	{
		input: 'lib/standalone/server-handler.ts',
		plugins: [pluginStandalone(), pluginZip()],
		output: {
			file: 'dist/server-handler.zip',
		},
	},
	{
		input: 'lib/standalone/image-handler.ts',
		plugins: [pluginStandalone(), pluginZip()],
		output: {
			file: 'dist/image-handler.zip',
		},
	},
]
