import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { IncomingMessage, ServerResponse } from 'http'
import { replaceInFileSync } from 'replace-in-file'
import { NextUrlWithParsedQuery } from 'next/dist/server/request-meta'
import { Readable } from 'stream'

// Make header keys lowercase to ensure integrity.
export const normalizeHeaders = (headers: Record<string, any>) =>
	Object.entries(headers).reduce((acc, [key, value]) => ({ ...acc, [key.toLowerCase()]: value }), {} as Record<string, string>)

// Handle fetching of S3 object before optimization happens in nextjs.
export const requestHandler =
	(bucketName: string) =>
	async (req: IncomingMessage, res: ServerResponse, url?: NextUrlWithParsedQuery): Promise<void> => {
		if (!url) {
			throw new Error('URL is missing from request.')
		}

		// S3 expects keys without leading `/`
		const trimmedKey = url.href.startsWith('/') ? url.href.substring(1) : url.href

		const client = new S3Client({})
		const response = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: trimmedKey }))

		if (!response.Body) {
			throw new Error(`Could not fetch image ${trimmedKey} from bucket.`)
		}

		const stream = response.Body as Readable

		const data = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = []
			stream.on('data', (chunk) => chunks.push(chunk))
			stream.once('end', () => resolve(Buffer.concat(chunks)))
			stream.once('error', reject)
		})

		res.statusCode = 200

		if (response.ContentType) {
			res.setHeader('Content-Type', response.ContentType)
		}

		if (response.CacheControl) {
			res.setHeader('Cache-Control', response.CacheControl)
		}

		res.write(data)
		res.end()
	}

export enum BumpType {
	Patch = 'patch',
	Minor = 'minor',
	Major = 'major',
}

export const bumpMapping = [
	{
		test: /(.*)(fix:|fix\((.*)\):)/,
		bump: BumpType.Patch,
	},
	{
		test: /(.*)(chore:|chore\((.*)\):)/,
		bump: BumpType.Patch,
	},
	{
		test: /(.*)(feat:|feat\((.*)\):|feature:|feature\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(perf:|perf\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(ref:|ref\((.*)\):|refactor:|refactor\((.*)\):|refactoring:|refactoring\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(revert:|revert\((.*)\):)/,
		bump: BumpType.Patch,
	},
	{
		test: /(.*)(style:|style\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(test:|test\((.*)\):|tests:|tests\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(ci:|ci\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(build:|build\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: /(.*)(docs:|docs\((.*)\):|doc:|doc\((.*)\):)/,
		bump: BumpType.Minor,
	},
	{
		test: 'BREAKING CHANGE',
		bump: BumpType.Major,
		scanBody: true,
	},
]

export const isValidTag = (tag: string, prefix: string) => {
	// Replace "v" in case used for tagging.
	const normalizedTag = tag.replace(prefix, '')
	const [major, minor, patch] = normalizedTag.split('.').map(Number).map(isNaN)

	return !major && !minor && !patch
}

export const bumpCalculator = (version: string, bumpType: BumpType) => {
	const [major, minor, patch] = version.split('.').map(Number)

	if (bumpType === BumpType.Major) {
		return `${major + 1}.0.0`
	}

	if (bumpType === BumpType.Minor) {
		return `${major}.${minor + 1}.0`
	}

	if (bumpType === BumpType.Patch) {
		return `${major}.${minor}.${patch + 1}`
	}

	throw new Error(`Unknown bump type - ${bumpType}!`)
}

export const replaceVersionInCommonFiles = (oldVersion: string, newVersion: string) => {
	const results = replaceInFileSync({
		allowEmptyPaths: true,
		ignore: [
			'**/node_modules/**',
			'**/.venv/**',
			'**/vendor/**',
			'**/.git/**',
			//
		],
		files: [
			'package.json',
			'package-lock.json',
			'package-lock.json', // Duplicate because lock file contains two occurences.
			// 'yarn.lock', Yarn3 lock file does not contain version from package.json
			'composer.json',
			// 'composer.lock', Composer2 lock file does not include version from composer.json
			'pyproject.toml',
			'**/__init__.py',
		],
		from: [
			`"version": "${oldVersion}"`, // npm/php style
			`"version":"${oldVersion}"`, // uglified npm/php style
			`version = "${oldVersion}"`, // python style
			`__version__ = '${oldVersion}'`, // python style
		],
		to: [
			`"version": "${newVersion}"`,
			`"version":"${newVersion}"`,
			`version = "${newVersion}"`,
			`__version__ = '${newVersion}'`,
			//
		],
	})

	return results
}
