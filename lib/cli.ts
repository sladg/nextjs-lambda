import { Command } from 'commander'
import path from 'path'
import packageJson from '../package.json'
import { changelogHandler } from './cli/changelog'
import { deployHandler } from './cli/deploy'
import { guessHandler } from './cli/guess'
import { packHandler } from './cli/pack'
import { shipitHandler } from './cli/shipit'
import { wrapProcess } from './utils'

const commandCwd = process.cwd()
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
		'--standaloneFolder <path>',
		'Folder including NextJS standalone build. Parental folder should include more folders as well.',
		path.resolve(commandCwd, '.next/standalone'),
	)
	.option(
		'--publicFolder <path>',
		'Folder where public assets are located, typically this folder is located in root of the project.',
		path.resolve(commandCwd, './public'),
	)
	.option(
		'--handlerPath <path>',
		'Path to custom handler to be used to handle ApiGw events. By default this is provided for you.',
		path.resolve(path.dirname(__filename), './server-handler.js'),
	)
	.option(
		'--outputFolder <path>',
		'Path to folder which should be used for outputting bundled ZIP files for your Lambda. It will be cleared before every script run.',
		path.resolve(commandCwd, './next.out'),
	)
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { standaloneFolder, publicFolder, handlerPath, outputFolder } = options
		wrapProcess(packHandler({ commandCwd, handlerPath, outputFolder, publicFolder, standaloneFolder }))
	})

program
	.command('guess')
	.description('Calculate next version based on last version and commit message.')
	.argument('<commitMessage>', 'Commit message to use for guessing bump.')
	.argument('<latestVersion>', 'Your existing app version which should be used for calculation of next version.')
	.option('-t, --tagPrefix <prefix>', 'Prefix version with string of your choice', 'v')
	.action(async (commitMessage, latestVersion, options) => {
		console.log('Our config is: ', options)
		const { tagPrefix } = options
		wrapProcess(guessHandler({ commitMessage, latestVersion, tagPrefix }))
	})

program
	.command('shipit')
	.description('Get last tag, calculate bump version for all commits that happened and create release branch.')
	.option('--failOnMissingCommit', 'In case commit has not happened since last tag (aka. we are on latest tag) fail.', Boolean, true)
	.option('-f, --forceBump', 'In case no compatible commits found, use patch as fallback and ensure bump happens.', Boolean, true)
	.option('-a, --autoPush', 'This will automatically create release branch and tag commit in master.', Boolean, true)
	.option('-t, --tagPrefix <prefix>', 'Prefix version with string of your choice.', 'v')
	.option('-r, --releaseBranchPrefix <prefix>', 'Prefix for release branch fork.', 'release/')
	.option('--gitUser <user>', 'User name to be used for commits.', 'Bender')
	.option('--gitEmail <email>', 'User email to be used for commits.', 'bender@bot.eu')
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { tagPrefix, failOnMissingCommit, releaseBranchPrefix, forceBump, gitUser, gitEmail } = options
		wrapProcess(shipitHandler({ tagPrefix, gitEmail, gitUser, failOnMissingCommit, forceBump, releaseBranchPrefix }))
	})

program
	.command('deploy')
	.description('Deploy Next application via CDK')
	.option('--stackName <name>', 'Name of the stack to be deployed.', 'StandaloneNextjsStack-Temporary')
	.option('--appPath <path>', 'Absolute path to app.', path.resolve(__dirname, '../dist/cdk-app.js'))
	.option('--bootstrap', 'Bootstrap CDK stack.', false)
	.option('--lambdaTimeout <sec>', 'Set timeout for lambda function handling server requirests', Number, 15)
	.option('--lambdaMemory <mb>', 'Set memory for lambda function handling server requirests', Number, 512)
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { stackName, appPath, bootstrap, lambdaTimeout, lambdaMemory } = options
		wrapProcess(deployHandler({ stackName, appPath, bootstrap, lambdaTimeout, lambdaMemory }))
	})

program
	.command('changelog')
	.description('Generate changelog from Git, assuming tag being a release. INTERNAL USE ONLY for now.')
	.option('--outputFile <path>', 'Path to file where changelog should be written.', path.resolve(commandCwd, './CHANGELOG.md'))
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { outputFile } = options
		wrapProcess(changelogHandler({ outputFile }))
	})

program.parse(process.argv)
