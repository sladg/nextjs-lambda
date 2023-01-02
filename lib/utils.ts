import archiver from 'archiver'
import { exec } from 'child_process'
import { createWriteStream, existsSync, readdirSync, readFileSync } from 'fs'
import glob, { IOptions as GlobOptions } from 'glob'

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

interface CommandProps {
	cmd: string
	path?: string
	env?: Record<string, string>
}

export const executeAsyncCmd = async ({ cmd, path, env }: CommandProps) => {
	if (path) {
		process.chdir(path)
	}

	return new Promise((resolve, reject) => {
		const sh = exec(cmd, { env: { ...process.env, ...env } }, (error, stdout, stderr) => {
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
