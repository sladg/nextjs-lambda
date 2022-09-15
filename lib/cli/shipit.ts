import { simpleGit } from 'simple-git'
import { skipCiFlag } from '../consts'
import { bumpCalculator, bumpMapping, BumpType, isValidTag, replaceVersionInCommonFiles } from '../utils'

interface Props {
	gitUser: string
	gitEmail: string
	tagPrefix: string
	failOnMissingCommit: boolean
	releaseBranchPrefix: string
	forceBump: boolean
}

export const shipitHandler = async ({ gitEmail, gitUser, tagPrefix, failOnMissingCommit, forceBump, releaseBranchPrefix }: Props) => {
	const git = simpleGit()

	git.addConfig('user.name', gitUser)
	git.addConfig('user.email', gitEmail)

	const tags = await git.tags()
	const log = await git.log()
	const branch = await git.branch()
	const [remote] = await git.getRemotes()

	const latestCommit = log.latest?.hash
	const latestTag = tags.latest ?? '0.0.0'
	const currentTag = latestTag.replace(tagPrefix, '')

	console.log('Current version: ', latestTag)

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

	const bumps: BumpType[] = []

	commits.all.forEach(({ message, body }) => {
		const match = bumpMapping.find(({ test, scanBody }) => (scanBody ? body : message).match(test))
		if (!match) {
			console.warn(`Invalid commit, cannot match bump - ${message}!`)
		} else {
			bumps.push(match?.bump)
		}
	})

	console.log('Bumps: ', bumps)

	// Bump minor in case nothing is found.
	if (bumps.length < 1 && forceBump) {
		console.log('Forcing patch bump!')
		bumps.push(BumpType.Patch)
	}

	const nextTag = bumps.reduce((acc, curr) => bumpCalculator(acc, curr), currentTag)
	const nextTagWithPrefix = tagPrefix + nextTag
	const releaseBranch = `${releaseBranchPrefix}${nextTagWithPrefix}`
	console.log(`Next version is - ${nextTagWithPrefix}!`)

	if (currentTag === nextTag) {
		throw new Error('Failed to bump version!')
	}

	const replacementResults = replaceVersionInCommonFiles(currentTag, nextTag)
	console.log(`Replaced version in files.`, replacementResults)

	// Commit changed files (versions) and create a release commit with skip ci flag.
	await git
		//
		.add('./*')
		.raw('commit', '--message', `Release: ${nextTagWithPrefix} ${skipCiFlag}`)
		// Create tag and push it to master.
		.addTag(nextTagWithPrefix)

	git.push(remote.name, branch.current)
	git.pushTags()

	// As current branch commit includes skip ci flag, we want to ommit this flag for release branch so pipeline can run (omitting infinite loop).
	// So we are overwriting last commit message and pushing to release branch.
	await git
		//
		.raw('commit', '--message', `Release: ${nextTagWithPrefix}`, '--amend')
		.push(remote.name, `${branch.current}:${releaseBranch}`)

	// @Note: CI/CD should not be listening for tags in master, it should listen to release branch.
	// @TODO: Include commits and commit bodies in release commit so Jira can pick it up.

	console.log(`Successfuly tagged and created new branch - ${releaseBranch}`)
}
