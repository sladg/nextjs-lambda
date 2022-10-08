import path from 'path'
import { Configuration } from 'webpack'
import ZipPlugin from 'zip-webpack-plugin'

const webpackConfig: Configuration = {
	entry: './lib/standalone/image-handler.ts',
	target: 'node',
	output: {
		path: path.resolve(__dirname, '.webpack'),
		filename: 'handler.js',
		libraryTarget: 'commonjs',
		library: 'handler',
		libraryExport: 'handler',
	},
	resolve: {
		extensions: ['.ts', '.js', '.json'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: { loader: 'swc-loader' },
			},
		],
	},
	externals: {
		sharp: 'commonjs sharp',
	},
	plugins: [
		new ZipPlugin({
			path: path.resolve(__dirname, 'dist'),
			filename: 'image-handler.zip',
		}),
	],
}

export default webpackConfig
