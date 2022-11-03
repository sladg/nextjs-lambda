import { DefaultLogFields, simpleGit } from 'simple-git'
import { writeFileSync } from 'fs'
import packageJson from '../../package.json'
import { sortTagsDescending } from '../utils'

interface Props {
	outputFile: string
}

export const changelogHandler = async ({ outputFile }: Props) => {
	const git = simpleGit()

	const log = await git.log({ '--max-count': 20 })
	await git.fetch(['--tags'])

	const tags = await git.tags()

	console.log(log)
	console.log(tags)

	const sortedTags = sortTagsDescending(tags.all)

	// Sorted from newest to oldest (highest version to lowest).
	const tagsWithLog = sortedTags.map(async (tag, index, arr) => {
		const lowerTag = arr[index + 1]
		const higherTag = arr[index - 1]

		const log = await git.log({ from: lowerTag, to: tag })
		const filteredLog = log.all
			// Remove automatic commits (typically generated inside pipeline)
			.filter((a) => !a.message.includes('[skip ci]'))
			// Remove release commits (typically previous release)
			.filter((a) => !a.message.match(/release(.*)v(.*)\.(.*)\.(.*)/gi)?.length)

		// Make them unique.
		const authors = filteredLog.reduce((acc, curr) => ({ ...acc, [curr.author_email]: `[${curr.author_name}](mailto:${curr.author_email})` }), {})

		// Ensure that first commit have correct URL as there is no comparison.
		const formattedPath = lowerTag ? `${lowerTag}...${tag}` : tag

		return {
			tag,
			log: filteredLog,
			authors: Object.values(authors),
			urlToGitDiff: `https://github.com/sladg/nextjs-lambda/releases/tag/${formattedPath}`,
		}
	})

	const result = await Promise.all(tagsWithLog)

	const changelog: string[] = []

	changelog.push('# Changelog')
	changelog.push(`Current version: ${packageJson.version}`)

	result.forEach((a) => {
		changelog.push('\n')
		changelog.push(`## [${a.tag}](${a.urlToGitDiff})\n`)

		const logs = a.log as DefaultLogFields[]

		logs.forEach((b) => {
			console.log(b.refs)
			changelog.push(`* ${b.message} \[[${b.hash}](https://github.com/sladg/nextjs-lambda/commit/${b.hash})\]`)
		})
	})

	writeFileSync(outputFile, changelog.join('\n'))

	console.log('Changelog has been generated sucessfully.')
}
