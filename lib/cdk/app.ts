import { handler, name, optimizerCodePath, optimizerLayerPath, version } from '@sladg/imaginex-lambda'
import { App } from 'aws-cdk-lib'
import path from 'path'

import { envConfig } from './config'
import { NextStandaloneStack } from './stack'

const app = new App()

const stackConfig = {
	...envConfig,
	buildFolder: undefined,
}

new NextStandaloneStack(app, envConfig.stackName, {
	// NextJS lambda specific config.
	assetsZipPath: path.resolve(envConfig.buildFolder, './next.out/assetsLayer.zip'),
	codeZipPath: path.resolve(envConfig.buildFolder, './next.out/code.zip'),
	dependenciesZipPath: path.resolve(envConfig.buildFolder, './next.out/dependenciesLayer.zip'),
	customServerHandler: 'index.handler',

	// Image lambda specific config.
	imageHandlerZipPath: optimizerCodePath,
	imageLayerZipPath: optimizerLayerPath,
	imageLambdaHash: `${name}_${version}`,
	customImageHandler: handler,

	// Lambda & AWS config.
	apigwServerPath: '/_server',
	apigwImagePath: '/_image',

	...stackConfig,

	env: {
		account: process.env.CDK_DEFAULT_ACCOUNT,
		region: process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION,
	},
})

app.synth()
