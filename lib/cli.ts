import { Command } from 'commander'
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { simpleGit } from 'simple-git'
import packageJson from '../package.json'
import { bumpCalculator, bumpMapping, BumpType, findInFile, isValidTag, replaceVersionInCommonFiles, zipFolder, zipMultipleFoldersOrFiles } from './utils'

const skipCiFlag = '[skip ci]'
const commandCwd = process.cwd()
const nextServerConfigRegex = /(?<=conf: )(.*)(?=,)/
const scriptDir = path.dirname(__filename)

const program = new Command()

program
	//
	.name(packageJson.name)
	.description(packageJson.description)
	.version(packageJson.version)

program
	.command('pack')
	.description('Package standalone Next12 build into Lambda compatible ZIPs.')
	.option(
		'--standaloneFolder',
		'Folder including NextJS standalone build. Parental folder should include more folders as well.',
		path.resolve(commandCwd, '.next/standalone'),
	)
	.option(
		'--publicFolder',
		'Folder where public assets are located, typically this folder is located in root of the project.',
		path.resolve(commandCwd, './public'),
	)
	.option(
		'--handlerPath',
		'Path to custom handler to be used to handle ApiGw events. By default this is provided for you.',
		path.resolve(scriptDir, './server-handler.js'),
	)
	.option(
		'--outputFolder',
		'Path to folder which should be used for outputting bundled ZIP files for your Lambda. It will be cleared before every script run.',
		path.resolve(commandCwd, './next.out'),
	)
	.action(async (options) => {
		const { standaloneFolder, publicFolder, handlerPath, outputFolder } = options

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
					isFile: true,
					path: handlerPath,
					name: 'handler.js',
				},
				{
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
	})

program
	.command('guess')
	.description('Calculate next version based on last version and commit message.')
	.argument('<commitMessage>', 'Commit message to use for guessing bump.')
	.argument('<latestVersion>', 'Your existing app version which should be used for calculation of next version.')
	.option('-t, --tagPrefix <prefix>', 'Prefix version with string of your choice', 'v')
	.action(async (commitMessage, latestVersion, options) => {
		const { tagPrefix } = options

		if (!isValidTag(latestVersion, tagPrefix)) {
			throw new Error(`Invalid version found - ${latestVersion}!`)
		}

		const match = bumpMapping.find(({ test }) => commitMessage.match(test))
		if (!match) {
			throw new Error('No mapping for for suplied commit message.')
		}

		const nextTag = bumpCalculator(latestVersion.replace(tagPrefix, ''), match?.bump)
		const nextTagWithPrefix = tagPrefix + nextTag

		console.log(nextTagWithPrefix)
	})

program
	.command('shipit')
	.description('Get last tag, calculate bump version for all commits that happened and create release branch.')
	.option('--failOnMissingCommit', 'In case commit has not happened since last tag (aka. we are on latest tag) fail.', Boolean, true)
	.option('-f, --forceBump', 'In case no compatible commits found, use patch as fallback and ensure bump happens.', Boolean, true)
	.option('-a, --autoPush', 'This will automatically create release branch and tag commit in master.', Boolean, true)
	.option('-t, --tagPrefix <prefix>', 'Prefix version with string of your choice', 'v')
	.option('-r, --releaseBranchPrefix <prefix>', 'Prefix for release branch fork.', 'release/')
	.action(async (options) => {
		const { tagPrefix, failOnMissingCommit, releaseBranchPrefix, forceBump } = options

		const git = simpleGit()
		const tags = await git.tags()
		const log = await git.log()
		const branch = await git.branch()
		const [remote] = await git.getRemotes()

		const latestCommit = log.latest?.hash
		const latestTag = tags.latest ?? '0.0.0'
		const currentTag = latestTag.replace(tagPrefix, '')

		if (!isValidTag(latestTag, tagPrefix)) {
			throw new Error(`Invalid tag found - ${latestTag}!`)
		}

		if (!latestCommit) {
			throw new Error('Latest commit was not found!')
		}

		const commits = await git.log({
			from: tags.latest,
			to: latestCommit,
		})

		if (commits.total < 1 && failOnMissingCommit) {
			throw new Error('No new commits since last tag.')
		}

		const bumps = []

		commits.all.forEach(({ message, body }) => {
			const match = bumpMapping.find(({ test, scanBody }) => (scanBody ? body : message).match(test))
			if (!match) {
				console.warn(`Invalid commit, cannot match bump - ${message}!`)
			} else {
				bumps.push(match?.bump)
			}
		})

		// Bump minor in case nothing is found.
		if (bumps.length < 1 && forceBump) {
			bumps.push(BumpType.Patch)
		}

		const nextTag = bumps.reduce((acc, curr) => bumpCalculator(acc, curr), currentTag)
		const nextTagWithPrefix = tagPrefix + nextTag
		const releaseBranch = `${releaseBranchPrefix}${nextTagWithPrefix}`
		console.log(`Next version is - ${nextTagWithPrefix}!`)

		const replacementResults = replaceVersionInCommonFiles(currentTag, nextTag)
		console.log(`Replaced version in files.`, replacementResults)

		// Commit changed files (versions) and create a release commit with skip ci flag.
		await git
			//
			.add('./*')
			.commit(`Release: ${nextTagWithPrefix} ${skipCiFlag}`)
			.push(remote.name, branch.current)

		// As current branch commit includes skip ci flag, we want to ommit this flag for release branch so pipeline can run (omitting infinite loop).
		// So we are overwriting last commit message and pushing to release branch.
		await git
			//
			.raw('commit', `--message "Release: ${nextTagWithPrefix}"`, '--amend')
			.push(remote.name, `${branch.current}:${releaseBranch}`)

		// Create tag and push it to master.
		// @Note: CI/CD should not be listening for tags in master, it should listen to release branch.
		await git.addTag(nextTagWithPrefix).pushTags()

		console.log(`Successfuly tagged and created new branch - ${releaseBranch}`)
	})

program.parse(process.argv)
