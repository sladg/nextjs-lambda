import { App } from 'aws-cdk-lib'
import path from 'path'
import { NextStandaloneStack } from './stack'
import {
	DEFAULT_TIMEOUT as IMAGE_LAMBDA_DEFAULT_TIMEOUT,
	DEFAULT_MEMORY as IMAGE_LAMBDA_DEFAULT_MEMORY,
} from './utils/imageLambda'
import { handler, name, optimizerCodePath, optimizerLayerPath, version } from '@sladg/imaginex-lambda'

const app = new App()

if (!process.env.STACK_NAME) {
	throw new Error('Name of CDK stack was not specified!')
}

const commandCwd = process.cwd()

new NextStandaloneStack(app, process.env.STACK_NAME, {
	// NextJS lambda specific config
	assetsZipPath: path.resolve(commandCwd, './next.out/assetsLayer.zip'),
	codeZipPath: path.resolve(commandCwd, './next.out/code.zip'),
	dependenciesZipPath: path.resolve(commandCwd, './next.out/dependenciesLayer.zip'),
	customServerHandler: 'index.handler',

	// Image lambda specific config
	imageHandlerZipPath: optimizerCodePath,
	imageLayerZipPath: optimizerLayerPath,
	imageLambdaHash: `${name}_${version}`,
	customImageHandler: handler,

	// Lambda & AWS config
	apigwServerPath: '/_server',
	apigwImagePath: '/_image',

	lambdaTimeout: process.env.LAMBDA_TIMEOUT ? Number(process.env.LAMBDA_TIMEOUT) : 15,
	lambdaMemory: process.env.LAMBDA_MEMORY ? Number(process.env.LAMBDA_MEMORY) : 1024,
	imageLambdaTimeout: process.env.LAMBDA_TIMEOUT ? Number(process.env.IMAGE_LAMBDA_TIMEOUT) : IMAGE_LAMBDA_DEFAULT_TIMEOUT,
	imageLambdaMemory: process.env.LAMBDA_MEMORY ? Number(process.env.IMAGE_LAMBDA_MEMORY) : IMAGE_LAMBDA_DEFAULT_MEMORY,
	hostedZone: process.env.HOSTED_ZONE ?? undefined,
	dnsPrefix: process.env.DNS_PREFIX ?? undefined,
	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.CDK_DEFAULT_REGION,
	},
})

app.synth()
