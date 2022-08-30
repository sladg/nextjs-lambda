#!/usr/bin/env node
import { exec as child_exec } from 'child_process'
import util from 'util'
import path from 'path'
import packageJson from '../package.json'
import { simpleGit } from 'simple-git'
import { Command } from 'commander'
import { bumpCalculator, bumpMapping, BumpType, isValidTag, replaceVersionInCommonFiles } from './utils'

const exec = util.promisify(child_exec)

const skipCiFlag = '[skip ci]'

const scriptDir = path.dirname(__filename)
const scriptPath = path.resolve(`${scriptDir}/../../scripts/pack-nextjs.sh`)
const handlerPath = path.resolve(`${scriptDir}/../server-handler/index.js`)

const program = new Command()

program
	//
	.name(packageJson.name)
	.description(packageJson.description)
	.version(packageJson.version)

program
	.command('pack')
	.description('Package standalone Next12 build into Lambda compatible ZIPs.')
	.option('--output', 'folder where to save output', 'next.out')
	.option('--publicFolder', 'folder where public assets are located', 'public')
	.option('--handler', 'custom handler to deal with ApiGw events', handlerPath)
	.option('--grepBy', 'keyword to identify configuration inside server.js', 'webpack')
	.action(async (str, options) => {
		// @TODO: Ensure path exists.
		// @TODO: Ensure.next folder exists with standalone folder inside.

		// @TODO: Transform into code, move away from script.
		// Also, pass parameters and options.
		console.log('Starting packaging of your NextJS project!')

		await exec(`chmod +x ${scriptPath} && ${scriptPath}`)
			.then(({ stdout }) => console.log(stdout))
			.catch(console.error)

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
			.raw(`--message "Release: ${nextTagWithPrefix}"`, '--amend')
			.push(remote.name, `${branch.current}:${releaseBranch}`)

		// Create tag and push it to master.
		// @Note: CI/CD should not be listening for tags in master, it should listen to release branch.
		await git.addTag(nextTagWithPrefix).pushTags()

		console.log(`Successfuly tagged and created new branch - ${releaseBranch}`)
	})

program.parse(process.argv)
