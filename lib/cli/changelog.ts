import { DefaultLogFields, simpleGit } from 'simple-git'
import { writeFileSync } from 'fs'
import { getCommitLink, getCompareLink, sortTagsDescending } from '../utils'

interface Props {
	outputFile: string
	gitBaseUrl?: string
	nextTag?: string
}

const isGithub = !!process.env.GITHUB_REPOSITORY && !!process.env.GITHUB_SERVER_URL
const isBitbucket = !!process.env.BITBUCKET_GIT_HTTP_ORIGIN
const isGitlab = !!process.env.CI_PROJECT_URL

const httpGitUrl = isGithub
	? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
	: isBitbucket
	? process.env.BITBUCKET_GIT_HTTP_ORIGIN
	: isGitlab
	? process.env.CI_PROJECT_URL
	: null

export const changelogHandler = async ({ outputFile, gitBaseUrl, nextTag }: Props) => {
	const git = simpleGit()

	const gitUrl = gitBaseUrl ?? httpGitUrl
	if (!gitUrl) {
		throw new Error('Could not determine git base URL!')
	}

	await git.fetch(['--tags'])

	const tags = await git.tags()
	const commits = await git.log()
	const sortedTags = sortTagsDescending(tags.all)
	const sortedNormalizedTags = nextTag ? [nextTag, ...sortedTags] : sortedTags

	// Sorted from newest to oldest (highest version to lowest).
	const tagsWithLog = sortedNormalizedTags.map(async (tag, index, arr) => {
		const lowerTag = arr[index + 1]
		const higherTag = arr[index - 1]

		const latestTag = sortedTags.includes(tag) ? tag : commits.latest?.hash

		const log = await git.log({ from: lowerTag, to: latestTag })
		const filteredLog = log.all
			// Remove automatic commits (typically generated inside pipeline)
			.filter((a) => !a.message.includes('[skip ci]'))
			// Remove release commits (typically previous release)
			.filter((a) => !a.message.match(/release(.*)v(.*)\.(.*)\.(.*)/gi)?.length)

		// Make them unique.
		const authors = filteredLog.reduce((acc, curr) => ({ ...acc, [curr.author_email]: `[${curr.author_name}](mailto:${curr.author_email})` }), {})

		return {
			tag,
			log: filteredLog,
			authors: Object.values(authors),
			urlToGitDiff: getCompareLink(gitUrl, lowerTag, tag),
		}
	})

	const result = await Promise.all(tagsWithLog)

	const changelog: string[] = []

	changelog.push('# Changelog')

	result.forEach((a) => {
		changelog.push('\n')
		changelog.push(`## [${a.tag}](${a.urlToGitDiff})\n`)

		const logs = a.log as DefaultLogFields[]

		logs.forEach((b) => {
			changelog.push(`* ${b.message} \[[${b.hash}](${getCommitLink(gitUrl, b.hash)})\]`)
		})
	})

	writeFileSync(outputFile, changelog.join('\n'))

	console.log('Changelog has been generated sucessfully.')
}
