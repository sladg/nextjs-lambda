import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import { nextServerConfigRegex, nextServerConfigRegex13_3 } from '../consts'
import { findObjectInFile, findPathToNestedFile, validateFolderExists, validatePublicFolderStructure, zipMultipleFoldersOrFiles } from '../utils'

interface Props {
	standaloneFolder: string
	publicFolder: string
	handlerPath: string
	outputFolder: string
	buildFolder: string
}

const staticNames = {
	nodeFolder: 'node_modules',
	nextServer: 'server.js',
	packageJson: 'package.json',
	dependenciesZip: 'dependenciesLayer.zip',
	assetsZip: 'assetsLayer.zip',
	codeZip: 'code.zip',
}

export const packHandler = async ({ handlerPath, outputFolder, publicFolder, standaloneFolder, buildFolder }: Props) => {
	validatePublicFolderStructure(publicFolder)
	validateFolderExists(standaloneFolder)

	const pathToNextOutput = findPathToNestedFile(staticNames.nextServer, standaloneFolder)

	// Dependencies layer configuration
	const nodeModulesFolderPath = path.resolve(standaloneFolder, staticNames.nodeFolder)
	const depsLambdaFolder = 'node_modules'
	const dependenciesOutputPath = path.resolve(outputFolder, staticNames.dependenciesZip)
	const nestedDependenciesOutputPath = dependenciesOutputPath.includes(pathToNextOutput) ? null : path.resolve(pathToNextOutput, staticNames.nodeFolder)

	// Assets bundle configuration
	const buildIdPath = path.resolve(buildFolder, './.next/BUILD_ID')
	const generatedStaticContentPath = path.resolve(buildFolder, './.next/static')
	const generatedStaticRemapping = '_next/static'
	const assetsOutputPath = path.resolve(outputFolder, staticNames.assetsZip)

	// Code layer configuration
	const generatedNextServerPath = path.resolve(pathToNextOutput, staticNames.nextServer)
	const packageJsonPath = path.resolve(standaloneFolder, staticNames.packageJson)
	const codeOutputPath = path.resolve(outputFolder, staticNames.codeZip)

	// Clean output directory before continuing
	rmSync(outputFolder, { force: true, recursive: true })
	mkdirSync(outputFolder)

	// Zip dependencies from standalone output in a layer-compatible format.
	// In case monorepo is used, include nested node_modules folder which might include additional dependencies.
	await zipMultipleFoldersOrFiles({
		outputName: dependenciesOutputPath,
		inputDefinition: [
			{
				path: nodeModulesFolderPath,
				dir: depsLambdaFolder,
			},
			...(nestedDependenciesOutputPath
				? [
						{
							path: nestedDependenciesOutputPath,
							dir: depsLambdaFolder,
						},
						// eslint-disable-next-line no-mixed-spaces-and-tabs
				  ]
				: []),
		],
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

	const nextConfig = findObjectInFile(generatedNextServerPath, [nextServerConfigRegex13_3, nextServerConfigRegex]).replace('../../', '')
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
				ignore: ['*.zip', '**/package.json'],
			},
			{
				path: nodeModulesFolderPath,
				dir: 'node_modules',
			},
			{
				isFile: true,
				path: handlerPath,
				name: 'index.js',
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
