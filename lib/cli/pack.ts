import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { nextServerConfigRegex } from '../consts'
import { findInFile, findPathToNestedFile, validateFolderExists, validatePublicFolderStructure, zipFolder, zipMultipleFoldersOrFiles } from '../utils'

interface Props {
	standaloneFolder: string
	publicFolder: string
	handlerPath: string
	outputFolder: string
	commandCwd: string
}

const staticNames = {
	nodeFolder: 'node_modules',
	nextServer: 'server.js',
	packageJson: 'package.json',
	dependenciesZip: 'dependenciesLayer.zip',
	assetsZip: 'assetsLayer.zip',
	codeZip: 'code.zip',
}

export const packHandler = async ({ handlerPath, outputFolder, publicFolder, standaloneFolder, commandCwd }: Props) => {
	validatePublicFolderStructure(publicFolder)
	validateFolderExists(standaloneFolder)

	// Dependencies layer configuration
	const nodeModulesFolderPath = path.resolve(standaloneFolder, staticNames.nodeFolder)
	const depsLambdaFolder = 'nodejs/node_modules'
	const dependenciesOutputPath = path.resolve(outputFolder, staticNames.dependenciesZip)

	// Assets bundle configuration
	const buildIdPath = path.resolve(commandCwd, './.next/BUILD_ID')
	const generatedStaticContentPath = path.resolve(commandCwd, '.next/static')
	const generatedStaticRemapping = '_next/static'
	const assetsOutputPath = path.resolve(outputFolder, staticNames.assetsZip)

	const pathToNextOutput = findPathToNestedFile(staticNames.nextServer, standaloneFolder)

	// Code layer configuration
	const generatedNextServerPath = path.resolve(pathToNextOutput, staticNames.nextServer)
	const packageJsonPath = path.resolve(standaloneFolder, staticNames.packageJson)
	const codeOutputPath = path.resolve(outputFolder, staticNames.codeZip)

	// Clean output directory before continuing
	rmSync(outputFolder, { force: true, recursive: true })
	mkdirSync(outputFolder)

	// @TODO: We need to include nested node_modules in case of mono-repos.
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

	const tmpFolder = tmpdir()

	const nextConfig = findInFile(generatedNextServerPath, nextServerConfigRegex)
	const configPath = path.resolve(tmpFolder, `./config.json_${Math.random()}`)
	writeFileSync(configPath, nextConfig, 'utf-8')

	// Zip codebase including handler.
	await zipMultipleFoldersOrFiles({
		outputName: codeOutputPath,
		inputDefinition: [
			{
				isFile: true,
				path: packageJsonPath,
				name: 'package.json',
			},
			{
				isGlob: true,
				dot: true,
				cwd: pathToNextOutput,
				path: '**/*',
				ignore: ['**/node_modules/**', '*.zip', '**/package.json'],
			},
			{
				isFile: true,
				path: handlerPath,
				name: 'handler.js',
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
