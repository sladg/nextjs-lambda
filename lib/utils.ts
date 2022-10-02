import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import archiver from 'archiver'
import { closeSync, createWriteStream, openSync, readFileSync, readSync, symlinkSync } from 'fs'
import { IOptions as GlobOptions } from 'glob'
import { IncomingMessage, ServerResponse } from 'http'
import { NextUrlWithParsedQuery } from 'next/dist/server/request-meta'
import { replaceInFileSync } from 'replace-in-file'
import { Readable } from 'stream'
import crypto from 'crypto'
import { exec } from 'child_process'

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
		bump: BumpType.Patch,
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
			'**/package.json', // Useful for workspaces with nested package.jsons also including versions.
			'package-lock.json',
			'package-lock.json', // Duplicate because lock file contains two occurences.
			// 'yarn.lock', Yarn3 lock file does not contain version from package.json
			'composer.json',
			'**/composer.json', // Useful for workspaces with nested composer.jsons also including versions.
			// 'composer.lock', Composer2 lock file does not include version from composer.json
			'pyproject.toml',
			'**/__init__.py',
		],
		from: [
			/\"version\":(.*)"\d+\.\d+\.\d+"/g, // little more generic to allow for incorrect version to be replaced
			`"version": "${oldVersion}"`, // npm/php style
			`"version":"${oldVersion}"`, // uglified npm/php style
			`version = "${oldVersion}"`, // python style
			`__version__ = '${oldVersion}'`, // python style
		],
		to: [
			`"version": "${newVersion}"`,
			`"version": "${newVersion}"`,
			`"version":"${newVersion}"`,
			`version = "${newVersion}"`,
			`__version__ = '${newVersion}'`,
			//
		],
	})

	return results
}

export const findInFile = (filePath: string, regex: RegExp): string => {
	const content = readFileSync(filePath, 'utf-8')
	const data = content.match(regex)

	if (!data?.[0]) {
		throw new Error('Unable to match Next server configuration.')
	}

	return data[0]
}

interface ZipFolderProps {
	outputName: string
	folderPath: string
	dir?: string
}

export const zipFolder = async ({ folderPath, outputName, dir }: ZipFolderProps) =>
	zipMultipleFoldersOrFiles({
		outputName,
		inputDefinition: [{ path: folderPath, dir }],
	})

interface FolderInput {
	path: string
	dir?: string
}

interface FileInput {
	path: string
	name: string
	isFile: true
}

interface SymlinkInput {
	source: string
	target: string
	isSymlink: true
}

interface GlobInput extends GlobOptions {
	path: string
	isGlob: true
}

interface ZipProps {
	outputName: string
	inputDefinition: (FolderInput | FileInput | SymlinkInput | GlobInput)[]
}

export const zipMultipleFoldersOrFiles = async ({ outputName, inputDefinition }: ZipProps) => {
	const archive = archiver('zip', { zlib: { level: 5 } })
	const stream = createWriteStream(outputName)

	return new Promise((resolve, reject) => {
		inputDefinition.forEach((props) => {
			if ('isFile' in props) {
				archive.file(props.path, { name: props.name })
			} else if ('isSymlink' in props) {
				archive.symlink(props.source, props.target)
			} else if ('isGlob' in props) {
				archive.glob(props.path, props)
			} else {
				archive.directory(props.path, props.dir ?? false)
			}
		})

		archive.on('error', (err) => reject(err)).pipe(stream)
		stream.on('close', resolve)
		archive.finalize()
	})
}

interface SymlinkProps {
	sourcePath: string
	linkLocation: string
}

export const createSymlink = ({ linkLocation, sourcePath }: SymlinkProps) => symlinkSync(sourcePath, linkLocation)

const BUFFER_SIZE = 8192

export const md5FileSync = (path: string) => {
	const fd = openSync(path, 'r')
	const hash = crypto.createHash('md5')
	const buffer = Buffer.alloc(BUFFER_SIZE)

	try {
		let bytesRead

		do {
			bytesRead = readSync(fd, buffer, 0, BUFFER_SIZE, null)
			hash.update(buffer.subarray(0, bytesRead))
		} while (bytesRead === BUFFER_SIZE)
	} finally {
		closeSync(fd)
	}

	return hash.digest('hex')
}

const promise = async (cmd: string) => {
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.error(error)
				reject()
			}
			resolve(null)
		})
	})
}

interface CommandProps {
	cmd: string
	path?: string
}

export const executeAsyncCmd = async ({ cmd, path }: CommandProps) => {
	if (path) {
		process.chdir(path)
	}

	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.error(`exec error: ${error}`)
				reject(error)
			} else {
				console.log(`stdout: ${stdout}`)
				console.error(`stderr: ${stderr}`)
				resolve(stdout)
			}
		})
	})
}

export const wrapProcess = async (fn: Promise<any>) => {
	try {
		await fn
	} catch (e) {
		console.error('Process failed with error:', e)
		process.exit(1)
	}
}
