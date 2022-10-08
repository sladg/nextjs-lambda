import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { nextServerConfigRegex } from '../consts'
import { findInFile, zipFolder, zipMultipleFoldersOrFiles } from '../utils'

interface Props {
	standaloneFolder: string
	publicFolder: string
	handlerPath: string
	outputFolder: string
	commandCwd: string
}

export const packHandler = async ({ handlerPath, outputFolder, publicFolder, standaloneFolder, commandCwd }: Props) => {
	// @TODO: Validate that output folder exists.
	// @TODO: Validate server.js exists and we can match data.
	// @TODO: Validate that public folder is using `assets` subfolder.

	// Dependencies layer configuration
	const nodeModulesFolderPath = path.resolve(standaloneFolder, './node_modules')
	const depsLambdaFolder = 'nodejs/node_modules'
	const lambdaNodeModulesPath = path.resolve('/opt', depsLambdaFolder)
	const dependenciesOutputPath = path.resolve(outputFolder, 'dependenciesLayer.zip')

	// Code layer configuration
	const generatedNextServerPath = path.resolve(standaloneFolder, './server.js')
	const codeOutputPath = path.resolve(outputFolder, 'code.zip')

	// Assets bundle configuration
	const buildIdPath = path.resolve(commandCwd, './.next/BUILD_ID')
	const generatedStaticContentPath = path.resolve(commandCwd, '.next/static')
	const generatedStaticRemapping = '_next/static'
	const assetsOutputPath = path.resolve(outputFolder, 'assetsLayer.zip')

	// Clean output directory before continuing
	rmSync(outputFolder, { force: true, recursive: true })
	mkdirSync(outputFolder)

	// Zip dependencies from standalone output in a layer-compatible format.
	await zipFolder({
		outputName: dependenciesOutputPath,
		folderPath: nodeModulesFolderPath,
		dir: depsLambdaFolder,
	})

	// Zip staticly generated assets and public folder.
	await zipMultipleFoldersOrFiles({
		outputName: assetsOutputPath,
		inputDefinition: [
			{
				isFile: true,
				name: 'BUILD_ID',
				path: buildIdPath,
			},
			{
				path: publicFolder,
			},
			{
				path: generatedStaticContentPath,
				dir: generatedStaticRemapping,
			},
		],
	})

	// Create a symlink for node_modules so they point to the separately packaged layer.
	// We need to create symlink because we are not using NodejsFunction in CDK as bundling is custom.
	const tmpFolder = tmpdir()

	const symlinkPath = path.resolve(tmpFolder, `./node_modules_${Math.random()}`)
	symlinkSync(lambdaNodeModulesPath, symlinkPath)

	const nextConfig = findInFile(generatedNextServerPath, nextServerConfigRegex)
	const configPath = path.resolve(tmpFolder, `./config.json_${Math.random()}`)
	writeFileSync(configPath, nextConfig, 'utf-8')

	// Zip codebase including symlinked node_modules and handler.
	await zipMultipleFoldersOrFiles({
		outputName: codeOutputPath,
		inputDefinition: [
			{
				isGlob: true,
				cwd: standaloneFolder,
				path: '**/*',
				ignore: ['**/node_modules/**', '*.zip'],
			},
			{
				// @TODO: use {dot:true} configuration in archiver and remove this.
				// Ensure hidden files are included.
				isGlob: true,
				cwd: standaloneFolder,
				path: '.*/**/*',
			},
			{
				isFile: true,
				path: handlerPath,
				name: 'handler.js',
			},
			{
				// @TODO: Verify this as it seems like symlink is not needed when layer is in /opt/nodejs/node_modules
				isFile: true,
				path: symlinkPath,
				name: 'node_modules',
			},
			{
				isFile: true,
				path: configPath,
				name: 'config.json',
			},
		],
	})

	console.log('Your NextJS project was succefully prepared for Lambda.')
}
