import archiver from 'archiver'
import { exec } from 'child_process'
import { createWriteStream, existsSync, readdirSync, readFileSync, symlinkSync } from 'fs'
import glob, { IOptions as GlobOptions } from 'glob'
import { replaceInFileSync } from 'replace-in-file'
import semver from 'semver'
import semverRegex from 'semver-regex'

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
		test: /BREAKING CHANGE/i,
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
			/\"version\":(.*)"\d+\.\d+\.\d+"/, // little more generic to allow for incorrect version to be replaced
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

interface CommandProps {
	cmd: string
	path?: string
}

export const executeAsyncCmd = async ({ cmd, path }: CommandProps) => {
	if (path) {
		process.chdir(path)
	}

	return new Promise((resolve, reject) => {
		const sh = exec(cmd, (error, stdout, stderr) => {
			if (error) {
				reject(error)
			} else {
				resolve(stdout)
			}
		})

		sh.stdout?.on('data', (data) => {
			console.log(`stdout: ${data}`)
		})
		sh.stderr?.on('data', (data) => {
			console.error(`stderr: ${data}`)
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

export const findPathToNestedFile = (filename: string, inPath: string): string => {
	const results = glob.sync(`**/${filename}`, { cwd: inPath, ignore: ['**/node_modules/**'], realpath: true })

	if (!results[0]) {
		throw new Error(`Could not find file: ${filename} in your Next output.`)
	}

	return results[0].replace(filename, '')
}

export const validatePublicFolderStructure = (publicFolderPath: string) => {
	// If public folder does not exist, ignore.
	if (!existsSync(publicFolderPath)) {
		return
	}

	const paths = readdirSync(publicFolderPath)
	paths.forEach((publicPath) => {
		if (publicPath !== 'assets') {
			throw new Error('Public folder assets must be nested in public/assets folder.')
		}
	})
}

export const validateFolderExists = (folderPath: string) => {
	const exists = existsSync(folderPath)
	if (!exists) {
		throw new Error(`Folder: ${folderPath} does not exist!`)
	}
}

const isSemverTag = (tag: string) => (semverRegex().exec(tag)?.[0] ? true : false)
const parseTag = (tag: string) => semverRegex().exec(tag)?.[0] ?? '0.0.0'

export const sortTagsDescending = (tags: string[]) =>
	tags.filter(isSemverTag).sort((v1, v2) => {
		const sv1 = parseTag(v1)
		const sv2 = parseTag(v2)
		return semver.rcompare(sv1, sv2)
	})

export const findHighestTag = (tags: string[]) => sortTagsDescending(tags)[0]

export const getCommitLink = (remoteUrl: string, commit: string) => {
	if (remoteUrl.includes('bitbucket.org')) {
		return `${remoteUrl}/commits/${commit}`
	}

	if (remoteUrl.includes('github.com')) {
		return `${remoteUrl}/commit/${commit})`
	}

	return null
}

export const getCompareLink = (remoteUrl: string, previous: string, next: string) => {
	if (remoteUrl.includes('bitbucket.org')) {
		const formattedPrevious = previous ? `${previous}%0D${next}` : next
		return `${remoteUrl}/branches/compare/${formattedPrevious}`
	}

	if (remoteUrl.includes('github.com')) {
		const formattedPath = previous ? `${previous}...${next}` : next
		return `${remoteUrl}/releases/tag/${formattedPath}`
	}

	return null
}
