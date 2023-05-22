#!/usr/bin/env node

import { Command } from 'commander'
import { copyFileSync, readFileSync } from 'fs'
import yaml from 'js-yaml'
import path from 'path'

import packageJson from '../package.json'
import { DEFAULT_MEMORY as IMAGE_LAMBDA_DEFAULT_MEMORY, DEFAULT_TIMEOUT as IMAGE_LAMBDA_DEFAULT_TIMEOUT } from './cdk/utils/imageLambda'
import { deployHandler } from './cli/deploy'
import { packHandler } from './cli/pack'
import { removeHandler } from './cli/remove'
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
	.option('--config <path>', 'YAML config file that can be set as opposed to having to set every flag.')
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
		path.resolve(path.dirname(__filename), './server-handler/index.js'),
	)
	.option(
		'--outputFolder <path>',
		'Path to folder which should be used for outputting bundled ZIP files for your Lambda. It will be cleared before every script run.',
		path.resolve(commandCwd, './next.out'),
	)
	.action(async (options) => {
		let config
		if (options.config) {
			const configPath = path.resolve(process.cwd(), options.config)
			config = yaml.load(readFileSync(configPath, 'utf-8'))
		} else {
			config = options
		}

		console.log('Our config is: ', config)
		const { standaloneFolder, publicFolder, handlerPath, outputFolder } = config

		wrapProcess(packHandler({ commandCwd, handlerPath, outputFolder, publicFolder, standaloneFolder }))
	})

program
	.command('deploy')
	.description('Deploy Next application via CDK')
	.option('--config <path>', 'YAML config file that can be set as opposed to having to set every flag.')
	.option('--stackName <name>', 'Name of the stack to be deployed.', 'StandaloneNextjsStack-Temporary')
	.option('--appPath <path>', 'Absolute path to app.', path.resolve(__dirname, '../dist/cdk/app.js'))
	.option('--bootstrap', 'Bootstrap CDK stack.', false)
	.option('--region <region>', 'AWS region to deploy to.', undefined)
	.option('--lambdaTimeout <sec>', 'Set timeout for lambda function handling server requests.', Number, 15)
	.option('--lambdaMemory <mb>', 'Set memory for lambda function handling server requests.', Number, 512)
	.option('--imageLambdaTimeout <sec>', 'Set timeout for lambda function handling image optimization.', Number, IMAGE_LAMBDA_DEFAULT_TIMEOUT)
	.option('--imageLambdaMemory <mb>', 'Set memory for lambda function handling image optimization.', Number, IMAGE_LAMBDA_DEFAULT_MEMORY)
	.option('--lambdaRuntime <runtime>', "Specify version of NodeJS to use as Lambda's runtime. Options: node14, node16, node18.", 'node16')
	.option('--domainNames <domainList>', 'Comma-separated list of domains to use. (example: mydomain.com,mydonain.au,other.domain.com)', undefined)
	.option('--customApiDomain <domain>', 'Domain to forward the requests to /api routes, by default API routes will be handled by the server lambda.', undefined)
	.option('--redirectFromApex', 'Redirect from apex domain to specified address.', false)
	.option('--profile <name>', 'AWS profile to use with CDK.', undefined)
	.option('--hotswap', 'Hotswap stack to speedup deployment.', false)
	.action(async (options) => {
		let config
		if (options.config) {
			const configPath = path.resolve(process.cwd(), options.config)
			config = yaml.load(readFileSync(configPath, 'utf-8'))
		} else {
			config = options
		}

		console.log('Our config is: ', config)
		const {
			stackName,
			appPath,
			bootstrap,
			region,
			lambdaTimeout,
			lambdaMemory,
			lambdaRuntime,
			imageLambdaMemory,
			imageLambdaTimeout,
			customApiDomain,
			redirectFromApex,
			domainNames,
			hotswap,
			profile,
		} = config

		wrapProcess(
			deployHandler({
				stackName,
				appPath,
				bootstrap,
				region,
				lambdaTimeout,
				lambdaMemory,
				lambdaRuntime,
				imageLambdaMemory,
				imageLambdaTimeout,
				customApiDomain,
				redirectFromApex,
				domainNames,
				hotswap,
				profile,
			}),
		)
	})

program
	.command('remove')
	.description('Remove Next application via CDK')
	.option('--stackName <name>', 'Name of the stack to be deployed.', 'StandaloneNextjsStack-Temporary')
	.option('--appPath <path>', 'Absolute path to app.', path.resolve(__dirname, '../dist/cdk/app.js'))
	.option('--region <region>', 'AWS region to deploy to.', undefined)
	.option('--profile <name>', 'AWS profile to use with CDK', undefined)
	.action(async (options) => {
		console.log('Our config is: ', options)
		const { stackName, appPath, region, profile } = options

		wrapProcess(removeHandler({ stackName, appPath, region, profile }))
	})

program
	.command('config')
	.description('Create the default config files in the current directory.')
	.action(async () => {
		const configFiles = ['deployConfig.yml', 'packConfig.yml']
		const sourceDirectory = path.resolve(__dirname, './templates')

		configFiles.forEach((configFile) => {
			const source = path.resolve(sourceDirectory, `./${configFile}`)
			const dest = path.resolve(process.cwd(), `./${configFile}`)
			copyFileSync(source, dest)
		})
	})

program.parse(process.argv)
